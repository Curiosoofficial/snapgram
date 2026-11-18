import { neon } from "@neondatabase/serverless";
import { SCHEMA } from "./schema.js";
import { seedStatements } from "./seed.js";

// Small database interface, so the same code runs against Neon (production)
// and PGlite (local Postgres in WebAssembly, used by `npm run dev`).

export type Row = Record<string, unknown>;
export type Statement = { text: string; params?: unknown[] };

export type Db = {
  kind: "neon" | "local";
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs all statements in ONE transaction: all succeed or nothing changes. */
  transaction(statements: Statement[]): Promise<void>;
};

const databaseUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL;

function neonDb(url: string): Db {
  const sql = neon(url);
  return {
    kind: "neon",
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.query(text, params)) as T[];
    },
    async transaction(statements) {
      await sql.transaction(statements.map((s) => sql.query(s.text, s.params ?? [])));
    },
  };
}

// The Vite dev server (vite.config.ts) provides a local PGlite database
// through this global when DATABASE_URL is not set
const devDatabase = () =>
  (globalThis as { __snapgramDevDatabase?: () => Promise<Db> }).__snapgramDevDatabase;

export class NoDatabaseError extends Error {
  constructor() {
    super("No database configured. Set DATABASE_URL (Neon) in the Vercel project.");
  }
}

let ready: Promise<Db> | null = null;

/** Returns the database; on the first call per server instance it creates the tables. */
export function getDb(): Promise<Db> {
  ready ??= (async () => {
    const url = databaseUrl();
    const createDevDatabase = devDatabase();
    const db = url ? neonDb(url) : createDevDatabase ? await createDevDatabase() : null;
    if (!db) throw new NoDatabaseError();

    await db.transaction(SCHEMA.map((text) => ({ text })));
    await seedIfEmpty(db);
    return db;
  })().catch((error) => {
    ready = null; // try again on the next request
    throw error;
  });

  return ready;
}

async function seedIfEmpty(db: Db) {
  const inserted = await db.query(
    `insert into meta (key, value) values ('seeded_at', now()::text)
     on conflict (key) do nothing returning key`
  );
  if (inserted.length > 0) await db.transaction(await seedStatements());
}

// ============================== DAILY RESET
// Everybody can post on the public demo, so the data is reset to the sample
// posts every DEMO_RESET_HOURS (default 24, "0" turns it off). There is no
// cron job: the first request after the time is up does the reset.

const resetHours = () => {
  const value = Number(process.env.DEMO_RESET_HOURS ?? 24);
  return Number.isFinite(value) ? value : 24;
};

let lastResetCheck = 0;

export async function resetIfDue(db: Db) {
  const hours = resetHours();
  if (hours <= 0 || Date.now() - lastResetCheck < 60_000) return;
  lastResetCheck = Date.now();

  // Only the request that manages to update the timestamp does the reset,
  // so two server instances never reset at the same time.
  const claimed = await db.query(
    `update meta set value = now()::text
     where key = 'seeded_at' and value::timestamptz < now() - make_interval(hours => $1::int)
     returning key`,
    [Math.round(hours)]
  );
  if (claimed.length > 0) await db.transaction(await seedStatements({ wipe: true }));
}

export async function nextResetAt(db: Db) {
  const hours = resetHours();
  if (hours <= 0) return null;
  const rows = await db.query<{ value: string }>(`select value from meta where key = 'seeded_at'`);
  if (!rows[0]) return null;
  return new Date(new Date(rows[0].value).getTime() + hours * 3_600_000).toISOString();
}

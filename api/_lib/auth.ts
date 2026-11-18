import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Db } from "./db.js";

// ============================== PASSWORDS
// scrypt is built into Node and made for passwords: slow on purpose and with
// a random salt per user, so equal passwords get different hashes.

const scryptAsync = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 64, (error, key) => (error ? reject(error) : resolve(key)))
  );

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [algorithm, saltHex, keyHex] = stored.split(":");
  if (algorithm !== "scrypt" || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ============================== SESSIONS
// The browser gets a random token and sends it as "Authorization: Bearer …".
// The database only stores a SHA-256 hash of it, so a leaked database does
// not contain usable tokens. A token instead of a cookie, because the app
// runs in an iframe on the portfolio, where browsers block third-party cookies.

const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(db: Db, userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.query(
    `insert into sessions (token_hash, user_id, expires_at)
     values ($1, $2, now() + make_interval(days => $3::int))`,
    [hashToken(token), userId, SESSION_DAYS]
  );
  return token;
}

const bearerToken = (request: Request) => {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
};

export async function getSessionUserId(db: Db, request: Request) {
  const token = bearerToken(request);
  if (!token) return null;

  const rows = await db.query<{ user_id: string }>(
    `select user_id from sessions where token_hash = $1 and expires_at > now()`,
    [hashToken(token)]
  );
  return rows[0]?.user_id ?? null;
}

export async function deleteSession(db: Db, request: Request) {
  const token = bearerToken(request);
  if (token) await db.query(`delete from sessions where token_hash = $1`, [hashToken(token)]);
}

// ============================== AVATARS
// Same idea as Appwrite's avatars.getInitials(): coloured square with initials

const AVATAR_COLORS = ["#877EFF", "#FF5A5A", "#FFB620", "#2A9D8F", "#E07A5F", "#3A86FF"];

export function initialsAvatar(name: string) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .replace(/[<>&"']/g, "") || "?";
  const color = AVATAR_COLORS[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${color}"/><text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="40" font-weight="700" fill="#fff">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const newId = () => randomBytes(10).toString("hex");

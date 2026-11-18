import { getSessionUserId } from "./auth.js";
import { getDb, NoDatabaseError, resetIfDue, type Db } from "./db.js";

// Shared request handling for all functions in /api:
// method routing, database, current user, JSON responses and errors.

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export type Context = {
  request: Request;
  url: URL;
  db: Db;
  /** id of the logged-in user or null */
  viewerId: string | null;
  /** id of the logged-in user, otherwise a 401 error */
  requireUser(): string;
  body<T>(): Promise<T>;
};

type Method = "GET" | "POST" | "PATCH" | "DELETE";
type Route = (ctx: Context) => Promise<Response>;

/** Builds a Vercel Function: `export default handler({ GET: …, POST: … })` */
export function handler(routes: Partial<Record<Method, Route>>) {
  return {
    async fetch(request: Request): Promise<Response> {
      try {
        const route = routes[request.method as Method];
        if (!route) return json({ error: "Method not allowed" }, 405);

        const db = await getDb();
        await resetIfDue(db);
        const viewerId = await getSessionUserId(db, request);

        return await route({
          request,
          url: new URL(request.url),
          db,
          viewerId,
          requireUser() {
            if (!viewerId) throw new HttpError(401, "Please sign in first.");
            return viewerId;
          },
          async body<T>() {
            try {
              return (await request.json()) as T;
            } catch {
              throw new HttpError(400, "Invalid JSON body.");
            }
          },
        });
      } catch (error) {
        if (error instanceof HttpError) return json({ error: error.message }, error.status);
        if (error instanceof NoDatabaseError) return json({ error: error.message }, 503);
        console.error(error);
        return json({ error: "Something went wrong on the server." }, 500);
      }
    },
  };
}

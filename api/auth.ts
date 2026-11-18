import { createSession, deleteSession, hashPassword, initialsAvatar, newId, verifyPassword } from "./_lib/auth.js";
import { getUser } from "./_lib/docs.js";
import { handler, HttpError, json } from "./_lib/http.js";
import * as check from "./_lib/validate.js";

// GET  /api/auth                 -> { user } (the logged-in user or null)
// POST /api/auth?action=signup   -> { user }
// POST /api/auth?action=signin   -> { token, user }
// POST /api/auth?action=signout  -> { status }

type SignUpBody = { name?: string; username?: string; email?: string; password?: string };
type SignInBody = { email?: string; password?: string };

export default handler({
  async GET({ db, viewerId }) {
    return json({ user: viewerId ? await getUser(db, viewerId, viewerId) : null });
  },

  async POST(ctx) {
    const { db, url, request } = ctx;

    switch (url.searchParams.get("action")) {
      case "signup": {
        const body = await ctx.body<SignUpBody>();
        const name = check.text(body.name, "Name", { min: 2, max: 50 });
        const username = check.username(body.username);
        const email = check.email(body.email);
        const password = check.text(body.password, "Password", { min: 8, max: 200 });

        const taken = await db.query(
          `select 1 from users where email = $1 or lower(username) = lower($2)`,
          [email, username]
        );
        if (taken.length > 0) throw new HttpError(409, "This email or username is already taken.");

        const id = newId();
        await db.query(
          `insert into users (id, name, username, email, password_hash, image_url)
           values ($1, $2, $3, $4, $5, $6)`,
          [id, name, username, email, await hashPassword(password), initialsAvatar(name)]
        );
        return json({ user: await getUser(db, id, id) }, 201);
      }

      case "signin": {
        const body = await ctx.body<SignInBody>();
        const email = check.email(body.email);
        const rows = await db.query<{ id: string; password_hash: string | null }>(
          `select id, password_hash from users where email = $1`,
          [email]
        );
        const user = rows[0];

        // same message for "unknown email" and "wrong password", so nobody
        // can find out which emails are registered
        if (!user || !(await verifyPassword(String(body.password ?? ""), user.password_hash))) {
          throw new HttpError(401, "Wrong email or password.");
        }

        const token = await createSession(db, user.id);
        return json({ token, user: await getUser(db, user.id, user.id) });
      }

      case "signout": {
        await deleteSession(db, request);
        return json({ status: "ok" });
      }

      default:
        throw new HttpError(400, "Unknown action.");
    }
  },
});

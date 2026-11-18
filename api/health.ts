import { nextResetAt } from "./_lib/db.js";
import { handler, json } from "./_lib/http.js";

// GET /api/health -> is the database reachable? When is the next demo reset?

export default handler({
  async GET({ db }) {
    await db.query(`select 1`);
    return json({ ok: true, database: db.kind, nextResetAt: await nextResetAt(db) });
  },
});

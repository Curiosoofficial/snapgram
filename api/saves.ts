import { newId } from "./_lib/auth.js";
import { toDoc } from "./_lib/docs.js";
import { handler, HttpError, json } from "./_lib/http.js";

// POST   /api/saves        { postId } -> { save }
// DELETE /api/saves?id=…              -> { status }

export default handler({
  async POST(ctx) {
    const userId = ctx.requireUser();
    const { db } = ctx;
    const { postId } = await ctx.body<{ postId?: string }>();

    const exists = await db.query(`select 1 from posts where id = $1`, [String(postId ?? "")]);
    if (exists.length === 0) throw new HttpError(404, "Post not found.");

    // "on conflict do update" so the existing save is returned if the post was already saved
    const [save] = await db.query<{ id: string; created_at: string }>(
      `insert into saves (id, user_id, post_id) values ($1, $2, $3)
       on conflict (user_id, post_id) do update set user_id = excluded.user_id
       returning id, created_at`,
      [newId(), userId, postId]
    );

    return json({ save: toDoc({ id: save.id, createdAt: save.created_at, updatedAt: save.created_at }) }, 201);
  },

  async DELETE(ctx) {
    const userId = ctx.requireUser();
    const id = ctx.url.searchParams.get("id");
    if (!id) throw new HttpError(400, "Missing save id.");

    await ctx.db.query(`delete from saves where id = $1 and user_id = $2`, [id, userId]);
    return json({ status: "ok" });
  },
});

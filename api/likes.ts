import { getPost } from "./_lib/docs.js";
import { handler, HttpError, json } from "./_lib/http.js";

// POST /api/likes  { postId, likes } -> { post }
//
// The frontend sends the whole likes list (that is how the Appwrite version
// works). The server only looks at whether the CURRENT user is in it, so
// nobody can add or remove likes of other people.

type LikeBody = { postId?: string; likes?: unknown };

export default handler({
  async POST(ctx) {
    const userId = ctx.requireUser();
    const { db } = ctx;
    const body = await ctx.body<LikeBody>();
    const postId = String(body.postId ?? "");

    const exists = await db.query(`select 1 from posts where id = $1`, [postId]);
    if (exists.length === 0) throw new HttpError(404, "Post not found.");

    const liked = Array.isArray(body.likes) && body.likes.includes(userId);
    await db.query(
      liked
        ? `insert into likes (user_id, post_id) values ($1, $2) on conflict do nothing`
        : `delete from likes where user_id = $1 and post_id = $2`,
      [userId, postId]
    );

    return json({ post: await getPost(db, postId) });
  },
});

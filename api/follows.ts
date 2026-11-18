import { getUser } from "./_lib/docs.js";
import { handler, HttpError, json } from "./_lib/http.js";

// POST /api/follows  { userId, follow: true | false } -> { user }
// Follows or unfollows a user as the logged-in user and returns the updated
// profile (with followersCount, followingCount and isFollowing).

type FollowBody = { userId?: string; follow?: boolean };

export default handler({
  async POST(ctx) {
    const viewerId = ctx.requireUser();
    const { db } = ctx;
    const body = await ctx.body<FollowBody>();
    const userId = String(body.userId ?? "");

    if (userId === viewerId) throw new HttpError(400, "You can't follow yourself.");
    const exists = await db.query(`select 1 from users where id = $1`, [userId]);
    if (exists.length === 0) throw new HttpError(404, "User not found.");

    await db.query(
      body.follow === false
        ? `delete from follows where follower_id = $1 and following_id = $2`
        : `insert into follows (follower_id, following_id) values ($1, $2) on conflict do nothing`,
      [viewerId, userId]
    );

    return json({ user: await getUser(db, userId, viewerId) });
  },
});

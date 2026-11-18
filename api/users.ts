import { newId } from "./_lib/auth.js";
import { getUser, getUsers, toList } from "./_lib/docs.js";
import { handler, HttpError, json } from "./_lib/http.js";
import * as check from "./_lib/validate.js";

// GET   /api/users?limit=…  -> list of users
// GET   /api/users?id=…     -> one user with posts (+ liked and saved posts for yourself)
// PATCH /api/users?id=…     -> update your own profile { name, bio, image? }

type ProfileBody = { name?: string; bio?: string; image?: string };

export default handler({
  async GET({ db, url, viewerId }) {
    const id = url.searchParams.get("id");
    if (id) {
      const user = await getUser(db, id, viewerId);
      if (!user) throw new HttpError(404, "User not found.");
      return json({ user });
    }

    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);
    return json(toList(await getUsers(db, limit, viewerId)));
  },

  async PATCH(ctx) {
    const userId = ctx.requireUser();
    const { db, url } = ctx;
    if (url.searchParams.get("id") !== userId) throw new HttpError(403, "You can only edit your own profile.");

    const body = await ctx.body<ProfileBody>();
    const name = check.text(body.name, "Name", { min: 2, max: 50 });
    const bio = check.text(body.bio, "Bio", { max: 300 });

    if (body.image) {
      const image = check.image(body.image);
      const imageId = newId();
      const [old] = await db.query<{ image_id: string | null }>(`select image_id from users where id = $1`, [userId]);

      await db.transaction([
        {
          text: `insert into images (id, owner_id, content_type, data) values ($1, $2, $3, $4)`,
          params: [imageId, userId, image.contentType, image.base64],
        },
        {
          text: `update users set name = $2, bio = $3, image_url = $4, image_id = $5, updated_at = now() where id = $1`,
          params: [userId, name, bio, `/api/images?id=${imageId}`, imageId],
        },
        ...(old?.image_id ? [{ text: `delete from images where id = $1`, params: [old.image_id] }] : []),
      ]);
    } else {
      await db.query(`update users set name = $2, bio = $3, updated_at = now() where id = $1`, [userId, name, bio]);
    }

    return json({ user: await getUser(db, userId, userId) });
  },
});

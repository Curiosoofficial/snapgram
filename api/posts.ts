import { newId } from "./_lib/auth.js";
import { getPost, getPostsPage, getRecentPosts, requireOwnPost, searchPosts, toList, type PostFilter } from "./_lib/docs.js";
import { handler, HttpError, json } from "./_lib/http.js";
import * as check from "./_lib/validate.js";

// GET    /api/posts                        -> 20 newest posts (home feed)
// GET    /api/posts?list=explore&filter=all|following|popular&cursor=…  -> 9 posts per page (explore)
// GET    /api/posts?search=…               -> search in caption, location, tags
// GET    /api/posts?id=…                   -> one post
// POST   /api/posts                        -> create   { caption, location, tags, image }
// PATCH  /api/posts?id=…                   -> update   { caption, location, tags, image? }
// DELETE /api/posts?id=…                   -> delete

type PostBody = { caption?: string; location?: string; tags?: string | string[]; image?: string };

const MAX_POSTS_PER_DAY = 30;

const fields = (body: PostBody) => ({
  caption: check.text(body.caption, "Caption", { min: 1, max: 2200 }),
  location: check.text(body.location, "Location", { max: 200 }),
  tags: JSON.stringify(check.tags(body.tags)),
});

const imageStatement = (id: string, ownerId: string, image: { contentType: string; base64: string }) => ({
  text: `insert into images (id, owner_id, content_type, data) values ($1, $2, $3, $4)`,
  params: [id, ownerId, image.contentType, image.base64],
});

const requireId = (url: URL) => {
  const id = url.searchParams.get("id");
  if (!id) throw new HttpError(400, "Missing post id.");
  return id;
};

export default handler({
  async GET({ db, url, viewerId }) {
    const id = url.searchParams.get("id");
    if (id) {
      const post = await getPost(db, id);
      if (!post) throw new HttpError(404, "Post not found.");
      return json({ post });
    }

    const search = url.searchParams.get("search")?.trim();
    if (search) return json(toList(await searchPosts(db, search.slice(0, 100))));

    if (url.searchParams.get("list") === "explore") {
      const filter = url.searchParams.get("filter");
      const safeFilter: PostFilter = filter === "following" || filter === "popular" ? filter : "all";
      return json(toList(await getPostsPage(db, url.searchParams.get("cursor"), safeFilter, viewerId)));
    }

    return json(toList(await getRecentPosts(db)));
  },

  async POST(ctx) {
    const userId = ctx.requireUser();
    const { db } = ctx;
    const body = await ctx.body<PostBody>();
    const { caption, location, tags } = fields(body);
    const image = check.image(body.image);

    // simple protection against spam on the public demo
    const [{ count }] = await db.query<{ count: number }>(
      `select count(*)::int as count from posts where creator_id = $1 and created_at > now() - interval '1 day'`,
      [userId]
    );
    if (count >= MAX_POSTS_PER_DAY) throw new HttpError(429, "You have reached today's post limit.");

    const postId = newId();
    const imageId = newId();
    await db.transaction([
      imageStatement(imageId, userId, image),
      {
        text: `insert into posts (id, creator_id, caption, location, tags, image_url, image_id)
               values ($1, $2, $3, $4, array(select json_array_elements_text($5::json)), $6, $7)`,
        params: [postId, userId, caption, location, tags, `/api/images?id=${imageId}`, imageId],
      },
    ]);

    return json({ post: await getPost(db, postId) }, 201);
  },

  async PATCH(ctx) {
    const userId = ctx.requireUser();
    const { db, url } = ctx;
    const postId = requireId(url);
    const existing = await requireOwnPost(db, postId, userId);
    const body = await ctx.body<PostBody>();
    const { caption, location, tags } = fields(body);

    const update = {
      text: `update posts set caption = $2, location = $3, tags = array(select json_array_elements_text($4::json)),
             updated_at = now() where id = $1`,
      params: [postId, caption, location, tags],
    };

    if (body.image) {
      // new photo: save it, point the post to it and delete the old one
      const image = check.image(body.image);
      const imageId = newId();
      await db.transaction([
        imageStatement(imageId, userId, image),
        update,
        { text: `update posts set image_url = $2, image_id = $3 where id = $1`, params: [postId, `/api/images?id=${imageId}`, imageId] },
        ...(existing.image_id ? [{ text: `delete from images where id = $1`, params: [existing.image_id] }] : []),
      ]);
    } else {
      await db.transaction([update]);
    }

    return json({ post: await getPost(db, postId) });
  },

  async DELETE(ctx) {
    const userId = ctx.requireUser();
    const { db, url } = ctx;
    const postId = requireId(url);
    const existing = await requireOwnPost(db, postId, userId);

    // likes and saves are removed automatically (on delete cascade)
    await db.transaction([
      { text: `delete from posts where id = $1`, params: [postId] },
      ...(existing.image_id ? [{ text: `delete from images where id = $1`, params: [existing.image_id] }] : []),
    ]);

    return json({ status: "ok" });
  },
});

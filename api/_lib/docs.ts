import type { Db } from "./db.js";
import { HttpError } from "./http.js";
import { newId } from "./auth.js";

// The frontend was written for Appwrite. To keep it unchanged, the API
// returns the same shape: documents with $id/$createdAt/$updatedAt and the
// related documents already included (post.creator, post.likes, user.posts, …).
// Postgres builds the JSON itself with json_build_object/json_agg.

const USER_REF = (alias: string) => `json_build_object(
  'id', ${alias}.id, 'name', ${alias}.name, 'username', ${alias}.username,
  'bio', ${alias}.bio, 'imageUrl', ${alias}.image_url, 'imageId', coalesce(${alias}.image_id, ''),
  'createdAt', ${alias}.created_at, 'updatedAt', ${alias}.updated_at
)`;

const POST_DOC = `json_build_object(
  'id', p.id, 'caption', p.caption, 'location', p.location, 'tags', p.tags,
  'imageUrl', p.image_url, 'imageId', coalesce(p.image_id, ''),
  'createdAt', p.created_at, 'updatedAt', p.updated_at,
  'creator', (select ${USER_REF("u")} from users u where u.id = p.creator_id),
  'likes', coalesce((select json_agg(${USER_REF("lu")}) from likes l join users lu on lu.id = l.user_id where l.post_id = p.id), '[]'::json),
  'save', coalesce((select json_agg(json_build_object('id', s.id, 'createdAt', s.created_at, 'updatedAt', s.created_at)) from saves s where s.post_id = p.id), '[]'::json)
)`;

type RawDoc = { id: string; createdAt: string; updatedAt: string; [key: string]: unknown };

/** { id, createdAt, … } -> { $id, $createdAt, … } (recursively), like Appwrite documents */
export function toDoc(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toDoc);
  if (value === null || typeof value !== "object") return value;

  const { id, createdAt, updatedAt, ...rest } = value as RawDoc;
  const fields = Object.fromEntries(Object.entries(rest).map(([key, v]) => [key, toDoc(v)]));
  if (id === undefined) return fields;

  return {
    $id: id,
    $createdAt: new Date(createdAt).toISOString(),
    $updatedAt: new Date(updatedAt).toISOString(),
    $collectionId: "",
    $databaseId: "snapgram",
    $permissions: [],
    ...fields,
  };
}

export const toList = (documents: unknown[]) => ({ total: documents.length, documents });

// ============================== POSTS

async function postDocs(db: Db, where: string, params: unknown[] = []) {
  const rows = await db.query<{ doc: RawDoc }>(`select ${POST_DOC} as doc from posts p ${where}`, params);
  return rows.map((row) => toDoc(row.doc));
}

export async function getPost(db: Db, id: string) {
  const [post] = await postDocs(db, `where p.id = $1`, [id]);
  return post ?? null;
}

export const getRecentPosts = (db: Db) => postDocs(db, `order by p.created_at desc limit 20`);

export type PostFilter = "all" | "following" | "popular";

const LIKE_COUNT = (alias: string) => `(select count(*) from likes l where l.post_id = ${alias}.id)`;

/**
 * Explore page: 9 posts per page, the id of the last post is the cursor.
 * "following": only posts of people the viewer follows.
 * "popular": most likes first (then newest).
 * Cursor pagination compares the sort values of the last post, so new posts
 * or likes while scrolling don't cause duplicates like OFFSET would.
 */
export function getPostsPage(db: Db, cursor: string | null, filter: PostFilter, viewerId: string | null) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter === "following") {
    params.push(viewerId);
    conditions.push(`p.creator_id in (select following_id from follows where follower_id = $${params.length}::text)`);
  }

  if (cursor) {
    params.push(cursor);
    const c = `$${params.length}`;
    conditions.push(
      filter === "popular"
        ? `(${LIKE_COUNT("p")}, p.updated_at, p.id) < (select ${LIKE_COUNT("c")}, c.updated_at, c.id from posts c where c.id = ${c})`
        : `(p.updated_at, p.id) < (select c.updated_at, c.id from posts c where c.id = ${c})`
    );
  }

  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const order =
    filter === "popular"
      ? `order by ${LIKE_COUNT("p")} desc, p.updated_at desc, p.id desc`
      : `order by p.updated_at desc, p.id desc`;

  return postDocs(db, `${where} ${order} limit 9`, params);
}

export function searchPosts(db: Db, term: string) {
  // escape % and _ so they are searched literally
  const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return postDocs(
    db,
    `where p.caption ilike $1 or p.location ilike $1
       or exists (select 1 from unnest(p.tags) tag where tag ilike $1)
     order by p.created_at desc limit 30`,
    [pattern]
  );
}

export async function requireOwnPost(db: Db, postId: string, userId: string) {
  const rows = await db.query<{ creator_id: string; image_id: string | null }>(
    `select creator_id, image_id from posts where id = $1`,
    [postId]
  );
  if (!rows[0]) throw new HttpError(404, "Post not found.");
  if (rows[0].creator_id !== userId) throw new HttpError(403, "You can only change your own posts.");
  return rows[0];
}

// ============================== USERS

/**
 * Full user document. Email, liked and saved posts are private, so they are
 * only included when users look at their own profile.
 */
export async function getUser(db: Db, id: string, viewerId: string | null) {
  const isSelf = id === viewerId;
  const rows = await db.query<{ doc: RawDoc }>(
    `select json_build_object(
       'id', u.id, 'name', u.name, 'username', u.username,
       'email', case when $2::boolean then u.email else '' end,
       'bio', u.bio, 'imageUrl', u.image_url, 'imageId', coalesce(u.image_id, ''),
       'accountId', u.id, 'createdAt', u.created_at, 'updatedAt', u.updated_at,
       'followersCount', (select count(*)::int from follows f where f.following_id = u.id),
       'followingCount', (select count(*)::int from follows f where f.follower_id = u.id),
       'isFollowing', exists (select 1 from follows f where f.follower_id = $3::text and f.following_id = u.id)
     ) as doc from users u where u.id = $1`,
    [id, isSelf, viewerId]
  );
  if (!rows[0]) return null;

  const [posts, liked, saves] = await Promise.all([
    postDocs(db, `where p.creator_id = $1 order by p.created_at desc`, [id]),
    isSelf
      ? postDocs(db, `where exists (select 1 from likes l where l.post_id = p.id and l.user_id = $1) order by p.created_at desc`, [id])
      : Promise.resolve([]),
    isSelf
      ? db.query<{ id: string; post_id: string; created_at: string }>(
          `select id, post_id, created_at from saves where user_id = $1 order by created_at`,
          [id]
        )
      : Promise.resolve([]),
  ]);

  const savedPosts = saves.length
    ? await postDocs(db, `where p.id in (select post_id from saves where user_id = $1)`, [id])
    : [];
  const postsById = new Map(savedPosts.map((post) => [(post as { $id: string }).$id, post]));

  return {
    ...(toDoc(rows[0].doc) as object),
    posts,
    liked,
    save: saves.map((save) => ({
      ...(toDoc({ id: save.id, createdAt: save.created_at, updatedAt: save.created_at }) as object),
      post: postsById.get(save.post_id) ?? null,
    })),
  };
}

/** User list for the "People" page; isFollowing tells if the viewer follows each user */
export async function getUsers(db: Db, limit: number, viewerId: string | null) {
  const rows = await db.query<{ doc: RawDoc }>(
    `select ${USER_REF("u")}::jsonb || jsonb_build_object(
       'isFollowing', exists (select 1 from follows f where f.follower_id = $2::text and f.following_id = u.id)
     ) as doc
     from users u order by u.created_at desc limit $1`,
    [limit, viewerId]
  );
  return rows.map((row) => toDoc(row.doc));
}

// ============================== IMAGES

export async function saveImage(db: Db, ownerId: string, image: { contentType: string; base64: string }) {
  const id = newId();
  await db.query(`insert into images (id, owner_id, content_type, data) values ($1, $2, $3, $4)`, [
    id,
    ownerId,
    image.contentType,
    image.base64,
  ]);
  return { id, url: `/api/images?id=${id}` };
}

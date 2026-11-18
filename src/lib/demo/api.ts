import type { Models } from "appwrite";
import { INewPost, INewUser, IPostFilter, IUpdatePost, IUpdateUser } from "@/types";
import { parseTags } from "@/lib/utils";
import { DemoDb, DemoPost, DemoUser, readDb, writeDb } from "./store";
import { delay, fileToDataUrl, hashPassword, initialsAvatar, newId, nowIso } from "./helpers";

// Browser-only version of lib/appwrite/api.ts with the same functions and
// the same return shapes (Appwrite documents incl. loaded relationships),
// so the React components don't know which backend they are talking to.

type Doc = Models.Document;
type DocList = Models.DocumentList<Models.Document>;

const PAGE_SIZE = 9;
const RECENT_LIMIT = 20;

// ============================== MAPPING (tables -> Appwrite-like documents)

const meta = (record: { $id: string; $createdAt: string; $updatedAt: string }, collection: string) => ({
  $id: record.$id,
  $createdAt: record.$createdAt,
  $updatedAt: record.$updatedAt,
  $collectionId: collection,
  $databaseId: "demo",
  $permissions: [] as string[],
});

const userRef = (user: DemoUser): Doc => ({
  ...meta(user, "users"),
  accountId: user.$id,
  name: user.name,
  username: user.username,
  email: user.email,
  bio: user.bio,
  imageUrl: user.imageUrl,
  imageId: user.imageId,
});

const byNewest = (a: { $createdAt: string }, b: { $createdAt: string }) =>
  b.$createdAt.localeCompare(a.$createdAt);

function postDoc(db: DemoDb, post: DemoPost): Doc {
  const creator = db.users.find((user) => user.$id === post.creator);

  return {
    ...meta(post, "posts"),
    caption: post.caption,
    imageUrl: post.imageUrl,
    imageId: post.imageId,
    location: post.location,
    tags: [...post.tags],
    creator: creator ? userRef(creator) : null,
    likes: db.users.filter((user) => post.likes.includes(user.$id)).map(userRef),
    save: db.saves.filter((save) => save.post === post.$id).map((save) => meta(save, "saves")),
  };
}

const followsOf = (db: DemoDb) => db.follows ?? []; // older demo data has no follows yet

const isFollowing = (db: DemoDb, userId: string) =>
  followsOf(db).some((f) => f.follower === db.sessionUserId && f.following === userId);

function userDoc(db: DemoDb, user: DemoUser): Doc {
  return {
    ...userRef(user),
    followersCount: followsOf(db).filter((f) => f.following === user.$id).length,
    followingCount: followsOf(db).filter((f) => f.follower === user.$id).length,
    isFollowing: isFollowing(db, user.$id),
    posts: db.posts
      .filter((post) => post.creator === user.$id)
      .sort(byNewest)
      .map((post) => postDoc(db, post)),
    liked: db.posts
      .filter((post) => post.likes.includes(user.$id))
      .map((post) => postDoc(db, post)),
    save: db.saves
      .filter((save) => save.user === user.$id)
      .map((save) => {
        const post = db.posts.find((p) => p.$id === save.post);
        return { ...meta(save, "saves"), user: userRef(user), post: post ? postDoc(db, post) : null };
      }),
  };
}

const toList = (documents: Doc[]): DocList => ({ total: documents.length, documents });

const sessionUserId = (db: DemoDb) => db.sessionUserId;

// ============================== AUTH

export async function createUserAccount(user: INewUser) {
  await delay();
  try {
    const email = user.email.trim().toLowerCase();
    const passwordHash = await hashPassword(user.password);
    const db = readDb();

    if (db.users.some((u) => u.email === email)) {
      throw new Error("A user with this email already exists.");
    }

    const now = nowIso();
    const newUser: DemoUser = {
      $id: newId(),
      $createdAt: now,
      $updatedAt: now,
      name: user.name,
      username: user.username,
      email,
      passwordHash,
      bio: "",
      imageUrl: initialsAvatar(user.name),
      imageId: "",
    };

    writeDb({ ...db, users: [...db.users, newUser] });
    return userRef(newUser);
  } catch (error) {
    console.log(error);
    return undefined;
  }
}

export async function signInAccount(user: { email: string; password: string }) {
  await delay();
  try {
    const email = user.email.trim().toLowerCase();
    const passwordHash = await hashPassword(user.password);
    const db = readDb();
    const found = db.users.find((u) => u.email === email && u.passwordHash === passwordHash);

    if (!found) throw new Error("Invalid email or password.");

    writeDb({ ...db, sessionUserId: found.$id });
    return { $id: newId(), userId: found.$id };
  } catch (error) {
    console.log(error);
    return undefined;
  }
}

export async function getCurrentUser() {
  await delay(50);
  const db = readDb();
  const user = db.users.find((u) => u.$id === sessionUserId(db));
  return user ? userDoc(db, user) : undefined;
}

export async function signOutAccount() {
  await delay();
  try {
    const db = readDb();
    writeDb({ ...db, sessionUserId: null });
    return { status: "ok" };
  } catch (error) {
    console.log(error);
  }
}

// ============================== POSTS

export async function createPost(post: INewPost) {
  await delay();
  try {
    if (!post.file?.[0]) throw new Error("A photo is required.");

    const imageUrl = await fileToDataUrl(post.file[0]);
    const db = readDb();
    const now = nowIso();
    const newPost: DemoPost = {
      $id: newId(),
      $createdAt: now,
      $updatedAt: now,
      creator: post.userId,
      caption: post.caption,
      imageUrl,
      imageId: newId(),
      location: post.location ?? "",
      tags: parseTags(post.tags),
      likes: [],
    };

    const next = { ...db, posts: [newPost, ...db.posts] };
    writeDb(next);
    return postDoc(next, newPost);
  } catch (error) {
    console.log(error);
  }
}

export async function getRecentPosts() {
  await delay();
  const db = readDb();
  const posts = [...db.posts].sort(byNewest).slice(0, RECENT_LIMIT);
  return toList(posts.map((post) => postDoc(db, post)));
}

export async function likePost(postId: string, likesArray: string[]) {
  try {
    const db = readDb();
    const post = db.posts.find((p) => p.$id === postId);
    if (!post) throw new Error("Post not found.");

    const updated: DemoPost = {
      ...post,
      likes: likesArray.filter((id) => db.users.some((u) => u.$id === id)),
    };
    const next = { ...db, posts: db.posts.map((p) => (p.$id === postId ? updated : p)) };
    writeDb(next);
    return postDoc(next, updated);
  } catch (error) {
    console.log(error);
  }
}

export async function savePost(postId: string, userId: string) {
  try {
    const db = readDb();
    const existing = db.saves.find((s) => s.post === postId && s.user === userId);
    if (existing) return meta(existing, "saves");

    const now = nowIso();
    const save = { $id: newId(), $createdAt: now, $updatedAt: now, user: userId, post: postId };
    writeDb({ ...db, saves: [...db.saves, save] });
    return meta(save, "saves");
  } catch (error) {
    console.log(error);
  }
}

export async function deleteSavedPost(savedRecordId: string) {
  try {
    const db = readDb();
    writeDb({ ...db, saves: db.saves.filter((s) => s.$id !== savedRecordId) });
    return { status: "ok" };
  } catch (error) {
    console.log(error);
  }
}

export async function getPostById(postId: string) {
  await delay();
  const db = readDb();
  const post = db.posts.find((p) => p.$id === postId);
  return post ? postDoc(db, post) : undefined;
}

export async function updatePost(post: IUpdatePost) {
  await delay();
  try {
    const db = readDb();
    const existing = db.posts.find((p) => p.$id === post.postId);
    if (!existing) throw new Error("Post not found.");
    if (existing.creator !== sessionUserId(db)) throw new Error("Only the creator can edit a post.");

    const hasFileToUpdate = post.file.length > 0;
    const updated: DemoPost = {
      ...existing,
      caption: post.caption,
      location: post.location ?? "",
      tags: parseTags(post.tags),
      imageUrl: hasFileToUpdate ? await fileToDataUrl(post.file[0]) : existing.imageUrl,
      imageId: hasFileToUpdate ? newId() : existing.imageId,
      $updatedAt: nowIso(),
    };

    const latest = readDb();
    const next = { ...latest, posts: latest.posts.map((p) => (p.$id === updated.$id ? updated : p)) };
    writeDb(next);
    return postDoc(next, updated);
  } catch (error) {
    console.log(error);
  }
}

export async function deletePost(postId: string, imageId: string) {
  if (!postId || !imageId) return;
  await delay();

  try {
    const db = readDb();
    const post = db.posts.find((p) => p.$id === postId);
    if (!post) throw new Error("Post not found.");
    if (post.creator !== sessionUserId(db)) throw new Error("Only the creator can delete a post.");

    writeDb({
      ...db,
      posts: db.posts.filter((p) => p.$id !== postId),
      saves: db.saves.filter((s) => s.post !== postId),
    });
    return { status: "ok" };
  } catch (error) {
    console.log(error);
  }
}

export async function getInfinitePosts({ pageParam, filter = "all" }: { pageParam: string | null; filter?: IPostFilter }) {
  await delay();
  const db = readDb();
  const followed = new Set(
    followsOf(db).filter((f) => f.follower === db.sessionUserId).map((f) => f.following)
  );
  const byUpdated = (a: DemoPost, b: DemoPost) => b.$updatedAt.localeCompare(a.$updatedAt);

  const sorted = db.posts
    .filter((post) => filter !== "following" || followed.has(post.creator))
    .sort(filter === "popular" ? (a, b) => b.likes.length - a.likes.length || byUpdated(a, b) : byUpdated);
  const start = pageParam ? sorted.findIndex((p) => p.$id === pageParam) + 1 : 0;
  const page = sorted.slice(start, start + PAGE_SIZE);
  return { total: sorted.length, documents: page.map((post) => postDoc(db, post)) };
}

export async function searchPosts(searchTerm: string) {
  await delay();
  const db = readDb();
  const term = searchTerm.trim().toLowerCase();
  const matches = db.posts
    .filter(
      (post) =>
        post.caption.toLowerCase().includes(term) ||
        post.location.toLowerCase().includes(term) ||
        post.tags.some((tag) => tag.toLowerCase().includes(term))
    )
    .sort(byNewest);
  return toList(matches.map((post) => postDoc(db, post)));
}

// ============================== USERS

export async function getUserById(userId: string) {
  await delay();
  const db = readDb();
  const user = db.users.find((u) => u.$id === userId);
  return user ? userDoc(db, user) : undefined;
}

export async function updateUser(user: IUpdateUser) {
  await delay();
  try {
    const db = readDb();
    const existing = db.users.find((u) => u.$id === user.userId);
    if (!existing) throw new Error("User not found.");
    if (existing.$id !== sessionUserId(db)) throw new Error("You can only edit your own profile.");

    const hasFileToUpdate = user.file.length > 0;
    const updated: DemoUser = {
      ...existing,
      name: user.name,
      bio: user.bio,
      imageUrl: hasFileToUpdate ? await fileToDataUrl(user.file[0], { maxSize: 400 }) : existing.imageUrl,
      imageId: hasFileToUpdate ? newId() : existing.imageId,
      $updatedAt: nowIso(),
    };

    const latest = readDb();
    const next = { ...latest, users: latest.users.map((u) => (u.$id === updated.$id ? updated : u)) };
    writeDb(next);
    return userDoc(next, updated);
  } catch (error) {
    console.log(error);
  }
}

export async function getUsers(limit?: number) {
  await delay();
  const db = readDb();
  const users = [...db.users].sort(byNewest).slice(0, limit ?? db.users.length);
  return toList(users.map((user) => ({ ...userRef(user), isFollowing: isFollowing(db, user.$id) })));
}

export async function followUser(userId: string, follow: boolean) {
  await delay();
  try {
    const db = readDb();
    const viewerId = sessionUserId(db);
    const target = db.users.find((u) => u.$id === userId);
    if (!viewerId) throw new Error("Please sign in first.");
    if (!target) throw new Error("User not found.");
    if (userId === viewerId) throw new Error("You can't follow yourself.");

    const others = followsOf(db).filter((f) => !(f.follower === viewerId && f.following === userId));
    const follows = follow ? [...others, { follower: viewerId, following: userId, $createdAt: nowIso() }] : others;

    const next = { ...db, follows };
    writeDb(next);
    return userDoc(next, target);
  } catch (error) {
    console.log(error);
  }
}

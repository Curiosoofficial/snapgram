import type { Models } from "appwrite";
import { INewPost, INewUser, IPostFilter, IUpdatePost, IUpdateUser } from "@/types";
import { fileToDataUrl } from "../demo/helpers";

// Client for the own backend in /api (Vercel Functions + Postgres).
// Same functions and return values as lib/appwrite/api.ts.

type Doc = Models.Document;
type DocList = Models.DocumentList<Models.Document>;

const TOKEN_KEY = "snapgram-token";

// The session token lives in localStorage and is sent as a Bearer header.
// Cookies would not work while the app is embedded in an iframe on another
// domain (the portfolio), because browsers block third-party cookies.
const token = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (value: string | null) => {
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // storage blocked -> the session only lasts until the page is reloaded
    }
  },
};
let memoryToken: string | null = null;

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, { method = "GET", body }: { method?: string; body?: unknown } = {}) {
  const sessionToken = token.get() ?? memoryToken;
  const response = await fetch(`/api/${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.error ?? response.statusText);
  return data as T;
}

const upload = (file?: File) => (file ? fileToDataUrl(file, { keepSvg: false }) : undefined);

// Like the Appwrite version: log the error and return undefined, the UI
// shows a toast in that case.
async function attempt<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error) {
    console.log(error);
    return undefined;
  }
}

// ============================== AUTH

export const createUserAccount = (user: INewUser) =>
  attempt(async () => (await request<{ user: Doc }>("auth?action=signup", { method: "POST", body: user })).user);

export const signInAccount = (user: { email: string; password: string }) =>
  attempt(async () => {
    const result = await request<{ token: string; user: Doc }>("auth?action=signin", { method: "POST", body: user });
    token.set(result.token);
    memoryToken = result.token;
    return result.user;
  });

export async function getCurrentUser() {
  if (!token.get() && !memoryToken) return undefined;
  return attempt(async () => (await request<{ user: Doc | null }>("auth")).user ?? undefined);
}

export const signOutAccount = () =>
  attempt(async () => {
    try {
      return await request<{ status: string }>("auth?action=signout", { method: "POST" });
    } finally {
      token.set(null);
      memoryToken = null;
    }
  });

// ============================== POSTS

export const createPost = (post: INewPost) =>
  attempt(async () => {
    const result = await request<{ post: Doc }>("posts", {
      method: "POST",
      body: { caption: post.caption, location: post.location, tags: post.tags, image: await upload(post.file[0]) },
    });
    return result.post;
  });

export const getRecentPosts = () => request<DocList>("posts");

export const likePost = (postId: string, likesArray: string[]) =>
  attempt(async () => (await request<{ post: Doc }>("likes", { method: "POST", body: { postId, likes: likesArray } })).post);

// the server takes the user from the session, so no userId parameter
export const savePost = (postId: string) =>
  attempt(async () => (await request<{ save: Doc }>("saves", { method: "POST", body: { postId } })).save);

export const deleteSavedPost = (savedRecordId: string) =>
  attempt(() => request<{ status: string }>(`saves?id=${encodeURIComponent(savedRecordId)}`, { method: "DELETE" }));

export const getPostById = (postId: string) =>
  attempt(async () => (await request<{ post: Doc }>(`posts?id=${encodeURIComponent(postId)}`)).post);

export const updatePost = (post: IUpdatePost) =>
  attempt(async () => {
    const result = await request<{ post: Doc }>(`posts?id=${encodeURIComponent(post.postId)}`, {
      method: "PATCH",
      body: { caption: post.caption, location: post.location, tags: post.tags, image: await upload(post.file[0]) },
    });
    return result.post;
  });

// the server looks up the image of the post itself, so no imageId parameter
export const deletePost = (postId: string) =>
  attempt(async () => {
    if (!postId) throw new Error("Missing post id.");
    return request<{ status: string }>(`posts?id=${encodeURIComponent(postId)}`, { method: "DELETE" });
  });

export const getInfinitePosts = ({ pageParam, filter = "all" }: { pageParam: string | null; filter?: IPostFilter }) =>
  attempt(() =>
    request<DocList>(
      `posts?list=explore&filter=${filter}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`
    )
  );

export const searchPosts = (searchTerm: string) =>
  attempt(() => request<DocList>(`posts?search=${encodeURIComponent(searchTerm)}`));

// ============================== USERS

export const getUserById = (userId: string) =>
  attempt(async () => (await request<{ user: Doc }>(`users?id=${encodeURIComponent(userId)}`)).user);

export const updateUser = (user: IUpdateUser) =>
  attempt(async () => {
    const image = user.file[0] ? await fileToDataUrl(user.file[0], { maxSize: 400, keepSvg: false }) : undefined;
    const result = await request<{ user: Doc }>(`users?id=${encodeURIComponent(user.userId)}`, {
      method: "PATCH",
      body: { name: user.name, bio: user.bio, image },
    });
    return result.user;
  });

export const getUsers = (limit?: number) =>
  attempt(() => request<DocList>(`users${limit ? `?limit=${limit}` : ""}`));

export const followUser = (userId: string, follow: boolean) =>
  attempt(async () => (await request<{ user: Doc }>("follows", { method: "POST", body: { userId, follow } })).user);

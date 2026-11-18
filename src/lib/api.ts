import type { Models } from "appwrite";
import { INewPost, INewUser, IPostFilter, IUpdatePost, IUpdateUser } from "@/types";
import * as appwriteApi from "./appwrite/api";
import * as demoApi from "./demo/api";
import * as restApi from "./rest/api";
import { backend, canFollow, isDemoMode } from "./mode";

// One interface, three implementations: the components and React Query hooks
// import from here and don't care which backend answers.

type Doc = Models.Document;
type DocList = Models.DocumentList<Models.Document>;
type Status = { status: string };

export type SnapgramApi = {
  createUserAccount(user: INewUser): Promise<Doc | undefined>;
  signInAccount(user: { email: string; password: string }): Promise<unknown>;
  getCurrentUser(): Promise<Doc | undefined>;
  signOutAccount(): Promise<unknown>;
  createPost(post: INewPost): Promise<Doc | undefined>;
  getRecentPosts(): Promise<DocList>;
  likePost(postId: string, likesArray: string[]): Promise<Doc | undefined>;
  savePost(postId: string, userId: string): Promise<Doc | undefined>;
  deleteSavedPost(savedRecordId: string): Promise<Status | undefined>;
  getPostById(postId: string): Promise<Doc | undefined>;
  updatePost(post: IUpdatePost): Promise<Doc | undefined>;
  deletePost(postId: string, imageId: string): Promise<Status | undefined>;
  getInfinitePosts(params: { pageParam: string | null; filter?: IPostFilter }): Promise<DocList | undefined>;
  searchPosts(searchTerm: string): Promise<DocList | undefined>;
  getUserById(userId: string): Promise<Doc | undefined>;
  updateUser(user: IUpdateUser): Promise<Doc | undefined>;
  getUsers(limit?: number): Promise<DocList | undefined>;
  followUser(userId: string, follow: boolean): Promise<Doc | undefined>;
};

// TypeScript checks here that ALL backends implement every function
const backends: Record<typeof backend, SnapgramApi> = {
  api: restApi,
  appwrite: appwriteApi,
  demo: demoApi,
};

const api = backends[backend];

export const {
  createUserAccount,
  signInAccount,
  getCurrentUser,
  signOutAccount,
  createPost,
  getRecentPosts,
  likePost,
  savePost,
  deleteSavedPost,
  getPostById,
  updatePost,
  deletePost,
  getInfinitePosts,
  searchPosts,
  getUserById,
  updateUser,
  getUsers,
  followUser,
} = api;

export { backend, canFollow, isDemoMode };

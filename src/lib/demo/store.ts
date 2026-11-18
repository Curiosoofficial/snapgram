import { createSeed } from "./seed";

// The demo "database": three tables like the Appwrite collections,
// stored as one JSON object in localStorage.

type Timestamps = {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
};

export type DemoUser = Timestamps & {
  name: string;
  username: string;
  email: string;
  passwordHash: string | null; // null = seed user, can't sign in
  bio: string;
  imageUrl: string;
  imageId: string;
};

export type DemoPost = Timestamps & {
  creator: string; // user id
  caption: string;
  imageUrl: string;
  imageId: string;
  location: string;
  tags: string[];
  likes: string[]; // user ids
};

export type DemoSave = Timestamps & {
  user: string; // user id
  post: string; // post id
};

export type DemoFollow = {
  follower: string; // user id
  following: string; // user id
  $createdAt: string;
};

export type DemoDb = {
  version: 1;
  users: DemoUser[];
  posts: DemoPost[];
  saves: DemoSave[];
  follows?: DemoFollow[]; // optional: data saved before follows existed has none
  sessionUserId: string | null;
};

const STORAGE_KEY = "snapgram-demo-v1";

export class DemoStorageFullError extends Error {
  constructor() {
    super("The demo storage in this browser is full.");
  }
}

let cache: DemoDb | null = null;

function persist(db: DemoDb) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (error) {
    // Quota exceeded -> tell the caller. Any other error (e.g. storage
    // blocked in a private window) -> keep the data in memory only.
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new DemoStorageFullError();
    }
  }
}

export function readDb(): DemoDb {
  if (cache) return cache;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as DemoDb) : null;
    if (parsed?.version === 1) {
      cache = parsed;
      return cache;
    }
  } catch {
    // storage blocked or broken JSON -> start with fresh demo data
  }

  cache = createSeed();
  try {
    persist(cache);
  } catch {
    // ignore, the seed works from memory as well
  }
  return cache;
}

// Writes first, then updates the cache, so a failed write changes nothing.
export function writeDb(next: DemoDb) {
  persist(next);
  cache = next;
}

export function resetDemoData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  cache = null;
}

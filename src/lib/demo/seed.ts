import type { DemoDb, DemoFollow, DemoPost, DemoSave, DemoUser } from "./store";
import { initialsAvatar } from "./helpers";

// Demo login (also shown on the sign-in page)
export const DEMO_EMAIL = "demo@snapgram.dev";
export const DEMO_PASSWORD = "demo1234";
// SHA-256 of DEMO_PASSWORD
const DEMO_PASSWORD_HASH = "0ead2060b65992dca4769af601a1b3a35ef38cfad2c2c465bb160ea764157c5d";

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

type SeedUser = Pick<DemoUser, "$id" | "name" | "username" | "email" | "bio"> & {
  passwordHash?: string;
  createdHoursAgo: number;
};

const seedUsers: SeedUser[] = [
  {
    $id: "user-alex",
    name: "Alex Muster",
    username: "alex.muster",
    email: DEMO_EMAIL,
    bio: "Demo account. Like, save, post and edit as much as you want, everything stays in your browser.",
    passwordHash: DEMO_PASSWORD_HASH,
    createdHoursAgo: 24 * 30,
  },
  {
    $id: "user-mia",
    name: "Mia Keller",
    username: "mia.keller",
    email: "mia@snapgram.dev",
    bio: "Mountains, lakes and early trains. Based in Zürich.",
    createdHoursAgo: 24 * 60,
  },
  {
    $id: "user-noah",
    name: "Noah Brunner",
    username: "noah.brunner",
    email: "noah@snapgram.dev",
    bio: "City nights and good coffee. Bern.",
    createdHoursAgo: 24 * 50,
  },
  {
    $id: "user-lea",
    name: "Lea Fontana",
    username: "lea.fontana",
    email: "lea@snapgram.dev",
    bio: "Illustrator. Shapes, colours, grids.",
    createdHoursAgo: 24 * 40,
  },
  {
    $id: "user-jonas",
    name: "Jonas Weber",
    username: "jonas.wbr",
    email: "jonas@snapgram.dev",
    bio: "Trail running and long weekends outside.",
    createdHoursAgo: 24 * 35,
  },
];

type SeedPost = Pick<DemoPost, "$id" | "creator" | "caption" | "location" | "tags" | "likes"> & {
  image: string;
  createdHoursAgo: number;
};

const seedPosts: SeedPost[] = [
  {
    $id: "post-mountain",
    creator: "user-mia",
    caption: "Golden hour above the clouds. Worth every step of that climb.",
    location: "Zermatt, Switzerland",
    tags: ["mountains", "sunset", "hiking"],
    likes: ["user-noah", "user-lea", "user-jonas"],
    image: "mountain-sunset.svg",
    createdHoursAgo: 3,
  },
  {
    $id: "post-city",
    creator: "user-noah",
    caption: "Same skyline, new lights every night.",
    location: "Zürich",
    tags: ["city", "night", "lights"],
    likes: ["user-mia", "user-alex"],
    image: "city-night.svg",
    createdHoursAgo: 7,
  },
  {
    $id: "post-art",
    creator: "user-lea",
    caption: "Playing with circles again. Bauhaus never gets old.",
    location: "Basel",
    tags: ["art", "design", "bauhaus"],
    likes: ["user-mia", "user-noah", "user-jonas", "user-alex"],
    image: "geometric-art.svg",
    createdHoursAgo: 20,
  },
  {
    $id: "post-forest",
    creator: "user-jonas",
    caption: "Morning fog in the forest and nobody else around.",
    location: "Uetliberg",
    tags: ["forest", "trailrun", "morning"],
    likes: ["user-mia", "user-alex"],
    image: "forest-fog.svg",
    createdHoursAgo: 30,
  },
  {
    $id: "post-coffee",
    creator: "user-noah",
    caption: "Flat white and a slow Sunday.",
    location: "Bern",
    tags: ["coffee", "sunday"],
    likes: ["user-lea"],
    image: "coffee.svg",
    createdHoursAgo: 52,
  },
  {
    $id: "post-lake",
    creator: "user-mia",
    caption: "First boat out on the lake this morning.",
    location: "Lake Lucerne",
    tags: ["lake", "sunrise", "boat"],
    likes: ["user-jonas", "user-noah"],
    image: "lake-boat.svg",
    createdHoursAgo: 75,
  },
  {
    $id: "post-cactus",
    creator: "user-lea",
    caption: "Tiny desk friend. It needs water once a month, I need coffee every hour.",
    location: "Basel",
    tags: ["plants", "studio"],
    likes: ["user-mia"],
    image: "cactus.svg",
    createdHoursAgo: 98,
  },
  {
    $id: "post-desert",
    creator: "user-jonas",
    caption: "Dunes, wind and absolutely no signal.",
    location: "Merzouga, Morocco",
    tags: ["travel", "desert"],
    likes: ["user-lea", "user-noah", "user-mia"],
    image: "desert.svg",
    createdHoursAgo: 140,
  },
  {
    $id: "post-waves",
    creator: "user-alex",
    caption: "My first post on Snapgram. Hello world! 👋",
    location: "Zürich",
    tags: ["hello", "firstpost"],
    likes: ["user-mia"],
    image: "ocean-waves.svg",
    createdHoursAgo: 220,
  },
];

const seedSaves: Array<Pick<DemoSave, "$id" | "user" | "post">> = [
  { $id: "save-1", user: "user-alex", post: "post-mountain" },
  { $id: "save-2", user: "user-alex", post: "post-coffee" },
];

// [follower, following]
const seedFollows: Array<[string, string]> = [
  ["user-alex", "user-mia"], ["user-alex", "user-lea"],
  ["user-mia", "user-noah"], ["user-mia", "user-lea"], ["user-mia", "user-alex"],
  ["user-noah", "user-mia"], ["user-noah", "user-jonas"],
  ["user-lea", "user-mia"], ["user-lea", "user-alex"],
  ["user-jonas", "user-mia"], ["user-jonas", "user-noah"], ["user-jonas", "user-lea"],
];

export function createSeed(): DemoDb {
  const users: DemoUser[] = seedUsers.map(({ createdHoursAgo, passwordHash, ...user }) => ({
    ...user,
    passwordHash: passwordHash ?? null,
    imageUrl: initialsAvatar(user.name),
    imageId: "",
    $createdAt: hoursAgo(createdHoursAgo),
    $updatedAt: hoursAgo(createdHoursAgo),
  }));

  const posts: DemoPost[] = seedPosts.map(({ createdHoursAgo, image, ...post }) => ({
    ...post,
    imageUrl: `/demo/posts/${image}`,
    imageId: image,
    $createdAt: hoursAgo(createdHoursAgo),
    $updatedAt: hoursAgo(createdHoursAgo),
  }));

  const saves: DemoSave[] = seedSaves.map((save, index) => ({
    ...save,
    $createdAt: hoursAgo(index + 1),
    $updatedAt: hoursAgo(index + 1),
  }));

  const follows: DemoFollow[] = seedFollows.map(([follower, following]) => ({
    follower,
    following,
    $createdAt: hoursAgo(24),
  }));

  return { version: 1, users, posts, saves, follows, sessionUserId: null };
}

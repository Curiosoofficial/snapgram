import { hashPassword, initialsAvatar } from "./auth.js";
import type { Statement } from "./db.js";

// Sample data for the public demo (same content as src/lib/demo/seed.ts,
// which is used by the browser-only demo mode). The images are static
// SVG files in public/demo/posts/.

export const DEMO_EMAIL = "demo@snapgram.dev";
export const DEMO_PASSWORD = "demo1234";

const users = [
  { id: "user-alex", name: "Alex Muster", username: "alex.muster", email: DEMO_EMAIL, demo: true, daysAgo: 30,
    bio: "Demo account. Like, save, post and edit as much as you want. The demo resets every 24 hours." },
  { id: "user-mia", name: "Mia Keller", username: "mia.keller", email: "mia@snapgram.dev", daysAgo: 60,
    bio: "Mountains, lakes and early trains. Based in Zürich." },
  { id: "user-noah", name: "Noah Brunner", username: "noah.brunner", email: "noah@snapgram.dev", daysAgo: 50,
    bio: "City nights and good coffee. Bern." },
  { id: "user-lea", name: "Lea Fontana", username: "lea.fontana", email: "lea@snapgram.dev", daysAgo: 40,
    bio: "Illustrator. Shapes, colours, grids." },
  { id: "user-jonas", name: "Jonas Weber", username: "jonas.wbr", email: "jonas@snapgram.dev", daysAgo: 35,
    bio: "Trail running and long weekends outside." },
];

const posts = [
  { id: "post-mountain", creator: "user-mia", image: "mountain-sunset.svg", hoursAgo: 3,
    caption: "Golden hour above the clouds. Worth every step of that climb.", location: "Zermatt, Switzerland",
    tags: ["mountains", "sunset", "hiking"], likes: ["user-noah", "user-lea", "user-jonas"] },
  { id: "post-city", creator: "user-noah", image: "city-night.svg", hoursAgo: 7,
    caption: "Same skyline, new lights every night.", location: "Zürich",
    tags: ["city", "night", "lights"], likes: ["user-mia", "user-alex"] },
  { id: "post-art", creator: "user-lea", image: "geometric-art.svg", hoursAgo: 20,
    caption: "Playing with circles again. Bauhaus never gets old.", location: "Basel",
    tags: ["art", "design", "bauhaus"], likes: ["user-mia", "user-noah", "user-jonas", "user-alex"] },
  { id: "post-forest", creator: "user-jonas", image: "forest-fog.svg", hoursAgo: 30,
    caption: "Morning fog in the forest and nobody else around.", location: "Uetliberg",
    tags: ["forest", "trailrun", "morning"], likes: ["user-mia", "user-alex"] },
  { id: "post-coffee", creator: "user-noah", image: "coffee.svg", hoursAgo: 52,
    caption: "Flat white and a slow Sunday.", location: "Bern",
    tags: ["coffee", "sunday"], likes: ["user-lea"] },
  { id: "post-lake", creator: "user-mia", image: "lake-boat.svg", hoursAgo: 75,
    caption: "First boat out on the lake this morning.", location: "Lake Lucerne",
    tags: ["lake", "sunrise", "boat"], likes: ["user-jonas", "user-noah"] },
  { id: "post-cactus", creator: "user-lea", image: "cactus.svg", hoursAgo: 98,
    caption: "Tiny desk friend. It needs water once a month, I need coffee every hour.", location: "Basel",
    tags: ["plants", "studio"], likes: ["user-mia"] },
  { id: "post-desert", creator: "user-jonas", image: "desert.svg", hoursAgo: 140,
    caption: "Dunes, wind and absolutely no signal.", location: "Merzouga, Morocco",
    tags: ["travel", "desert"], likes: ["user-lea", "user-noah", "user-mia"] },
  { id: "post-waves", creator: "user-alex", image: "ocean-waves.svg", hoursAgo: 220,
    caption: "My first post on Snapgram. Hello world! 👋", location: "Zürich",
    tags: ["hello", "firstpost"], likes: ["user-mia"] },
];

const saves = [
  { id: "save-1", user: "user-alex", post: "post-mountain", hoursAgo: 1 },
  { id: "save-2", user: "user-alex", post: "post-coffee", hoursAgo: 2 },
];

// [follower, following]
const follows = [
  ["user-alex", "user-mia"], ["user-alex", "user-lea"],
  ["user-mia", "user-noah"], ["user-mia", "user-lea"], ["user-mia", "user-alex"],
  ["user-noah", "user-mia"], ["user-noah", "user-jonas"],
  ["user-lea", "user-mia"], ["user-lea", "user-alex"],
  ["user-jonas", "user-mia"], ["user-jonas", "user-noah"], ["user-jonas", "user-lea"],
];

const ago = (hours: number) => `now() - make_interval(mins => ${Math.round(hours * 60)})`;

/** SQL statements that (optionally) empty all tables and insert the sample data. */
export async function seedStatements({ wipe = false } = {}): Promise<Statement[]> {
  const demoPasswordHash = await hashPassword(DEMO_PASSWORD);
  const statements: Statement[] = [];

  if (wipe) {
    // order matters because of the foreign keys
    for (const table of ["sessions", "follows", "saves", "likes", "posts", "images", "users"]) {
      statements.push({ text: `delete from ${table}` });
    }
  }

  for (const user of users) {
    statements.push({
      text: `insert into users (id, name, username, email, password_hash, bio, image_url, created_at, updated_at)
             values ($1, $2, $3, $4, $5, $6, $7, ${ago(user.daysAgo * 24)}, ${ago(user.daysAgo * 24)})`,
      params: [user.id, user.name, user.username, user.email, user.demo ? demoPasswordHash : null, user.bio, initialsAvatar(user.name)],
    });
  }

  for (const post of posts) {
    statements.push({
      text: `insert into posts (id, creator_id, caption, location, tags, image_url, created_at, updated_at)
             values ($1, $2, $3, $4, array(select json_array_elements_text($5::json)), $6, ${ago(post.hoursAgo)}, ${ago(post.hoursAgo)})`,
      params: [post.id, post.creator, post.caption, post.location, JSON.stringify(post.tags), `/demo/posts/${post.image}`],
    });
    for (const userId of post.likes) {
      statements.push({ text: `insert into likes (user_id, post_id) values ($1, $2)`, params: [userId, post.id] });
    }
  }

  for (const save of saves) {
    statements.push({
      text: `insert into saves (id, user_id, post_id, created_at) values ($1, $2, $3, ${ago(save.hoursAgo)})`,
      params: [save.id, save.user, save.post],
    });
  }

  for (const [follower, following] of follows) {
    statements.push({
      text: `insert into follows (follower_id, following_id) values ($1, $2)`,
      params: [follower, following],
    });
  }

  return statements;
}

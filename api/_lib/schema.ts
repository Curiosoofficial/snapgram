// Database tables. "if not exists" makes it safe to run on every cold start.
// Images are stored as base64 text in Postgres to keep the setup to ONE
// service (Neon). A bigger app would use object storage (S3, Vercel Blob, …).

export const SCHEMA = [
  `create table if not exists meta (
    key text primary key,
    value text not null
  )`,

  `create table if not exists users (
    id text primary key,
    name text not null,
    username text not null,
    email text not null unique,
    password_hash text,
    bio text not null default '',
    image_url text not null default '',
    image_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create unique index if not exists users_username_idx on users (lower(username))`,

  `create table if not exists sessions (
    token_hash text primary key,
    user_id text not null references users(id) on delete cascade,
    expires_at timestamptz not null
  )`,

  `create table if not exists images (
    id text primary key,
    owner_id text references users(id) on delete cascade,
    content_type text not null,
    data text not null,
    created_at timestamptz not null default now()
  )`,

  `create table if not exists posts (
    id text primary key,
    creator_id text not null references users(id) on delete cascade,
    caption text not null,
    location text not null default '',
    tags text[] not null default '{}',
    image_url text not null,
    image_id text references images(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create index if not exists posts_created_idx on posts (created_at desc)`,
  `create index if not exists posts_updated_idx on posts (updated_at desc, id desc)`,
  `create index if not exists posts_creator_idx on posts (creator_id)`,

  `create table if not exists likes (
    user_id text not null references users(id) on delete cascade,
    post_id text not null references posts(id) on delete cascade,
    primary key (user_id, post_id)
  )`,
  `create index if not exists likes_post_idx on likes (post_id)`,

  `create table if not exists saves (
    id text primary key,
    user_id text not null references users(id) on delete cascade,
    post_id text not null references posts(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (user_id, post_id)
  )`,

  // follower_id follows following_id; nobody can follow themselves
  `create table if not exists follows (
    follower_id text not null references users(id) on delete cascade,
    following_id text not null references users(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (follower_id, following_id),
    check (follower_id <> following_id)
  )`,
  `create index if not exists follows_following_idx on follows (following_id)`,
];

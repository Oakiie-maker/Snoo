/*
# Stories and Reels

1. New Tables
- `stories`: ephemeral status posts that auto-expire after 24 hours. Columns: id, author_id (uuid default auth.uid()), media_url (text), media_type (image|video), caption (text, optional), created_at. Rows older than 24h are filtered out at read time and cleaned up via a periodic delete (app-side; no scheduled job needed for correctness because reads filter by age).
- `story_views`: one row per user who viewed a story. Columns: story_id, user_id (default auth.uid()), created_at. Composite PK (story_id, user_id). Used to show "seen by" counts and the unread ring.
- `reels`: short vertical videos. Columns: id, author_id (default auth.uid()), video_url (text), caption (text), audio_label (text optional, e.g. "Original Audio - @username"), created_at.

2. Security (RLS)
- stories: anyone authenticated can read; insert/update/delete only own.
- story_views: anyone authenticated can read; insert only own (user_id = auth.uid()); delete only own.
- reels: anyone authenticated can read; insert only own; update/delete only own.
3. Indexes
- stories.author_id, stories.created_at
- story_views.story_id, story_views.user_id
- reels.created_at, reels.author_id
4. Notes
- Reels reuse the existing reactions/comments/shares tables by reusing a polymorphic-style approach: we add an optional `reel_id` column to reactions, comments, shares. To keep it simple and avoid altering existing tables, reels instead get their own lightweight reaction table `reel_reactions` and comment table `reel_comments`. This avoids touching existing post-related tables.
- Actually, to minimize surface area, reels reuse the same reactions/comments/shares? No — to keep the schema clean and avoid nullable FKs on existing tables, we add separate `reel_reactions` and `reel_comments` tables. Shares for reels copy a link, same as posts, so we add `reel_shares`.
*/

CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image','video')),
  caption text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stories_read_all" ON stories;
CREATE POLICY "stories_read_all" ON stories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "stories_insert_own" ON stories;
CREATE POLICY "stories_insert_own" ON stories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "stories_delete_own" ON stories;
CREATE POLICY "stories_delete_own" ON stories FOR DELETE
  TO authenticated USING (auth.uid() = author_id);

CREATE INDEX IF NOT EXISTS idx_stories_author_id ON stories(author_id);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at DESC);

CREATE TABLE IF NOT EXISTS story_views (
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "story_views_read_all" ON story_views;
CREATE POLICY "story_views_read_all" ON story_views FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "story_views_insert_own" ON story_views;
CREATE POLICY "story_views_insert_own" ON story_views FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "story_views_delete_own" ON story_views;
CREATE POLICY "story_views_delete_own" ON story_views FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_story_views_story_id ON story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_user_id ON story_views(user_id);

CREATE TABLE IF NOT EXISTS reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  caption text NOT NULL DEFAULT '',
  audio_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reels_read_all" ON reels;
CREATE POLICY "reels_read_all" ON reels FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "reels_insert_own" ON reels;
CREATE POLICY "reels_insert_own" ON reels FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "reels_update_own" ON reels;
CREATE POLICY "reels_update_own" ON reels FOR UPDATE
  TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "reels_delete_own" ON reels;
CREATE POLICY "reels_delete_own" ON reels FOR DELETE
  TO authenticated USING (auth.uid() = author_id);

CREATE INDEX IF NOT EXISTS idx_reels_created_at ON reels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reels_author_id ON reels(author_id);

CREATE TABLE IF NOT EXISTS reel_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('heart','fire','laugh','wow','clap')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reel_id, user_id, emoji)
);

ALTER TABLE reel_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reel_reactions_read_all" ON reel_reactions;
CREATE POLICY "reel_reactions_read_all" ON reel_reactions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "reel_reactions_insert_own" ON reel_reactions;
CREATE POLICY "reel_reactions_insert_own" ON reel_reactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reel_reactions_delete_own" ON reel_reactions;
CREATE POLICY "reel_reactions_delete_own" ON reel_reactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reel_reactions_reel_id ON reel_reactions(reel_id);

CREATE TABLE IF NOT EXISTS reel_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reel_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reel_comments_read_all" ON reel_comments;
CREATE POLICY "reel_comments_read_all" ON reel_comments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "reel_comments_insert_own" ON reel_comments;
CREATE POLICY "reel_comments_insert_own" ON reel_comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reel_comments_delete_own" ON reel_comments;
CREATE POLICY "reel_comments_delete_own" ON reel_comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reel_comments_reel_id ON reel_comments(reel_id);

CREATE TABLE IF NOT EXISTS reel_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reel_id, user_id)
);

ALTER TABLE reel_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reel_shares_read_all" ON reel_shares;
CREATE POLICY "reel_shares_read_all" ON reel_shares FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "reel_shares_insert_own" ON reel_shares;
CREATE POLICY "reel_shares_insert_own" ON reel_shares FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reel_shares_reel_id ON reel_shares(reel_id);

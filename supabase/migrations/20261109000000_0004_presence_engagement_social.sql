/*
# Presence, Engagement Analytics & Social Graph Expansion

1. Profile Updates
- `last_seen`: timestamptz nullable default now()
- `is_online`: boolean default false
- `show_online_status`: boolean default true

2. Post & Reel Views (Impressions & Duration)
- `post_views`: tracks unique viewers, duration, impressions
- `reel_views`: tracks reel video impressions and duration

3. Post & Reel Saves (Bookmarks)
- `post_saves`: bookmarks on posts
- `reel_saves`: bookmarks on reels

4. Follows Enhancements
- Support for `following_id` (mirrored to `followee_id`) for relationship queries
- Mutual connections lookup helper view / indexes

5. Security (RLS)
- Profiles: allow users to update their own `last_seen`, `is_online`, `show_online_status`
- Post views & Reel views: authenticated users can insert view records; authors can read aggregate insights
- Post saves & Reel saves: users can insert/delete their own saves, read their own saves
*/

-- 1. Extend profiles table with presence and privacy
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_online_status boolean DEFAULT true;

-- 2. Post Views & Impressions
CREATE TABLE IF NOT EXISTS post_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  duration_ms integer DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_views_read_all" ON post_views;
CREATE POLICY "post_views_read_all" ON post_views FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "post_views_insert_own" ON post_views;
CREATE POLICY "post_views_insert_own" ON post_views FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_user_id ON post_views(user_id);

-- 3. Reel Views
CREATE TABLE IF NOT EXISTS reel_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  duration_ms integer DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reel_id, user_id)
);

ALTER TABLE reel_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reel_views_read_all" ON reel_views;
CREATE POLICY "reel_views_read_all" ON reel_views FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "reel_views_insert_own" ON reel_views;
CREATE POLICY "reel_views_insert_own" ON reel_views FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reel_views_reel_id ON reel_views(reel_id);

-- 4. Post Saves / Bookmarks
CREATE TABLE IF NOT EXISTS post_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE post_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_saves_read_own" ON post_saves;
CREATE POLICY "post_saves_read_own" ON post_saves FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "post_saves_insert_own" ON post_saves;
CREATE POLICY "post_saves_insert_own" ON post_saves FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "post_saves_delete_own" ON post_saves;
CREATE POLICY "post_saves_delete_own" ON post_saves FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_post_saves_post_id ON post_saves(post_id);
CREATE INDEX IF NOT EXISTS idx_post_saves_user_id ON post_saves(user_id);

-- 5. Reel Saves / Bookmarks
CREATE TABLE IF NOT EXISTS reel_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reel_id, user_id)
);

ALTER TABLE reel_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reel_saves_read_own" ON reel_saves;
CREATE POLICY "reel_saves_read_own" ON reel_saves FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reel_saves_insert_own" ON reel_saves;
CREATE POLICY "reel_saves_insert_own" ON reel_saves FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reel_saves_delete_own" ON reel_saves;
CREATE POLICY "reel_saves_delete_own" ON reel_saves FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reel_saves_reel_id ON reel_saves(reel_id);

-- 6. Follows table index and compatibility column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='follows' AND column_name='following_id'
  ) THEN
    ALTER TABLE follows ADD COLUMN following_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    UPDATE follows SET following_id = followee_id WHERE following_id IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);

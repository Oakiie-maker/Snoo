/*
# Monetization, Ad System, Live Media, Spaces & Security Expansion

1. Ads & Ad Analytics
- `ads`: campaign title, media_url, media_type, target_link, cta_text, budget, status, target_demographics, impressions, clicks.
- `ad_analytics`: event logging for daily impressions and click-through rates.

2. Creator Monetization, Paid Partnerships & Paywalls
- Add `is_subscribers_only` to `posts` and `stories`
- Add `paid_partnership_brand` to `posts` and `reels`
- `subscriptions`: subscriber_id, creator_id, tier ('bronze' | 'silver' | 'gold'), created_at
- `tips`: sender_id, creator_id, amount, message, created_at

3. Live Streams & Audio Spaces
- `live_streams`: creator_id, title, stream_url, status ('live' | 'ended'), viewer_count, created_at
- `live_messages`: stream_id, user_id, body, is_pinned, created_at
- `audio_spaces`: host_id, title, topic, status ('active' | 'ended'), speakers, hand_raises, listener_count, created_at

4. Privacy, Account Lists & Message Encryption
- `account_lists`: user_id, target_user_id, list_type ('close_friends' | 'favorites' | 'muted'), created_at
- Add `is_encrypted` to `messages`
*/

-- 1. Extend posts, reels and stories
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_subscribers_only boolean DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS paid_partnership_brand text;

ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_subscribers_only boolean DEFAULT false;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS paid_partnership_brand text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_encrypted boolean DEFAULT false;

-- 2. Ads table
CREATE TABLE IF NOT EXISTS ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  caption text NOT NULL DEFAULT '',
  media_url text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image','video')),
  target_link text NOT NULL,
  cta_text text NOT NULL DEFAULT 'Learn More',
  budget numeric(10,2) NOT NULL DEFAULT 50.00,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  target_demographics text DEFAULT 'All Creators & Audiences',
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ads_read_all" ON ads;
CREATE POLICY "ads_read_all" ON ads FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "ads_manage_own" ON ads;
CREATE POLICY "ads_manage_own" ON ads FOR ALL
  TO authenticated USING (auth.uid() = advertiser_id) WITH CHECK (auth.uid() = advertiser_id);

CREATE INDEX IF NOT EXISTS idx_ads_advertiser ON ads(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status);

-- Ad Analytics
CREATE TABLE IF NOT EXISTS ad_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('impression','click')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ad_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_analytics_read" ON ad_analytics;
CREATE POLICY "ad_analytics_read" ON ad_analytics FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM ads a WHERE a.id = ad_id AND a.advertiser_id = auth.uid())
  );

DROP POLICY IF EXISTS "ad_analytics_insert" ON ad_analytics;
CREATE POLICY "ad_analytics_insert" ON ad_analytics FOR INSERT
  TO authenticated WITH CHECK (true);

-- 3. Subscriptions & Supporter Tiers
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('bronze','silver','gold')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id, creator_id)
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_read" ON subscriptions;
CREATE POLICY "subscriptions_read" ON subscriptions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "subscriptions_manage" ON subscriptions;
CREATE POLICY "subscriptions_manage" ON subscriptions FOR ALL
  TO authenticated USING (auth.uid() = subscriber_id) WITH CHECK (auth.uid() = subscriber_id);

-- 4. Fan Tips
CREATE TABLE IF NOT EXISTS tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  message text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tips_read" ON tips;
CREATE POLICY "tips_read" ON tips FOR SELECT
  TO authenticated USING (auth.uid() = sender_id OR auth.uid() = creator_id);

DROP POLICY IF EXISTS "tips_insert" ON tips;
CREATE POLICY "tips_insert" ON tips FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id);

-- 5. Live Streams & Live Messages
CREATE TABLE IF NOT EXISTS live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  stream_url text NOT NULL,
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live','ended')),
  viewer_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_streams_read" ON live_streams;
CREATE POLICY "live_streams_read" ON live_streams FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "live_streams_manage" ON live_streams;
CREATE POLICY "live_streams_manage" ON live_streams FOR ALL
  TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

CREATE TABLE IF NOT EXISTS live_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE live_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_messages_read" ON live_messages;
CREATE POLICY "live_messages_read" ON live_messages FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "live_messages_insert" ON live_messages;
CREATE POLICY "live_messages_insert" ON live_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- 6. Audio Spaces
CREATE TABLE IF NOT EXISTS audio_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  topic text NOT NULL DEFAULT 'General Discussion',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  listener_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audio_spaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audio_spaces_read" ON audio_spaces;
CREATE POLICY "audio_spaces_read" ON audio_spaces FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "audio_spaces_manage" ON audio_spaces;
CREATE POLICY "audio_spaces_manage" ON audio_spaces FOR ALL
  TO authenticated USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

-- 7. Account Lists (Close Friends, Favorites, Muted)
CREATE TABLE IF NOT EXISTS account_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_type text NOT NULL CHECK (list_type IN ('close_friends','favorites','muted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_user_id, list_type)
);

ALTER TABLE account_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_lists_manage" ON account_lists;
CREATE POLICY "account_lists_manage" ON account_lists FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if valid URL is configured
const hasValidSupabaseConfig = Boolean(
  envUrl &&
    envAnonKey &&
    envUrl !== 'undefined' &&
    envAnonKey !== 'undefined' &&
    envUrl.startsWith('http'),
);

/* ------------------------------------------------------------------ */
/* Mock Data & In-Memory / LocalStorage Engine for AI Studio Runtime  */
/* ------------------------------------------------------------------ */

interface MockStore {
  profiles: any[];
  posts: any[];
  post_collaborators: any[];
  reactions: any[];
  comments: any[];
  shares: any[];
  post_views: any[];
  post_saves: any[];
  follows: any[];
  messages: any[];
  stories: any[];
  story_views: any[];
  reels: any[];
  reel_reactions: any[];
  reel_comments: any[];
  reel_shares: any[];
  reel_views: any[];
  reel_saves: any[];
  ads: any[];
  ad_analytics: any[];
  subscriptions: any[];
  tips: any[];
  live_streams: any[];
  live_messages: any[];
  audio_spaces: any[];
  account_lists: any[];
  currentUser: any;
}

const STORAGE_KEY = 'creators_app_db_v3';

function getInitialStore(): MockStore {
  const now = Date.now();
  const ago = (minutes: number) => new Date(now - minutes * 60 * 1000).toISOString();

  const alexId = 'u_alex_001';
  const mayaId = 'u_maya_002';
  const liamId = 'u_liam_003';
  const elenaId = 'u_elena_004';
  const samId = 'u_sam_005';
  const brandSonyId = 'u_sony_creator';

  const defaultUser = {
    id: alexId,
    email: 'alex@creator.studio',
    user_metadata: { username: 'alexrivera' },
  };

  const profiles = [
    {
      id: alexId,
      username: 'alexrivera',
      full_name: 'Alex Rivera',
      bio: 'Visual artist & Creative Director based in SF. Exploring light, 3D typography, and human-computer interactions ⚡️',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      created_at: ago(43200),
      last_seen: new Date().toISOString(),
      is_online: true,
      show_online_status: true,
      total_tips_received: 285.0,
    },
    {
      id: mayaId,
      username: 'mayachen',
      full_name: 'Maya Chen',
      bio: 'Film director & photographer 📸 Capturing neon cityscapes and raw human emotions.',
      avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
      created_at: ago(30000),
      last_seen: ago(4),
      is_online: true,
      show_online_status: true,
      total_tips_received: 520.0,
    },
    {
      id: liamId,
      username: 'liamvance',
      full_name: 'Liam Vance',
      bio: 'Music producer & sound designer 🎹 Synthesizers, tape saturation, and ambient grooves.',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
      created_at: ago(25000),
      last_seen: ago(18),
      is_online: false,
      show_online_status: true,
      total_tips_received: 140.0,
    },
    {
      id: elenaId,
      username: 'elenarostova',
      full_name: 'Elena Rostova',
      bio: 'UI/UX systems architect & generative art enthusiast. Building future interfaces.',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
      created_at: ago(20000),
      last_seen: ago(120),
      is_online: false,
      show_online_status: true,
      total_tips_received: 310.0,
    },
    {
      id: samId,
      username: 'samtaylor',
      full_name: 'Sam Taylor',
      bio: 'Documentary maker & coffee drinker ☕️ On the road making films about craftsmen.',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
      created_at: ago(15000),
      last_seen: ago(2880),
      is_online: false,
      show_online_status: true,
      total_tips_received: 90.0,
    },
    {
      id: brandSonyId,
      username: 'sonycine',
      full_name: 'Sony Cine Studio',
      bio: 'Official cinema cameras & lenses gear for next-generation visual storytellers. #SonyAlpha',
      avatar_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&auto=format&fit=crop&q=80',
      created_at: ago(50000),
      last_seen: ago(10),
      is_online: true,
      show_online_status: true,
      is_verified: true,
    },
  ];

  const posts = [
    {
      id: 'post_1',
      author_id: alexId,
      caption: 'Wrapped up our latest kinetic typography installation for the Tokyo Design Week! Grateful for the incredible team that pushed the boundaries of real-time shaders ✨ What do you think of this contrast?',
      media_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
      media_type: 'image',
      created_at: ago(120),
      is_subscribers_only: false,
      paid_partnership_brand: null,
    },
    {
      id: 'post_2',
      author_id: mayaId,
      caption: 'Midnight golden hour in Shibuya. When rain meets neon reflections, Tokyo turns into a live-action cyberpunk canvas 🌧️🏮 Shot on 35mm f/1.4',
      media_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=80',
      media_type: 'image',
      created_at: ago(360),
      is_subscribers_only: false,
      paid_partnership_brand: 'Sony Cine Studio',
    },
    {
      id: 'post_3',
      author_id: liamId,
      caption: 'Analog oscillators warmth hit different today. Recording the final stem mix for the upcoming vinyl EP. Turn the headphones all the way up 🎧',
      media_url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&auto=format&fit=crop&q=80',
      media_type: 'image',
      created_at: ago(720),
      is_subscribers_only: true, // Paywalled post!
      paid_partnership_brand: null,
    },
    {
      id: 'post_4',
      author_id: elenaId,
      caption: 'Designed a new glassmorphic fluid dashboard for spatial audio controls. Clean typography and subtle haptics makes all the difference in modern web apps 📐',
      media_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&auto=format&fit=crop&q=80',
      media_type: 'image',
      created_at: ago(1440),
      is_subscribers_only: false,
      paid_partnership_brand: null,
    },
  ];

  const post_collaborators = [
    { post_id: 'post_1', user_id: mayaId, created_at: ago(120) },
  ];

  const reactions = [
    { id: 'rx_1', post_id: 'post_1', user_id: mayaId, emoji: 'heart', created_at: ago(100) },
    { id: 'rx_2', post_id: 'post_1', user_id: liamId, emoji: 'fire', created_at: ago(80) },
    { id: 'rx_3', post_id: 'post_1', user_id: elenaId, emoji: 'clap', created_at: ago(60) },
    { id: 'rx_4', post_id: 'post_1', user_id: samId, emoji: 'wow', created_at: ago(40) },
    { id: 'rx_5', post_id: 'post_2', user_id: alexId, emoji: 'fire', created_at: ago(300) },
    { id: 'rx_6', post_id: 'post_2', user_id: liamId, emoji: 'heart', created_at: ago(250) },
    { id: 'rx_7', post_id: 'post_2', user_id: elenaId, emoji: 'fire', created_at: ago(200) },
    { id: 'rx_8', post_id: 'post_3', user_id: alexId, emoji: 'clap', created_at: ago(600) },
    { id: 'rx_9', post_id: 'post_3', user_id: mayaId, emoji: 'fire', created_at: ago(500) },
    { id: 'rx_10', post_id: 'post_4', user_id: alexId, emoji: 'heart', created_at: ago(1000) },
    { id: 'rx_11', post_id: 'post_4', user_id: liamId, emoji: 'laugh', created_at: ago(900) },
  ];

  const comments = [
    {
      id: 'c_1',
      post_id: 'post_1',
      user_id: mayaId,
      body: 'The color grading in the ambient glows is phenomenal! So happy we collaborated on this 🔥',
      created_at: ago(90),
    },
    {
      id: 'c_2',
      post_id: 'post_1',
      user_id: elenaId,
      body: 'Insane physics simulation. How many polygons did that shader render per frame?',
      created_at: ago(50),
    },
    {
      id: 'c_3',
      post_id: 'post_2',
      user_id: alexId,
      body: 'That reflection in the puddle makes the composition pop! Masterclass shot 🌧️',
      created_at: ago(290),
    },
  ];

  const shares = [
    { id: 'sh_1', post_id: 'post_1', user_id: mayaId, created_at: ago(90) },
    { id: 'sh_2', post_id: 'post_1', user_id: liamId, created_at: ago(70) },
    { id: 'sh_3', post_id: 'post_2', user_id: alexId, created_at: ago(280) },
  ];

  const post_views = [
    { id: 'pv_1', post_id: 'post_1', user_id: mayaId, duration_ms: 3200, created_at: ago(100) },
    { id: 'pv_2', post_id: 'post_1', user_id: liamId, duration_ms: 4500, created_at: ago(95) },
    { id: 'pv_3', post_id: 'post_1', user_id: elenaId, duration_ms: 2800, created_at: ago(90) },
    { id: 'pv_4', post_id: 'post_1', user_id: samId, duration_ms: 6000, created_at: ago(85) },
    { id: 'pv_5', post_id: 'post_2', user_id: alexId, duration_ms: 5000, created_at: ago(310) },
    { id: 'pv_6', post_id: 'post_2', user_id: liamId, duration_ms: 4200, created_at: ago(300) },
    { id: 'pv_7', post_id: 'post_2', user_id: elenaId, duration_ms: 3100, created_at: ago(280) },
    { id: 'pv_8', post_id: 'post_3', user_id: alexId, duration_ms: 6200, created_at: ago(650) },
    { id: 'pv_9', post_id: 'post_4', user_id: alexId, duration_ms: 4800, created_at: ago(1100) },
  ];

  const post_saves = [
    { id: 'ps_1', post_id: 'post_1', user_id: mayaId, created_at: ago(90) },
    { id: 'ps_2', post_id: 'post_1', user_id: elenaId, created_at: ago(80) },
    { id: 'ps_3', post_id: 'post_2', user_id: alexId, created_at: ago(270) },
  ];

  const follows = [
    { follower_id: alexId, followee_id: mayaId, following_id: mayaId, created_at: ago(10000) },
    { follower_id: mayaId, followee_id: alexId, following_id: alexId, created_at: ago(9500) },
    { follower_id: alexId, followee_id: liamId, following_id: liamId, created_at: ago(8000) },
    { follower_id: liamId, followee_id: alexId, following_id: alexId, created_at: ago(7500) },
    { follower_id: alexId, followee_id: elenaId, following_id: elenaId, created_at: ago(6000) },
    { follower_id: elenaId, followee_id: alexId, following_id: alexId, created_at: ago(5500) },
    { follower_id: samId, followee_id: alexId, following_id: alexId, created_at: ago(4000) },
    { follower_id: mayaId, followee_id: liamId, following_id: liamId, created_at: ago(3000) },
    { follower_id: elenaId, followee_id: mayaId, following_id: mayaId, created_at: ago(2500) },
  ];

  const messages = [
    {
      id: 'm_1',
      sender_id: mayaId,
      recipient_id: alexId,
      body: 'Hey Alex! Loved the latest installation preview. Are we still good for the joint studio live stream this Friday?',
      created_at: ago(15),
      read_at: null,
      is_encrypted: true,
    },
    {
      id: 'm_2',
      sender_id: alexId,
      recipient_id: mayaId,
      body: 'Yes definitely! Let us test audio routing tomorrow at 2 PM.',
      created_at: ago(10),
      read_at: ago(9),
      is_encrypted: true,
    },
    {
      id: 'm_3',
      sender_id: liamId,
      recipient_id: alexId,
      body: 'Sent over the lossless stems for the teaser reel 🎛️ Check your drive!',
      created_at: ago(120),
      read_at: ago(60),
      is_encrypted: false,
    },
  ];

  const stories = [
    {
      id: 'st_1',
      author_id: alexId,
      media_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80',
      media_type: 'image',
      caption: 'Studio setup test run! Loving the warm daylight glow ✨',
      created_at: ago(180),
      is_subscribers_only: false,
    },
    {
      id: 'st_2',
      author_id: mayaId,
      media_url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&auto=format&fit=crop&q=80',
      media_type: 'image',
      caption: 'Behind the scenes at sunrise 🎥🌅 (Exclusive unreleased teaser)',
      created_at: ago(240),
      is_subscribers_only: true, // Paywalled story!
    },
    {
      id: 'st_3',
      author_id: liamId,
      media_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
      media_type: 'image',
      caption: 'Fresh drum breaks sampled today 🥁',
      created_at: ago(360),
      is_subscribers_only: false,
    },
  ];

  const story_views = [
    { story_id: 'st_1', user_id: mayaId, created_at: ago(150) },
    { story_id: 'st_1', user_id: liamId, created_at: ago(120) },
    { story_id: 'st_1', user_id: elenaId, created_at: ago(90) },
    { story_id: 'st_2', user_id: alexId, created_at: ago(200) },
  ];

  const reels = [
    {
      id: 'reel_1',
      author_id: mayaId,
      video_url: 'https://assets.mixkit.co/videos/preview/mixkit-vertical-view-of-a-neon-sign-in-the-rain-41525-large.mp4',
      caption: 'Tokyo rain & neon reflections in slow motion. Turn on sound! 🌧️🗼',
      audio_label: 'Original Sound - @mayachen (Shinjuku Lo-Fi)',
      created_at: ago(400),
      paid_partnership_brand: 'Sony Cine Studio',
    },
    {
      id: 'reel_2',
      author_id: alexId,
      video_url: 'https://assets.mixkit.co/videos/preview/mixkit-color-powder-explosion-in-the-air-42353-large.mp4',
      caption: 'High-speed 1000fps pigment impact test for the new album visualizer 💥🎨',
      audio_label: 'Electronic Pulse - @liamvance',
      created_at: ago(800),
      paid_partnership_brand: null,
    },
  ];

  const reel_reactions = [
    { id: 'rr_1', reel_id: 'reel_1', user_id: alexId, emoji: 'heart', created_at: ago(350) },
    { id: 'rr_2', reel_id: 'reel_1', user_id: liamId, emoji: 'fire', created_at: ago(320) },
    { id: 'rr_3', reel_id: 'reel_2', user_id: mayaId, emoji: 'fire', created_at: ago(700) },
  ];

  const reel_comments = [
    {
      id: 'rc_1',
      reel_id: 'reel_1',
      user_id: alexId,
      body: 'That frame rate is silky smooth! What camera did you use?',
      created_at: ago(340),
    },
  ];

  const reel_shares = [
    { id: 'rs_1', reel_id: 'reel_1', user_id: alexId, created_at: ago(330) },
  ];

  const reel_views = [
    { id: 'rv_1', reel_id: 'reel_1', user_id: alexId, duration_ms: 7000, created_at: ago(360) },
    { id: 'rv_2', reel_id: 'reel_1', user_id: liamId, duration_ms: 5500, created_at: ago(340) },
    { id: 'rv_3', reel_id: 'reel_2', user_id: mayaId, duration_ms: 6200, created_at: ago(720) },
  ];

  const reel_saves = [
    { id: 'rsv_1', reel_id: 'reel_1', user_id: alexId, created_at: ago(320) },
  ];

  /* ------------------------------------------------------------------ */
  /* Native Ads & Sponsored Content                                     */
  /* ------------------------------------------------------------------ */
  const ads = [
    {
      id: 'ad_sony_fx3',
      advertiser_id: brandSonyId,
      title: 'Sony FX3 Cinema Line Full-Frame Camera',
      caption: 'Engineered for solo creators and visionary filmmakers. 4K 120p, 15+ stops of dynamic range, and active internal cooling. Elevate your creative vision today.',
      media_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1200&auto=format&fit=crop&q=80',
      media_type: 'image',
      target_link: 'https://sony.com/cinema-line-fx3',
      cta_text: 'Shop Now',
      budget: 1500.0,
      status: 'active',
      target_demographics: 'Filmmakers, Video Editors & Photographers',
      impressions: 4820,
      clicks: 342,
      created_at: ago(2880),
    },
    {
      id: 'ad_teenage_synth',
      advertiser_id: brandSonyId,
      title: 'OP-1 Field Portable Synthesizer & Sampler',
      caption: '100+ new features, stereo signal chain throughout, 24-hour battery life, and high-resolution glass display. Craft music anywhere inspiration strikes.',
      media_url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&auto=format&fit=crop&q=80',
      media_type: 'image',
      target_link: 'https://teenage.engineering/products/op-1',
      cta_text: 'Explore Gear',
      budget: 850.0,
      status: 'active',
      target_demographics: 'Music Producers, Audio Engineers & Beatmakers',
      impressions: 3190,
      clicks: 215,
      created_at: ago(1440),
    },
  ];

  const ad_analytics = [
    { id: 'aa_1', ad_id: 'ad_sony_fx3', event_type: 'impression', user_id: alexId, created_at: ago(60) },
    { id: 'aa_2', ad_id: 'ad_sony_fx3', event_type: 'click', user_id: alexId, created_at: ago(55) },
    { id: 'aa_3', ad_id: 'ad_teenage_synth', event_type: 'impression', user_id: mayaId, created_at: ago(30) },
  ];

  /* ------------------------------------------------------------------ */
  /* Subscriptions & Tips                                               */
  /* ------------------------------------------------------------------ */
  const subscriptions = [
    {
      id: 'sub_1',
      subscriber_id: alexId,
      creator_id: mayaId,
      tier: 'silver',
      created_at: ago(15000),
    },
    {
      id: 'sub_2',
      subscriber_id: mayaId,
      creator_id: alexId,
      tier: 'gold',
      created_at: ago(12000),
    },
  ];

  const tips = [
    {
      id: 'tip_1',
      sender_id: alexId,
      creator_id: mayaId,
      amount: 25.0,
      message: 'Keep creating phenomenal work! Tokyo series is breathtaking ☕️',
      created_at: ago(400),
    },
    {
      id: 'tip_2',
      sender_id: liamId,
      creator_id: alexId,
      amount: 15.0,
      message: 'Loved your kinetic typography breakdown! Super helpful ⚡️',
      created_at: ago(600),
    },
  ];

  /* ------------------------------------------------------------------ */
  /* Live Streams & Audio Spaces                                        */
  /* ------------------------------------------------------------------ */
  const live_streams = [
    {
      id: 'live_1',
      creator_id: mayaId,
      title: 'Neon Nightwalk in Shinjuku 4K 🎥 Live Color Grading Q&A',
      stream_url: 'https://assets.mixkit.co/videos/preview/mixkit-vertical-view-of-a-neon-sign-in-the-rain-41525-large.mp4',
      status: 'live',
      viewer_count: 84,
      created_at: ago(25),
    },
  ];

  const live_messages = [
    {
      id: 'lm_1',
      stream_id: 'live_1',
      user_id: alexId,
      body: 'The neon blue highlight roll-off looks cinematic! 🎨',
      is_pinned: true,
      created_at: ago(10),
    },
    {
      id: 'lm_2',
      stream_id: 'live_1',
      user_id: liamId,
      body: 'Can you share what LUT you are monitoring with?',
      is_pinned: false,
      created_at: ago(5),
    },
    {
      id: 'lm_3',
      stream_id: 'live_1',
      user_id: elenaId,
      body: 'Such clean low-light performance! 🚀',
      is_pinned: false,
      created_at: ago(2),
    },
  ];

  const audio_spaces = [
    {
      id: 'space_1',
      host_id: liamId,
      title: 'Sound Design & Spatial Audio for 3D Worlds 🎧',
      topic: 'Music & Creative Tech',
      status: 'active',
      listener_count: 36,
      created_at: ago(45),
    },
  ];

  /* ------------------------------------------------------------------ */
  /* Account Lists (Close Friends, Favorites, Muted)                    */
  /* ------------------------------------------------------------------ */
  const account_lists = [
    { id: 'al_1', user_id: alexId, target_user_id: mayaId, list_type: 'close_friends', created_at: ago(5000) },
    { id: 'al_2', user_id: alexId, target_user_id: liamId, list_type: 'favorites', created_at: ago(5000) },
    { id: 'al_3', user_id: alexId, target_user_id: elenaId, list_type: 'favorites', created_at: ago(4000) },
  ];

  return {
    profiles,
    posts,
    post_collaborators,
    reactions,
    comments,
    shares,
    post_views,
    post_saves,
    follows,
    messages,
    stories,
    story_views,
    reels,
    reel_reactions,
    reel_comments,
    reel_shares,
    reel_views,
    reel_saves,
    ads,
    ad_analytics,
    subscriptions,
    tips,
    live_streams,
    live_messages,
    audio_spaces,
    account_lists,
    currentUser: defaultUser,
  };
}

// Global active presence state shared across components and channels
const mockActivePresence = new Map<string, { user_id: string; online_at: string; last_seen?: string }>();
const presenceListeners = new Set<(event: string, state: Record<string, any>) => void>();

function loadDb(): MockStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length > 0 && Array.isArray(parsed.ads)) {
        return parsed;
      }
    }
  } catch {
    /* fallback to initial */
  }
  const init = getInitialStore();
  saveDb(init);
  return init;
}

function saveDb(store: MockStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore storage quotas */
  }
}

// Create mock Supabase client
function createMockClient(): any {
  let db = loadDb();

  // Populate mock presence with Alex and Maya
  if (mockActivePresence.size === 0) {
    mockActivePresence.set('u_alex_001', {
      user_id: 'u_alex_001',
      online_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    });
    mockActivePresence.set('u_maya_002', {
      user_id: 'u_maya_002',
      online_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    });
  }

  const authSubscribers: ((event: string, session: any) => void)[] = [];

  const triggerAuthChange = (event: string, session: any) => {
    for (const sub of authSubscribers) {
      try {
        sub(event, session);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const getSessionObject = () => {
    db = loadDb();
    if (!db.currentUser) return null;
    return {
      access_token: 'mock-token',
      token_type: 'bearer',
      user: db.currentUser,
    };
  };

  return {
    auth: {
      getSession: async () => ({
        data: { session: getSessionObject() },
        error: null,
      }),
      getUser: async () => ({
        data: { user: db.currentUser },
        error: null,
      }),
      onAuthStateChange: (cb: (event: string, session: any) => void) => {
        authSubscribers.push(cb);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                const idx = authSubscribers.indexOf(cb);
                if (idx !== -1) authSubscribers.splice(idx, 1);
              },
            },
          },
        };
      },
      signUp: async ({ email, _password, options }: any) => {
        db = loadDb();
        const existing = db.profiles.find((p) => p.username === options?.data?.username);
        if (existing) {
          return { data: { user: null }, error: new Error('User already registered') };
        }
        const newId = `u_${Date.now()}`;
        const user = { id: newId, email, user_metadata: options?.data ?? {} };
        db.currentUser = user;
        saveDb(db);
        triggerAuthChange('SIGNED_IN', getSessionObject());
        return { data: { user, session: getSessionObject() }, error: null };
      },
      signInWithPassword: async ({ email }: any) => {
        db = loadDb();
        const prof = db.profiles.find((p) => p.username === email || p.id === email) || db.profiles[0];
        const user = {
          id: prof?.id || 'u_alex_001',
          email: email.includes('@') ? email : `${prof?.username || 'user'}@creator.studio`,
          user_metadata: { username: prof?.username || 'creator' },
        };
        db.currentUser = user;
        saveDb(db);
        triggerAuthChange('SIGNED_IN', getSessionObject());
        return { data: { user, session: getSessionObject() }, error: null };
      },
      signOut: async () => {
        db = loadDb();
        db.currentUser = null;
        saveDb(db);
        triggerAuthChange('SIGNED_OUT', null);
        return { error: null };
      },
    },

    storage: {
      from: (_bucket: string) => ({
        upload: async (path: string, file: File | Blob) => {
          const url = URL.createObjectURL(file);
          return { data: { path }, error: null, url };
        },
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: path.startsWith('blob:') || path.startsWith('http')
              ? path
              : `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80`,
          },
        }),
        remove: async () => ({ data: [], error: null }),
      }),
    },

    channel: (_name: string, _opts?: any) => {
      let presenceTracked = false;
      let currentPresencePayload: any = null;

      const broadcastPresenceState = () => {
        const state: Record<string, any> = {};
        mockActivePresence.forEach((val, key) => {
          state[key] = [{ ...val }];
        });
        presenceListeners.forEach((listener) => {
          try {
            listener('sync', state);
          } catch (e) {
            console.error(e);
          }
        });
      };

      const channelObj: any = {
        on: (type: string, filter: any, callback: any) => {
          if (type === 'presence') {
            const listener = (_event: string, state: Record<string, any>) => {
              callback({ ...filter, presenceState: () => state });
            };
            presenceListeners.add(listener);
          }
          return channelObj;
        },
        subscribe: (cb?: (status: string) => void) => {
          setTimeout(() => {
            cb?.('SUBSCRIBED');
            broadcastPresenceState();
          }, 10);
          return channelObj;
        },
        track: async (payload: any) => {
          presenceTracked = true;
          currentPresencePayload = payload;
          if (payload?.user_id) {
            mockActivePresence.set(payload.user_id, {
              user_id: payload.user_id,
              online_at: new Date().toISOString(),
              last_seen: new Date().toISOString(),
              ...payload,
            });
            db = loadDb();
            const prof = db.profiles.find((p) => p.id === payload.user_id);
            if (prof) {
              prof.is_online = true;
              prof.last_seen = new Date().toISOString();
              saveDb(db);
            }
            broadcastPresenceState();
          }
          return 'ok';
        },
        untrack: async () => {
          if (currentPresencePayload?.user_id) {
            mockActivePresence.delete(currentPresencePayload.user_id);
            db = loadDb();
            const prof = db.profiles.find((p) => p.id === currentPresencePayload.user_id);
            if (prof) {
              prof.is_online = false;
              prof.last_seen = new Date().toISOString();
              saveDb(db);
            }
            broadcastPresenceState();
          }
          presenceTracked = false;
          return 'ok';
        },
        unsubscribe: () => {
          if (presenceTracked && currentPresencePayload?.user_id) {
            channelObj.untrack();
          }
          return 'ok';
        },
      };
      return channelObj;
    },

    from: (tableName: string) => {
      db = loadDb();
      let selectFields = '*';
      const filters: ((item: any) => boolean)[] = [];
      let orderFn: ((a: any, b: any) => number) | null = null;
      let limitCount: number | null = null;

      const builder: any = {
        select: (fields = '*', countOpts?: any) => {
          selectFields = fields;
          if (countOpts?.count === 'exact') {
            builder._isCount = true;
            builder._countHead = countOpts?.head;
          }
          return builder;
        },
        eq: (col: string, val: any) => {
          filters.push((row) => row[col] === val);
          return builder;
        },
        neq: (col: string, val: any) => {
          filters.push((row) => row[col] !== val);
          return builder;
        },
        in: (col: string, vals: any[]) => {
          const s = new Set(vals);
          filters.push((row) => s.has(row[col]));
          return builder;
        },
        or: (expr: string) => {
          filters.push((row) => {
            if (expr.includes('sender_id.eq.') || expr.includes('recipient_id.eq.')) {
              const regex = /(sender_id|recipient_id)\.eq\.([a-zA-Z0-9_-]+)/g;
              let match;
              const matches: { col: string; val: string }[] = [];
              while ((match = regex.exec(expr)) !== null) {
                matches.push({ col: match[1], val: match[2] });
              }
              if (expr.startsWith('and(')) {
                return (
                  (row.sender_id === matches[0]?.val && row.recipient_id === matches[1]?.val) ||
                  (row.sender_id === matches[2]?.val && row.recipient_id === matches[3]?.val)
                );
              }
              return matches.some((m) => row[m.col] === m.val);
            }
            if (expr.includes('author_id.eq.')) {
              const aid = expr.split('author_id.eq.')[1]?.split(',')[0];
              return row.author_id === aid;
            }
            return true;
          });
          return builder;
        },
        gt: (col: string, val: any) => {
          filters.push((row) => new Date(row[col]).getTime() > new Date(val).getTime());
          return builder;
        },
        gte: (col: string, val: any) => {
          filters.push((row) => new Date(row[col]).getTime() >= new Date(val).getTime());
          return builder;
        },
        ilike: (col: string, pattern: string) => {
          const clean = pattern.replace(/%/g, '').toLowerCase();
          filters.push((row) => String(row[col] || '').toLowerCase().includes(clean));
          return builder;
        },
        is: (col: string, val: any) => {
          filters.push((row) => (val === null ? row[col] === null || row[col] === undefined : row[col] === val));
          return builder;
        },
        order: (col: string, opts?: { ascending?: boolean }) => {
          const asc = opts?.ascending ?? true;
          orderFn = (a, b) => {
            const vA = a[col];
            const vB = b[col];
            if (vA === vB) return 0;
            if (asc) return vA > vB ? 1 : -1;
            return vA < vB ? 1 : -1;
          };
          return builder;
        },
        limit: (n: number) => {
          limitCount = n;
          return builder;
        },
        single: async () => {
          const res = await builder.execute();
          return { data: res.data?.[0] ?? null, error: res.data?.[0] ? null : new Error('Not found') };
        },
        maybeSingle: async () => {
          const res = await builder.execute();
          return { data: res.data?.[0] ?? null, error: null };
        },
        insert: (records: any | any[]) => {
          const arr = Array.isArray(records) ? records : [records];
          const inserted = arr.map((rec) => ({
            id: rec.id || `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            created_at: rec.created_at || new Date().toISOString(),
            ...rec,
          }));
          db = loadDb();
          const target = (db as any)[tableName] || [];
          target.push(...inserted);
          (db as any)[tableName] = target;
          saveDb(db);

          return {
            select: () => ({
              maybeSingle: async () => ({ data: inserted[0], error: null }),
              single: async () => ({ data: inserted[0], error: null }),
              then: (resolve: any) => resolve({ data: inserted, error: null }),
            }),
            then: (resolve: any) => resolve({ data: inserted, error: null }),
          };
        },
        upsert: (record: any, _opts?: any) => {
          db = loadDb();
          const target: any[] = (db as any)[tableName] || [];

          const matchFn = (item: any) => {
            if (tableName === 'follows') {
              return item.follower_id === record.follower_id && (item.followee_id === record.followee_id || item.following_id === record.following_id);
            }
            if (tableName === 'subscriptions') {
              return item.subscriber_id === record.subscriber_id && item.creator_id === record.creator_id;
            }
            if (tableName === 'account_lists') {
              return item.user_id === record.user_id && item.target_user_id === record.target_user_id && item.list_type === record.list_type;
            }
            if (tableName === 'reactions') {
              return item.post_id === record.post_id && item.user_id === record.user_id && item.emoji === record.emoji;
            }
            if (tableName === 'shares') {
              return item.post_id === record.post_id && item.user_id === record.user_id;
            }
            if (tableName === 'post_views') {
              return item.post_id === record.post_id && item.user_id === record.user_id;
            }
            if (tableName === 'post_saves') {
              return item.post_id === record.post_id && item.user_id === record.user_id;
            }
            if (tableName === 'story_views') {
              return item.story_id === record.story_id && item.user_id === record.user_id;
            }
            if (record.id) return item.id === record.id;
            return false;
          };

          const idx = target.findIndex(matchFn);
          if (idx !== -1) {
            target[idx] = { ...target[idx], ...record };
          } else {
            target.push({
              id: record.id || `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              created_at: new Date().toISOString(),
              ...record,
            });
          }
          (db as any)[tableName] = target;
          saveDb(db);

          const resultItem = idx !== -1 ? target[idx] : target[target.length - 1];
          return {
            select: () => ({
              maybeSingle: async () => ({ data: resultItem, error: null }),
              single: async () => ({ data: resultItem, error: null }),
              then: (resolve: any) => resolve({ data: [resultItem], error: null }),
            }),
            then: (resolve: any) => resolve({ data: [resultItem], error: null }),
          };
        },
        update: (patch: any) => {
          return {
            eq: (col: string, val: any) => {
              return {
                is: (isCol: string, isVal: any) => {
                  filters.push((r) => r[col] === val && (isVal === null ? r[isCol] === null || r[isCol] === undefined : r[isCol] === isVal));
                  applyUpdate();
                  return Promise.resolve({ error: null });
                },
                eq: (col2: string, val2: any) => {
                  filters.push((r) => r[col] === val && r[col2] === val2);
                  applyUpdate();
                  return Promise.resolve({ error: null });
                },
                then: (resolve: any) => {
                  filters.push((r) => r[col] === val);
                  applyUpdate();
                  resolve({ error: null });
                },
              };
            },
          };

          function applyUpdate() {
            db = loadDb();
            const target = (db as any)[tableName] || [];
            target.forEach((item: any, i: number) => {
              if (filters.every((f) => f(item))) {
                target[i] = { ...item, ...patch };
              }
            });
            (db as any)[tableName] = target;
            saveDb(db);
          }
        },
        delete: () => {
          return {
            eq: (col: string, val: any) => {
              return {
                eq: (col2: string, val2: any) => {
                  return {
                    eq: (col3: string, val3: any) => {
                      filters.push((r) => r[col] === val && r[col2] === val2 && r[col3] === val3);
                      applyDelete();
                      return Promise.resolve({ error: null });
                    },
                    then: (resolve: any) => {
                      filters.push((r) => r[col] === val && r[col2] === val2);
                      applyDelete();
                      resolve({ error: null });
                    },
                  };
                },
                then: (resolve: any) => {
                  filters.push((r) => r[col] === val);
                  applyDelete();
                  resolve({ error: null });
                },
              };
            },
          };

          function applyDelete() {
            db = loadDb();
            const target = (db as any)[tableName] || [];
            (db as any)[tableName] = target.filter((item: any) => !filters.every((f) => f(item)));
            saveDb(db);
          }
        },
        execute: async () => {
          db = loadDb();
          let rows = [...((db as any)[tableName] || [])];
          for (const f of filters) {
            rows = rows.filter(f);
          }
          if (orderFn) {
            rows.sort(orderFn);
          }
          if (limitCount !== null) {
            rows = rows.slice(0, limitCount);
          }

          if (builder._isCount) {
            return { count: rows.length, data: builder._countHead ? null : rows, error: null };
          }

          // Hydrate relations
          if (selectFields.includes('author:profiles') || selectFields.includes('advertiser:profiles') || selectFields.includes('creator:profiles') || selectFields.includes('host:profiles') || selectFields.includes('reactions(') || selectFields.includes('comments(') || selectFields.includes('shares(') || selectFields.includes('collaborators:')) {
            rows = rows.map((row) => {
              const copy = { ...row };
              if (row.author_id) {
                copy.author = db.profiles.find((p) => p.id === row.author_id) || {
                  id: row.author_id,
                  username: 'creator',
                  full_name: 'Creator',
                };
              }
              if (row.advertiser_id) {
                copy.advertiser = db.profiles.find((p) => p.id === row.advertiser_id) || {
                  id: row.advertiser_id,
                  username: 'advertiser',
                  full_name: 'Brand Partner',
                };
              }
              if (row.creator_id) {
                copy.creator = db.profiles.find((p) => p.id === row.creator_id) || {
                  id: row.creator_id,
                  username: 'creator',
                  full_name: 'Creator',
                };
              }
              if (row.host_id) {
                copy.host = db.profiles.find((p) => p.id === row.host_id) || {
                  id: row.host_id,
                  username: 'host',
                  full_name: 'Host',
                };
              }
              if (tableName === 'posts') {
                copy.reactions = db.reactions.filter((rx) => rx.post_id === row.id);
                copy.comments = [{ count: db.comments.filter((c) => c.post_id === row.id).length }];
                copy.shares = [{ count: db.shares.filter((s) => s.post_id === row.id).length }];
                const collabs = db.post_collaborators
                  .filter((pc) => pc.post_id === row.id)
                  .map((pc) => ({
                    user_id: pc.user_id,
                    profiles: db.profiles.find((p) => p.id === pc.user_id) || null,
                  }));
                copy.collaborators = collabs;
              }
              if (tableName === 'reels') {
                copy.reactions = db.reel_reactions.filter((rx) => rx.reel_id === row.id);
                copy.comments = [{ count: db.reel_comments.filter((c) => c.reel_id === row.id).length }];
                copy.shares = [{ count: db.reel_shares.filter((s) => s.reel_id === row.id).length }];
              }
              if (tableName === 'comments' || tableName === 'reel_comments' || tableName === 'live_messages') {
                copy.author = db.profiles.find((p) => p.id === row.user_id) || {
                  id: row.user_id,
                  username: 'user',
                  full_name: 'User',
                };
              }
              if (tableName === 'story_views') {
                copy.user = db.profiles.find((p) => p.id === row.user_id) || {
                  id: row.user_id,
                  username: 'user',
                };
              }
              return copy;
            });
          }

          return { data: rows, count: rows.length, error: null };
        },
        then: (resolve: any) => {
          return builder.execute().then(resolve);
        },
      };

      return builder;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Client Initialization                                              */
/* ------------------------------------------------------------------ */

export const supabase: SupabaseClient = hasValidSupabaseConfig
  ? createClient(envUrl, envAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : (createMockClient() as unknown as SupabaseClient);

export const isMockClient = !hasValidSupabaseConfig;

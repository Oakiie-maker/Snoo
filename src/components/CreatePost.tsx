import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  createPost,
  createReel,
  searchProfiles,
  uploadMedia,
  generateAIMedia,
  moderateContentSafety,
} from '@/lib/api';
import type { Profile } from '@/lib/types';
import Avatar from './Avatar';
import {
  ImagePlus,
  Video,
  X,
  Loader2,
  AtSign,
  Sparkles,
  Film,
  Lock,
  Tag,
  Wand2,
  AlertCircle,
  Crown,
} from 'lucide-react';

interface Props {
  onPosted: () => void;
  onCancel: () => void;
  onOpenProfile: (id: string) => void;
  mode?: 'post' | 'reel';
}

const AI_STYLES = [
  'Cyberpunk Neon',
  '3D Clay & Glass',
  'Minimalist Editorial',
  'Lo-Fi Film Grain',
  'Futuristic Tech',
];

export default function CreatePost({ onPosted, onCancel, onOpenProfile, mode = 'post' }: Props) {
  const { profile } = useAuth();
  const isReel = mode === 'reel';
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [collabQuery, setCollabQuery] = useState('');
  const [collabResults, setCollabResults] = useState<Profile[]>([]);
  const [collabs, setCollabs] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Feature Suite additions
  const [isSubscribersOnly, setIsSubscribersOnly] = useState(false);
  const [isPaidPartnership, setIsPaidPartnership] = useState(false);
  const [paidBrandName, setPaidBrandName] = useState('');

  // AI Media Creator State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiStyle, setAiStyle] = useState(AI_STYLES[0]);
  const [aiGenerating, setAiGenerating] = useState(false);

  if (!profile) return null;

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) {
      setError('File is larger than 25 MB. Please choose a smaller image or video.');
      return;
    }
    if (isReel && !f.type.startsWith('video/')) {
      setError('Reels must be a video file.');
      return;
    }
    setError(null);
    setFile(f);
    setMediaType(f.type.startsWith('video/') ? 'video' : 'image');
    setPreview(URL.createObjectURL(f));
  };

  const searchCollabs = async (q: string) => {
    setCollabQuery(q);
    if (q.trim().length < 1) {
      setCollabResults([]);
      return;
    }
    const res = await searchProfiles(q, profile.id);
    setCollabResults(res.filter((r) => !collabs.some((c) => c.id === r.id)));
  };

  const addCollab = (p: Profile) => {
    if (collabs.length >= 4) return;
    setCollabs((cs) => [...cs, p]);
    setCollabQuery('');
    setCollabResults([]);
  };

  const removeCollab = (id: string) => {
    setCollabs((cs) => cs.filter((c) => c.id !== id));
  };

  const handleGenerateAIMedia = async () => {
    if (!aiPrompt.trim() || aiGenerating) return;
    setAiGenerating(true);
    setError(null);
    try {
      const result = await generateAIMedia(aiPrompt.trim(), aiStyle);
      setPreview(result.imageUrl);
      setMediaType('image');
      setFile(null); // using AI URL directly
      if (!caption.trim() && result.caption) {
        setCaption(result.caption);
      }
      setShowAiModal(false);
      setAiPrompt('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI generation failed';
      setError(msg);
    } finally {
      setAiGenerating(false);
    }
  };

  const submit = async () => {
    if (busy) return;
    if (isReel && !file && !preview) {
      setError('Add a video for your reel.');
      return;
    }
    if (!caption.trim() && !file && !preview) {
      setError('Add a caption or a photo/video.');
      return;
    }
    setBusy(true);
    setError(null);

    try {
      // 1. AI Content Safety Screening
      if (caption.trim()) {
        const safety = await moderateContentSafety(caption);
        if (!safety.isSafe) {
          setError(`Post blocked: ${safety.reason || 'Content contains unsafe language or spam.'}`);
          setBusy(false);
          return;
        }
      }

      let mediaUrl: string | null = preview;
      let mType: 'image' | 'video' | null = mediaType;

      if (file) {
        const res = await uploadMedia(profile.id, file);
        if ('error' in res) {
          setError(res.error);
          setBusy(false);
          return;
        }
        mediaUrl = res.url;
        mType = res.type;
      }

      const brandTag = isPaidPartnership && paidBrandName.trim() ? paidBrandName.trim() : undefined;

      if (isReel) {
        await createReel(
          profile.id,
          mediaUrl!,
          caption.trim(),
          `Original Audio - @${profile.username}`,
          isSubscribersOnly,
          brandTag
        );
      } else {
        await createPost(
          profile.id,
          caption.trim(),
          mediaUrl,
          mType,
          collabs.map((c) => c.id),
          isSubscribersOnly,
          brandTag
        );
      }
      onPosted();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not publish. Please try again.';
      setError(msg);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0f] flex flex-col animate-fade-in">
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button
          onClick={onCancel}
          className="p-2 rounded-full hover:bg-white/5 transition"
          aria-label="Cancel"
        >
          <X className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-white">{isReel ? 'New reel' : 'New post'}</h1>
        <button
          onClick={submit}
          disabled={busy}
          className="bg-gradient-to-r from-pink-500 to-orange-400 text-white font-semibold text-sm px-4 py-2 rounded-full shadow-lg shadow-pink-500/20 hover:brightness-110 disabled:opacity-60 transition flex items-center gap-1.5"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Share
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-2xl mx-auto w-full">
        <div className="flex gap-3">
          <Avatar profile={profile} size="md" />
          <div className="flex-1">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 2200))}
              placeholder="Share something with the community… or tap Gemini AI to create one!"
              rows={4}
              className="w-full bg-transparent text-[15px] outline-none resize-none placeholder:text-white/30 text-white"
            />
            <div className="text-[11px] text-white/30 text-right">{caption.length}/2200</div>
          </div>
        </div>

        {/* Media Preview */}
        {preview && (
          <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10">
            <button
              onClick={() => {
                setFile(null);
                setPreview(null);
                setMediaType(null);
              }}
              className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 backdrop-blur hover:bg-black/80 transition"
              aria-label="Remove media"
            >
              <X className="w-4 h-4" />
            </button>
            {mediaType === 'video' ? (
              <video src={preview} controls className="w-full max-h-[50vh] object-contain" />
            ) : (
              <img src={preview} alt="" className="w-full max-h-[50vh] object-cover" />
            )}
          </div>
        )}

        {/* Media Pickers & Gemini AI Button */}
        <div className="space-y-2">
          {isReel ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition text-sm font-medium text-white"
            >
              <Film className="w-4 h-4 text-pink-400" />
              Choose a vertical video
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition text-xs font-medium text-white"
              >
                <ImagePlus className="w-4 h-4 text-sky-400" />
                Photo
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition text-xs font-medium text-white"
              >
                <Video className="w-4 h-4 text-pink-400" />
                Video
              </button>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-gradient-to-r from-purple-600/30 to-pink-600/30 border border-purple-500/40 hover:brightness-110 transition text-xs font-semibold text-purple-300 shadow-md"
              >
                <Wand2 className="w-4 h-4 text-purple-400" />
                Gemini AI
              </button>
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={isReel ? 'video/*' : 'image/*,video/*'}
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />

        {/* Creator Monetization: Subscribers Only Toggle */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Crown className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Subscribers Only</h4>
                <p className="text-[11px] text-white/50">
                  Lock media behind preview blur for paid supporters
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSubscribersOnly(!isSubscribersOnly)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                isSubscribersOnly ? 'bg-amber-500' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  isSubscribersOnly ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Paid Partnership Brand Tag Selector */}
          <div className="pt-3 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Tag className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Paid Partnership</h4>
                <p className="text-[11px] text-white/50">
                  Tag a sponsored brand partner with official disclosure
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPaidPartnership(!isPaidPartnership)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                isPaidPartnership ? 'bg-blue-500' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  isPaidPartnership ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {isPaidPartnership && (
            <div className="pt-2 animate-fade-in">
              <input
                type="text"
                placeholder="Enter Brand Name (e.g., Sony Cine Studio, Nike, Red Bull)..."
                value={paidBrandName}
                onChange={(e) => setPaidBrandName(e.target.value)}
                className="w-full px-3.5 py-2 bg-black/40 border border-blue-500/30 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-400"
              />
            </div>
          )}
        </div>

        {/* Tag Co-creators */}
        {!isReel && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AtSign className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Tag co-creators</h3>
              <span className="text-[11px] text-white/30">{collabs.length}/4</span>
            </div>

            {collabs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {collabs.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => removeCollab(c.id)}
                    className="inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 rounded-full pl-1.5 pr-2.5 py-1 text-xs hover:bg-amber-500/25 transition"
                  >
                    <Avatar profile={c} size="xs" />
                    <span className="text-amber-200">@{c.username}</span>
                    <X className="w-3 h-3 text-amber-300/70" />
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <input
                value={collabQuery}
                onChange={(e) => searchCollabs(e.target.value)}
                placeholder="Search creators by username…"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-amber-500/50 transition text-white placeholder-white/30"
              />
              {collabResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-[#1c1c24] border border-white/10 rounded-xl overflow-hidden shadow-xl">
                  {collabResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addCollab(p)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 transition text-left text-white"
                    >
                      <Avatar profile={p} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">@{p.username}</div>
                        {p.full_name && (
                          <div className="text-xs text-white/40 truncate">{p.full_name}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* AI Media Creator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-[#131422] border border-purple-500/30 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">AI Media Creator</h3>
                  <p className="text-xs text-white/50">Generate styled visual backdrops with Gemini</p>
                </div>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="p-1.5 text-white/50 hover:text-white rounded-full hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">
                  Describe what you want to visualize
                </label>
                <textarea
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., A floating glass orb with purple holographic circuits in a moody nocturnal city..."
                  className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">
                  Visual Style Preset
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AI_STYLES.map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setAiStyle(style)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        aiStyle === style
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                          : 'bg-white/5 hover:bg-white/10 text-white/70'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateAIMedia}
                  disabled={!aiPrompt.trim() || aiGenerating}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xs shadow-lg shadow-purple-600/20 hover:brightness-110 active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {aiGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Media</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

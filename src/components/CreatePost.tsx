import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { createPost, createReel, searchProfiles, uploadMedia } from '@/lib/api';
import type { Profile } from '@/lib/types';
import Avatar from './Avatar';
import { ImagePlus, Video, X, Loader2, AtSign, Sparkles, Film } from 'lucide-react';

interface Props {
  onPosted: () => void;
  onCancel: () => void;
  onOpenProfile: (id: string) => void;
  mode?: 'post' | 'reel';
}

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

  const submit = async () => {
    if (busy) return;
    if (isReel && !file) {
      setError('Add a video for your reel.');
      return;
    }
    if (!caption.trim() && !file) {
      setError('Add a caption or a photo/video.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let mediaUrl: string | null = null;
      let mType: 'image' | 'video' | null = null;
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
      if (isReel) {
        await createReel(
          profile.id,
          mediaUrl!,
          caption.trim(),
          `Original Audio - @${profile.username}`,
        );
      } else {
        await createPost(
          profile.id,
          caption.trim(),
          mediaUrl,
          mType,
          collabs.map((c) => c.id),
        );
      }
      onPosted();
    } catch {
      setError('Could not publish. Please try again.');
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
        <h1 className="font-semibold">{isReel ? 'New reel' : 'New post'}</h1>
        <button
          onClick={submit}
          disabled={busy}
          className="bg-gradient-to-r from-pink-500 to-orange-400 text-white font-semibold text-sm px-4 py-2 rounded-full shadow-lg shadow-pink-500/20 hover:brightness-110 disabled:opacity-60 transition flex items-center gap-1.5"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Share
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex gap-3">
          <Avatar profile={profile} size="md" />
          <div className="flex-1">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 2200))}
              placeholder="Share something with the community…"
              rows={4}
              className="w-full bg-transparent text-[15px] outline-none resize-none placeholder:text-white/30"
            />
            <div className="text-[11px] text-white/30 text-right">{caption.length}/2200</div>
          </div>
        </div>

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

        {isReel ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition text-sm font-medium"
          >
            <Film className="w-4 h-4 text-pink-400" />
            Choose a vertical video
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition text-sm font-medium"
            >
              <ImagePlus className="w-4 h-4 text-sky-400" />
              Photo
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition text-sm font-medium"
            >
              <Video className="w-4 h-4 text-pink-400" />
              Video
            </button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={isReel ? 'video/*' : 'image/*,video/*'}
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-[11px] text-white/30 -mt-2">
          {isReel ? 'Max 25 MB. Vertical videos look best.' : 'Max 25 MB. Images and videos only.'}
        </p>

        {!isReel && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AtSign className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold">Tag co-creators</h3>
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
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-amber-500/50 transition"
            />
            {collabResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-[#1c1c24] border border-white/10 rounded-xl overflow-hidden shadow-xl">
                {collabResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addCollab(p)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 transition text-left"
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
          <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

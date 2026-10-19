import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  createStory,
  deleteStory,
  fetchStoryGroups,
  fetchStoryViewers,
  markStoryViewed,
  uploadMedia,
} from '@/lib/api';
import type { Profile, StoryGroup } from '@/lib/types';
import Avatar from './Avatar';
import Modal from './Modal';
import { Plus, X, Loader2, Eye, Trash2, Camera } from 'lucide-react';

interface Props {
  onOpenProfile: (id: string) => void;
}

export default function StoriesBar({ onOpenProfile }: Props) {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);

  const load = async () => {
    if (!profile) return;
    const g = await fetchStoryGroups(profile.id);
    setGroups(g);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [profile]);

  const myGroup = groups.find((g) => g.author.id === profile?.id);

  return (
    <>
      <div className="flex items-center gap-4 overflow-x-auto no-scrollbar px-4 py-3">
        {profile && (
          <button
            onClick={() => setComposing(true)}
            className="flex flex-col items-center gap-1 shrink-0"
            aria-label="Add story"
          >
            <div className="relative">
              <Avatar profile={profile} size="lg" />
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-pink-500 border-2 border-[#0a0a0f] flex items-center justify-center">
                <Plus className="w-3 h-3 text-white" />
              </span>
            </div>
            <span className="text-[11px] text-white/60">Your story</span>
          </button>
        )}

        {loading ? (
          <div className="flex gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton w-16 h-16 rounded-full shrink-0" />
            ))}
          </div>
        ) : (
          groups
            .filter((g) => g.author.id !== profile?.id || g.stories.length > 1 || !myGroup)
            .map((g, i) => {
              const allViewed = g.stories.every((s) => g.viewedIds.includes(s.id));
              return (
                <button
                  key={g.author.id}
                  onClick={() => setViewing(i)}
                  className="flex flex-col items-center gap-1 shrink-0"
                >
                  <Avatar
                    profile={g.author}
                    size="lg"
                    ring={!allViewed}
                  />
                  <span className="text-[11px] text-white/60 max-w-[64px] truncate">
                    @{g.author.username}
                  </span>
                </button>
              );
            })
        )}
      </div>

      {viewing !== null && groups[viewing] && (
        <StoryViewer
          groups={groups}
          startGroup={viewing}
          onClose={() => setViewing(null)}
          onOpenProfile={onOpenProfile}
          onConsumed={load}
        />
      )}

      {composing && profile && (
        <StoryComposer
          onClose={() => setComposing(false)}
          onPosted={() => {
            setComposing(false);
            load();
          }}
        />
      )}
    </>
  );
}

function StoryViewer({
  groups,
  startGroup,
  onClose,
  onOpenProfile,
  onConsumed,
}: {
  groups: StoryGroup[];
  startGroup: number;
  onClose: () => void;
  onOpenProfile: (id: string) => void;
  onConsumed: () => void;
}) {
  const { profile } = useAuth();
  const [gi, setGi] = useState(startGroup);
  const [si, setSi] = useState(0);
  const [viewers, setViewers] = useState<Profile[] | null>(null);
  const [showViewers, setShowViewers] = useState(false);
  const timerRef = useRef<number | null>(null);

  const group = groups[gi];
  const story = group?.stories[si];

  const advance = () => {
    if (!group) return;
    if (si + 1 < group.stories.length) {
      setSi(si + 1);
    } else if (gi + 1 < groups.length) {
      setGi(gi + 1);
      setSi(0);
    } else {
      onClose();
    }
  };

  const back = () => {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) {
      setGi(gi - 1);
      setSi(groups[gi - 1].stories.length - 1);
    }
  };

  useEffect(() => {
    if (!story || !profile) return;
    markStoryViewed(story.id, profile.id).then(onConsumed);
    const duration = story.media_type === 'image' ? 5000 : 8000;
    timerRef.current = window.setTimeout(advance, duration);
    setViewers(null);
    setShowViewers(false);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [gi, si]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') advance();
      if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onViewers = async () => {
    if (!story) return;
    setShowViewers(true);
    const v = await fetchStoryViewers(story.id);
    setViewers(v);
  };

  if (!group || !story) return null;
  const isMine = group.author.id === profile?.id;
  const progress = useMemo(() => si + 1, [si]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in">
      <div className="absolute top-0 inset-x-0 z-20 p-3">
        <div className="flex gap-1 mb-3">
          {group.stories.map((s, i) => (
            <div key={s.id} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full bg-white transition-all ${i < progress ? 'w-full' : i === progress - 1 ? 'w-full' : 'w-0'}`}
                style={i === si ? { transition: `width ${story.media_type === 'image' ? 5000 : 8000}ms linear` } : {}}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => onOpenProfile(group.author.id)}>
            <Avatar profile={group.author} size="sm" />
          </button>
          <button
            onClick={() => onOpenProfile(group.author.id)}
            className="font-semibold text-sm text-white hover:underline"
          >
            @{group.author.username}
          </button>
          <span className="text-xs text-white/50">
            {new Date(story.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
          <div className="flex-1" />
          {isMine && (
            <button
              onClick={onViewers}
              className="text-xs text-white/70 hover:text-white flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-full"
            >
              <Eye className="w-3.5 h-3.5" />
              Views
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <button
        onClick={back}
        className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
        aria-label="Previous"
      />
      <button
        onClick={advance}
        className="absolute right-0 top-0 bottom-0 w-2/3 z-10"
        aria-label="Next"
      />

      <div className="flex-1 flex items-center justify-center">
        {story.media_type === 'video' ? (
          <video
            key={story.id}
            src={story.media_url}
            autoPlay
            playsInline
            muted
            onEnded={advance}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <img
            key={story.id}
            src={story.media_url}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>

      {story.caption && (
        <div className="absolute bottom-24 inset-x-4 z-20 text-center">
          <p className="inline-block bg-black/50 backdrop-blur px-4 py-2 rounded-2xl text-sm text-white whitespace-pre-wrap">
            {story.caption}
          </p>
        </div>
      )}

      {isMine && (
        <button
          onClick={async () => {
            if (!confirm('Delete this story?')) return;
            await deleteStory(story.id, story.media_url);
            onConsumed();
            onClose();
          }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 bg-white/10 hover:bg-rose-500/30 text-white text-sm px-4 py-2 rounded-full transition"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      )}

      <Modal open={showViewers} onClose={() => setShowViewers(false)} title="Story views">
        {viewers === null ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-white/40" />
          </div>
        ) : viewers.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-6">No one has viewed this story yet.</p>
        ) : (
          <ul className="space-y-1">
            {viewers.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => {
                    setShowViewers(false);
                    onClose();
                    onOpenProfile(p.id);
                  }}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition text-left"
                >
                  <Avatar profile={p} size="sm" />
                  <span className="text-sm font-medium">@{p.username}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

function StoryComposer({
  onClose,
  onPosted,
}: {
  onClose: () => void;
  onPosted: () => void;
}) {
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!profile) return null;

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) {
      setError('File is larger than 25 MB.');
      return;
    }
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
      setError('Only images or videos.');
      return;
    }
    setError(null);
    setFile(f);
    setMediaType(f.type.startsWith('video/') ? 'video' : 'image');
    setPreview(URL.createObjectURL(f));
  };

  const post = async () => {
    if (!file || !mediaType) {
      setError('Choose a photo or video.');
      return;
    }
    setBusy(true);
    const up = await uploadMedia(profile.id, file);
    if ('error' in up) {
      setError(up.error);
      setBusy(false);
      return;
    }
    await createStory(profile.id, up.url, up.type, caption.trim());
    onPosted();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0f] flex flex-col animate-fade-in">
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 transition" aria-label="Cancel">
          <X className="w-5 h-5" />
        </button>
        <h1 className="font-semibold">Add to your story</h1>
        <button
          onClick={post}
          disabled={busy || !file}
          className="bg-gradient-to-r from-pink-500 to-orange-400 text-white font-semibold text-sm px-4 py-2 rounded-full disabled:opacity-60 transition flex items-center gap-1.5"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Share
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {preview ? (
          <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10 aspect-[9/16] max-h-[55vh] mx-auto">
            <button
              onClick={() => {
                setFile(null);
                setPreview(null);
                setMediaType(null);
              }}
              className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 hover:bg-black/80 transition"
              aria-label="Remove"
            >
              <X className="w-4 h-4" />
            </button>
            {mediaType === 'video' ? (
              <video src={preview} controls className="w-full h-full object-contain" />
            ) : (
              <img src={preview} alt="" className="w-full h-full object-cover" />
            )}
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full aspect-[9/16] max-h-[55vh] mx-auto rounded-2xl border-2 border-dashed border-white/15 hover:border-pink-500/40 hover:bg-white/[0.02] flex flex-col items-center justify-center gap-2 text-white/40 transition"
          >
            <Camera className="w-8 h-8" />
            <span className="text-sm">Tap to add a photo or video</span>
            <span className="text-[11px] text-white/30">Stories disappear after 24 hours</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />

        {file && (
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 200))}
            placeholder="Add a caption…"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-pink-500/50 transition"
          />
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

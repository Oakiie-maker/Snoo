import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  markRead,
  searchProfiles,
} from '@/lib/api';
import type { Conversation } from '@/lib/types';
import type { Profile } from '@/lib/types';
import Avatar from '@/components/Avatar';
import Modal from '@/components/Modal';
import { Send, Search, MessageCircle, ArrowLeft, Loader2 } from 'lucide-react';

interface Props {
  initialUser?: Profile | null;
  onConsumeInitial?: () => void;
}

export default function ChatScreen({ initialUser, onConsumeInitial }: Props) {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Profile | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    if (!profile) return;
    const c = await fetchConversations(profile.id);
    setConversations(
      c.sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime()),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [profile]);

  useEffect(() => {
    if (initialUser) {
      setActive(initialUser);
      onConsumeInitial?.();
    }
  }, [initialUser, onConsumeInitial]);

  if (active) {
    return <Thread other={active} onBack={() => setActive(null)} onProfileChanged={load} />;
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 bg-[#0a0a0f]/85 backdrop-blur-xl border-b border-white/5">
        <div className="px-4 h-14 flex items-center justify-between">
          <h1 className="font-bold text-lg">Messages</h1>
          <button
            onClick={() => setShowNew(true)}
            className="p-2 rounded-full hover:bg-white/5 transition"
            aria-label="New message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-3 py-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/40">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <span className="text-sm">Loading messages…</span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 mb-4">
              <MessageCircle className="w-7 h-7 text-sky-400" />
            </div>
            <h2 className="font-semibold mb-1">No conversations yet</h2>
            <p className="text-sm text-white/50 mb-5">
              Start a chat with a creator you follow or who follows you.
            </p>
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-cyan-400 text-white font-semibold text-sm px-5 py-2.5 rounded-full shadow-lg shadow-sky-500/20 hover:brightness-110 transition"
            >
              <Send className="w-4 h-4" />
              New message
            </button>
          </div>
        ) : (
          <ul className="space-y-1">
            {conversations.map((c) => (
              <li key={c.other.id}>
                <button
                  onClick={() => setActive(c.other)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-2xl hover:bg-white/[0.03] transition text-left"
                >
                  <Avatar profile={c.other} size="md" ring={c.unread > 0} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate">@{c.other.username}</span>
                      <span className="text-[11px] text-white/30 shrink-0">
                        {new Date(c.last_at).toLocaleDateString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-white/50 truncate">{c.last_body}</p>
                      {c.unread > 0 && (
                        <span className="bg-pink-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1.5 flex items-center justify-center shrink-0">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <NewMessageModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onPick={(p) => {
          setShowNew(false);
          setActive(p);
        }}
        excludeId={profile?.id ?? ''}
      />
    </div>
  );
}

function NewMessageModal({
  open,
  onClose,
  onPick,
  excludeId,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (p: Profile) => void;
  excludeId: string;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Profile[]>([]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (q.trim().length === 0) {
        setResults([]);
        return;
      }
      const r = await searchProfiles(q, excludeId);
      setResults(r);
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, excludeId]);

  return (
    <Modal open={open} onClose={onClose} title="New message">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by username…"
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-sky-500/50 transition"
        />
      </div>
      {results.length === 0 ? (
        <p className="text-sm text-white/40 text-center py-6">
          {q ? 'No one found.' : 'Start typing to find a creator.'}
        </p>
      ) : (
        <ul className="space-y-1">
          {results.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => onPick(p)}
                className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 transition text-left"
              >
                <Avatar profile={p} size="md" />
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">@{p.username}</div>
                  {p.full_name && (
                    <div className="text-xs text-white/40 truncate">{p.full_name}</div>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function Thread({
  other,
  onBack,
  onProfileChanged,
}: {
  other: Profile;
  onBack: () => void;
  onProfileChanged: () => void;
}) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<
    { id: string; sender_id: string; body: string; created_at: string }[]
  >([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const m = await fetchMessages(profile.id, other.id);
    setMessages(m);
    if (loading) setLoading(false);
    await markRead(profile.id, other.id);
    onProfileChanged();
  }, [profile, other.id, loading, onProfileChanged]);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !profile) return;
    const text = body.trim();
    setBody('');
    setMessages((m) => [
      ...m,
      { id: `temp-${Date.now()}`, sender_id: profile.id, body: text, created_at: new Date().toISOString() },
    ]);
    await sendMessage(profile.id, other.id, text);
    load();
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#0a0a0f] flex flex-col animate-fade-in">
      <header className="flex items-center gap-3 px-3 h-14 border-b border-white/5">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-white/5 transition"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Avatar profile={other} size="sm" />
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">@{other.username}</div>
          {other.full_name && (
            <div className="text-xs text-white/40 truncate">{other.full_name}</div>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-white/40" />
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_id === profile?.id;
            const prev = messages[i - 1];
            const showAvatar = !mine && (!prev || prev.sender_id !== m.sender_id);
            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
              >
                {!mine && (
                  <div className="w-7 shrink-0">
                    {showAvatar && <Avatar profile={other} size="xs" />}
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm break-words ${
                    mine
                      ? 'bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-br-sm'
                      : 'bg-white/[0.06] text-white rounded-bl-sm'
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
        {messages.length === 0 && !loading && (
          <div className="text-center text-white/40 text-sm py-12">
            Say hi to @{other.username}
          </div>
        )}
      </div>

      <form
        onSubmit={send}
        className="flex items-center gap-2 px-3 py-3 border-t border-white/5 bg-[#0a0a0f]"
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message…"
          className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm outline-none focus:border-pink-500/50 transition"
        />
        <button
          type="submit"
          disabled={!body.trim()}
          className="p-2.5 rounded-full bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 disabled:opacity-40 transition"
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

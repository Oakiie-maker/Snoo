import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import type { Profile } from '@/lib/types';
import AuthScreen from '@/screens/AuthScreen';
import HomeScreen from '@/screens/HomeScreen';
import DiscoverScreen from '@/screens/DiscoverScreen';
import ChatScreen from '@/screens/ChatScreen';
import ReelsScreen from '@/screens/ReelsScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import AdManagerScreen from '@/screens/AdManagerScreen';
import CreatePost from '@/components/CreatePost';
import Avatar from '@/components/Avatar';
import { Home, Compass, MessageCircle, Plus, Loader2, Clapperboard, Megaphone } from 'lucide-react';

type Tab = 'home' | 'reels' | 'discover' | 'chat' | 'profile';
type Overlay =
  | { kind: 'none' }
  | { kind: 'compose' }
  | { kind: 'compose-reel' }
  | { kind: 'ad-manager' }
  | { kind: 'profile'; id: string };

export default function App() {
  const { session, profile, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('home');
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' });
  const [profileKey, setProfileKey] = useState(0);
  const [chatInitial, setChatInitial] = useState<Profile | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center text-white/60">
        <Loader2 className="w-6 h-6 animate-spin mb-3" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthScreen />;
  }

  const openProfile = (id: string) => {
    setOverlay({ kind: 'profile', id });
    setProfileKey((k) => k + 1);
  };

  const openMessage = (user: Profile) => {
    setOverlay({ kind: 'none' });
    setTab('chat');
    setChatInitial(user);
  };

  const closeOverlay = () => setOverlay({ kind: 'none' });

  let screen: React.ReactNode;
  if (overlay.kind === 'profile') {
    screen = (
      <ProfileScreen
        key={profileKey}
        userId={overlay.id}
        onBack={closeOverlay}
        onOpenProfile={openProfile}
        onMessage={openMessage}
      />
    );
  } else if (overlay.kind === 'ad-manager') {
    screen = <AdManagerScreen onBack={closeOverlay} />;
  } else {
    switch (tab) {
      case 'home':
        screen = (
          <HomeScreen
            onOpenProfile={openProfile}
            onCompose={() => setOverlay({ kind: 'compose' })}
            onOpenAdManager={() => setOverlay({ kind: 'ad-manager' })}
          />
        );
        break;
      case 'reels':
        screen = (
          <ReelsScreen
            onOpenProfile={openProfile}
            onCompose={() => setOverlay({ kind: 'compose-reel' })}
          />
        );
        break;
      case 'discover':
        screen = <DiscoverScreen onOpenProfile={openProfile} />;
        break;
      case 'chat':
        screen = (
          <ChatScreen
            initialUser={chatInitial}
            onConsumeInitial={() => setChatInitial(null)}
          />
        );
        break;
      case 'profile':
        screen = (
          <ProfileScreen
            key={profileKey}
            userId={profile.id}
            onBack={() => setTab('home')}
            onOpenProfile={openProfile}
            onMessage={openMessage}
          />
        );
        break;
    }
  }

  const showBottomNav = overlay.kind === 'none';

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {overlay.kind === 'compose' && (
        <CreatePost
          onOpenProfile={openProfile}
          onCancel={closeOverlay}
          onPosted={() => {
            closeOverlay();
            setTab('home');
          }}
        />
      )}
      {overlay.kind === 'compose-reel' && (
        <CreatePost
          mode="reel"
          onOpenProfile={openProfile}
          onCancel={closeOverlay}
          onPosted={() => {
            closeOverlay();
            setTab('reels');
          }}
        />
      )}

      {screen}

      {showBottomNav && (
        <nav className="fixed bottom-0 inset-x-0 z-30 bg-[#0a0a0f]/90 backdrop-blur-xl border-t border-white/5">
          <div className="max-w-xl mx-auto flex items-center justify-around px-1 h-16">
            <NavButton
              active={tab === 'home'}
              onClick={() => setTab('home')}
              icon={<Home className="w-6 h-6" />}
              label="Home"
            />
            <NavButton
              active={tab === 'reels'}
              onClick={() => setTab('reels')}
              icon={<Clapperboard className="w-6 h-6" />}
              label="Reels"
            />
            <button
              onClick={() => setOverlay({ kind: 'compose' })}
              className="relative -mt-6 w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center shadow-lg shadow-pink-500/30 hover:brightness-110 active:scale-95 transition"
              aria-label="Create post"
            >
              <Plus className="w-6 h-6 text-white" />
            </button>
            <NavButton
              active={tab === 'discover'}
              onClick={() => setTab('discover')}
              icon={<Compass className="w-6 h-6" />}
              label="Discover"
            />
            <NavButton
              active={tab === 'chat'}
              onClick={() => setTab('chat')}
              icon={<MessageCircle className="w-6 h-6" />}
              label="Chat"
            />
            <NavButton
              active={tab === 'profile'}
              onClick={() => {
                setTab('profile');
                setProfileKey((k) => k + 1);
              }}
              icon={<ProfileAvatar profile={profile} active={tab === 'profile'} />}
              label="You"
            />
          </div>
        </nav>
      )}
    </div>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-2 py-1.5 transition ${
        active ? 'text-white' : 'text-white/40 hover:text-white/70'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function ProfileAvatar({ profile, active }: { profile: Profile; active: boolean }) {
  return (
    <div
      className={`w-6 h-6 rounded-full overflow-hidden ring-2 transition ${
        active ? 'ring-pink-500' : 'ring-transparent'
      }`}
    >
      <Avatar profile={profile} size="xs" />
    </div>
  );
}

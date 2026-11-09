import { useState } from 'react';
import type { AudioSpace, Profile } from '@/lib/types';
import { toggleAudioSpaceHand, updateAudioSpaceStage } from '@/lib/api';
import Avatar from '@/components/Avatar';
import {
  X,
  Mic,
  MicOff,
  Hand,
  Users,
  Radio,
  Sparkles,
  PhoneOff,
  Volume2,
} from 'lucide-react';

interface AudioSpaceModalProps {
  space: AudioSpace;
  currentUser: Profile;
  isOpen: boolean;
  onClose: () => void;
}

export default function AudioSpaceModal({
  space,
  currentUser,
  isOpen,
  onClose,
}: AudioSpaceModalProps) {
  const isHost = space.host_id === currentUser.id;
  const isSpeaker = isHost || (space.speaker_ids || []).includes(currentUser.id);
  const isHandRaised = (space.raised_hands || []).includes(currentUser.id);

  const [isMuted, setIsMuted] = useState(false);
  const [handRaised, setHandRaised] = useState(isHandRaised);
  const [activeSpeakerIndex, setActiveSpeakerIndex] = useState(0);

  if (!isOpen) return null;

  const handleToggleHand = async () => {
    try {
      const nextState = !handRaised;
      setHandRaised(nextState);
      await toggleAudioSpaceHand(space.id, nextState);
    } catch (err) {
      console.error('Failed to toggle hand raise:', err);
    }
  };

  const handleInviteToSpeak = async (userId: string) => {
    if (!isHost) return;
    try {
      const newSpeakers = Array.from(new Set([...(space.speaker_ids || []), userId]));
      await updateAudioSpaceStage(space.id, newSpeakers);
    } catch (err) {
      console.error('Failed to update speakers:', err);
    }
  };

  const speakers = [
    ...(space.host_profile ? [{ ...space.host_profile, isHost: true }] : []),
    ...((space.speaker_profiles || []).filter((p) => p.id !== space.host_id).map((p) => ({
      ...p,
      isHost: false,
    }))),
  ];

  const listeners = space.listener_profiles || [];

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in p-0 md:p-4">
      <div className="relative w-full max-w-2xl bg-[#0f101a] border border-purple-500/20 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Glowing backdrop banner */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-purple-600/15 via-pink-600/10 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 p-5 border-b border-white/5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs font-bold uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5 animate-pulse text-purple-400" /> Audio Space
              </span>
              <span className="text-xs text-white/50 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {(space.speakers_count + space.listeners_count).toLocaleString()} in room
              </span>
            </div>
            <h2 className="text-lg font-bold text-white leading-snug">{space.title}</h2>
            {space.topic && (
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-lg bg-white/5 text-xs text-purple-300 font-medium">
                #{space.topic}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white rounded-full hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stage Content */}
        <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-6">
          {/* Speakers Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4" />
                Speakers ({speakers.length})
              </h3>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {speakers.map((speaker, index) => {
                const isSpeaking = index === activeSpeakerIndex;
                return (
                  <div key={speaker.id} className="flex flex-col items-center text-center group">
                    <div className="relative mb-2">
                      {/* Active audio speaking ring */}
                      {isSpeaking && (
                        <div className="absolute -inset-1.5 rounded-full bg-purple-500/40 animate-ping pointer-events-none" />
                      )}
                      <div
                        className={`relative rounded-full p-0.5 transition-all ${
                          isSpeaking ? 'ring-2 ring-purple-400' : ''
                        }`}
                      >
                        <Avatar user={speaker} size="lg" />
                      </div>

                      {/* Role badge */}
                      {speaker.isHost ? (
                        <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[9px] font-black uppercase shadow">
                          Host
                        </span>
                      ) : (
                        <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-purple-600 text-white text-[9px] shadow">
                          <Mic className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-white/90 truncate max-w-[90px]">
                      {speaker.display_name || speaker.username}
                    </span>
                    <span className="text-[10px] text-white/40 truncate max-w-[90px]">
                      {speaker.isHost ? 'Host' : 'Speaker'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Listeners Section */}
          <div className="border-t border-white/5 pt-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4 flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              Listeners ({listeners.length || space.listeners_count})
            </h3>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {listeners.map((listener) => {
                const hasHandUp = (space.raised_hands || []).includes(listener.id);
                return (
                  <div key={listener.id} className="flex flex-col items-center text-center">
                    <div className="relative mb-1">
                      <Avatar user={listener} size="md" />
                      {hasHandUp && (
                        <span className="absolute -top-1 -right-1 p-1 rounded-full bg-amber-500 text-black animate-bounce shadow">
                          <Hand className="w-2.5 h-2.5 fill-black" />
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-white/70 truncate max-w-[70px]">
                      {listener.display_name || listener.username}
                    </span>

                    {/* Host action to invite speaker */}
                    {isHost && hasHandUp && (
                      <button
                        onClick={() => handleInviteToSpeak(listener.id)}
                        className="mt-1 px-1.5 py-0.5 rounded bg-purple-600/40 hover:bg-purple-600 text-[9px] text-purple-200 transition-colors"
                      >
                        Invite
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="relative z-10 p-4 bg-[#121320] border-t border-white/10 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>Leave Space</span>
          </button>

          <div className="flex items-center gap-2">
            {!isSpeaker && (
              <button
                onClick={handleToggleHand}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  handRaised
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                    : 'bg-white/10 hover:bg-white/15 text-white'
                }`}
              >
                <Hand className={`w-3.5 h-3.5 ${handRaised ? 'fill-black' : ''}`} />
                <span>{handRaised ? 'Hand Raised' : 'Raise Hand'}</span>
              </button>
            )}

            {isSpeaker && (
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isMuted
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                }`}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isMuted ? 'Muted' : 'Mute'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

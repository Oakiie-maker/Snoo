import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ensureProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Sparkles, Loader2, UserCheck } from 'lucide-react';

type Mode = 'login' | 'signup';

export default function AuthScreen() {
  const { refreshProfile } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        if (username.trim().length < 2) {
          throw new Error('Choose a username with at least 2 characters.');
        }
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username.trim())
          .maybeSingle();
        if (existing) throw new Error('That username is already taken.');

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) throw signUpError;
        const uid = data.user?.id;
        if (uid) {
          await ensureProfile(uid, username.trim(), fullName.trim(), bio.trim(), null);
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
      await refreshProfile();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      const friendly = msg
        .replace('Invalid login credentials', 'Email or password is incorrect.')
        .replace('User already registered', 'An account with this email already exists.');
      setError(friendly);
    } finally {
      setBusy(false);
    }
  };

  const handleDemoSignIn = async (demoUsername: string) => {
    setError(null);
    setBusy(true);
    try {
      await supabase.auth.signInWithPassword({
        email: `${demoUsername}@creator.studio`,
        password: 'password123',
      });
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in as demo creator');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-72 h-72 bg-pink-500/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-72 h-72 bg-sky-500/20 rounded-full blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 mb-3 shadow-lg shadow-pink-500/30">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Creators</h1>
          <p className="text-white/50 text-sm mt-1">
            Where creators meet, post, and collaborate.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3 bg-white/[0.03] border border-white/10 rounded-2xl p-5 backdrop-blur">
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="At least 6 characters"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </Field>

          {mode === 'signup' && (
            <div className="space-y-3 animate-fade-in">
              <Field label="Username">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">@</span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ''))}
                    className="input pl-7"
                    placeholder="username"
                    autoComplete="username"
                  />
                </div>
              </Field>
              <Field label="Full name (optional)">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input"
                  placeholder="Your name"
                />
              </Field>
              <Field label="Bio (optional)">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 160))}
                  rows={2}
                  className="input resize-none"
                  placeholder="Tell people who you are"
                />
                <div className="text-[11px] text-white/30 text-right mt-1">{bio.length}/160</div>
              </Field>
            </div>
          )}

          {error && (
            <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-gradient-to-r from-pink-500 to-orange-400 text-white font-semibold py-3 rounded-xl shadow-lg shadow-pink-500/20 hover:brightness-110 active:scale-[0.99] transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'login' ? 'Log in' : 'Create account'}
          </button>

          {/* Quick Demo Login Option */}
          <div className="pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => handleDemoSignIn('alexrivera')}
              className="w-full bg-white/5 hover:bg-white/10 text-white/80 font-medium py-2.5 rounded-xl border border-white/10 transition text-xs flex items-center justify-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 text-pink-400" />
              <span>Explore as Demo Creator (@alexrivera)</span>
            </button>
          </div>
        </form>

        <div className="text-center mt-5 text-sm text-white/50">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
            }}
            className="text-pink-400 font-semibold hover:underline"
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 0.75rem;
          padding: 0.7rem 0.85rem;
          color: #fff;
          font-size: 0.95rem;
          outline: none;
          transition: border-color .15s, background .15s;
        }
        .input:focus {
          border-color: rgba(244,63,94,0.6);
          background: rgba(255,255,255,0.06);
        }
        .input::placeholder { color: rgba(255,255,255,0.3); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-white/60 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

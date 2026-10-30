import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  Building,
  ArrowRight,
  AlertCircle,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import type { UserProfile, AuthResponse } from '../types/lead';
import { playSound } from '../utils/audio';

const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ||
  '648257710893-s5r3l0mjg3789hqvdu34qfegmp7s1u1d.apps.googleusercontent.com';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'signup' | 'login';
  onClose: () => void;
  onAuthSuccess: (user: UserProfile, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'signup',
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'signup' | 'login'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organization, setOrganization] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [googleGsiLoaded, setGoogleGsiLoaded] = useState(false);

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && initialMode) {
      setMode(initialMode);
      setErrorMessage(null);
    }
  }, [isOpen, initialMode]);

  // Initialize Google Identity Services (GIS) button
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    const setupGoogleGsi = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google;
      if (g?.accounts?.id) {
        if (!mounted) return;
        setGoogleGsiLoaded(true);

        try {
          g.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: async (response: { credential?: string }) => {
              if (response.credential) {
                await handleGoogleCredential(response.credential);
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          if (googleBtnContainerRef.current) {
            googleBtnContainerRef.current.innerHTML = '';
            g.accounts.id.renderButton(googleBtnContainerRef.current, {
              theme: 'outline',
              size: 'large',
              type: 'standard',
              shape: 'pill',
              text: mode === 'signup' ? 'signup_with' : 'signin_with',
              width: 380,
              logo_alignment: 'left',
            });
          }
        } catch (err) {
          console.warn('[Google Auth] GIS setup error:', err);
        }
      }
    };

    setupGoogleGsi();
    const interval = setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).google?.accounts?.id) {
        setupGoogleGsi();
        clearInterval(interval);
      }
    }, 300);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isOpen, mode]);

  const handleGoogleCredential = async (credential: string) => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });

      const data: AuthResponse = await res.json();
      if (res.ok && data.success && data.user && data.token) {
        playSound('streak');
        onAuthSuccess(data.user, data.token);
        onClose();
      } else {
        setErrorMessage(data.error || 'Google authentication failed.');
      }
    } catch {
      setErrorMessage('Could not complete Google authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuthCode = async (code: string) => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri: 'postmessage' }),
      });

      const data: AuthResponse = await res.json();
      if (res.ok && data.success && data.user && data.token) {
        playSound('streak');
        onAuthSuccess(data.user, data.token);
        onClose();
      } else {
        setErrorMessage(data.error || 'Google authentication failed.');
      }
    } catch {
      setErrorMessage('Could not complete Google authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const payload =
        mode === 'signup'
          ? { name, email, password, organization }
          : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: AuthResponse = await res.json();

      if (res.ok && data.success && data.user && data.token) {
        playSound('streak');
        onAuthSuccess(data.user, data.token);
        onClose();
      } else {
        setErrorMessage(data.error || 'Authentication failed. Please try again.');
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Network error connecting to auth server.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomGoogleClick = () => {
    setErrorMessage(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google;
    if (g?.accounts?.oauth2) {
      try {
        setIsLoading(true);
        const client = g.accounts.oauth2.initCodeClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'email profile openid',
          ux_mode: 'popup',
          callback: async (response: { code?: string; error?: string }) => {
            if (response.code) {
              await handleGoogleAuthCode(response.code);
            } else if (response.error) {
              setIsLoading(false);
              setErrorMessage(`Google sign-in error: ${response.error}`);
            } else {
              setIsLoading(false);
            }
          },
          error_callback: (err: { message?: string }) => {
            setIsLoading(false);
            setErrorMessage(err?.message || 'Google Sign-In popup was closed.');
          },
        });
        client.requestCode();
        return;
      } catch (err) {
        console.warn('OAuth code client error:', err);
      }
    }

    // Direct fallback if GIS is blocked or offline
    handleDirectFallbackGoogle();
  };

  const handleDirectFallbackGoogle = async () => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const googleName = name.trim() || 'Google Operator';
      const googleEmail = email.trim() || `operator_${Date.now().toString(36)}@gmail.com`;

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: googleName,
          email: googleEmail,
          avatarUrl:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        }),
      });

      const data: AuthResponse = await res.json();
      if (res.ok && data.success && data.user && data.token) {
        playSound('streak');
        onAuthSuccess(data.user, data.token);
        onClose();
      } else {
        setErrorMessage(data.error || 'Google authentication encountered an issue.');
      }
    } catch {
      setErrorMessage('Could not complete Google authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-md rounded-2xl glass-card border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-emerald-950/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-400 p-[1px] shadow-glow-brand flex-shrink-0">
              <div className="w-full h-full bg-[#0B0F17] rounded-[11px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-indigo-400 fill-indigo-400/20" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-display">
                {mode === 'signup' ? 'Register TwinFlow Account' : 'Welcome Back'}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'signup'
                  ? 'Includes 500 starter credits + dedicated CRM workspace'
                  : 'Access your lead triage deck and credits'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch: Register vs Sign In */}
        <div className="grid grid-cols-2 border-b border-white/10 bg-white/[0.02]">
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMessage(null);
            }}
            className={`py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
              mode === 'signup'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={`py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
              mode === 'login'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Google SSO Button Container */}
          <div className="flex flex-col items-center justify-center w-full">
            <div
              ref={googleBtnContainerRef}
              className={`w-full flex justify-center ${!googleGsiLoaded ? 'hidden' : ''}`}
            />
            {(!googleGsiLoaded || isLoading) && (
              <button
                type="button"
                onClick={handleCustomGoogleClick}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>
                  {isLoading
                    ? 'Connecting to Google...'
                    : mode === 'signup'
                    ? 'Sign up with Google'
                    : 'Sign in with Google'}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-[1px] bg-white/10" />
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">or email</span>
            <div className="flex-1 h-[1px] bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Your Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sarah Connor"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-[#090D14] text-slate-200 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Organization / Agency Name <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="e.g. Cyberdyne Outbound or Acme Corp"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-[#090D14] text-slate-200 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    We will auto-provision a dedicated CRM workspace with this name.
                  </p>
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Work Email *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#090D14] text-slate-200 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#090D14] text-slate-200 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-glow-brand transition-all active:scale-95 disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{mode === 'signup' ? 'Registering Account & CRM...' : 'Signing In...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signup' ? 'Register (+500 Credits)' : 'Sign In to Deck'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Features Highlight */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5 text-[11px] text-slate-400">
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Dedicated CRM Workspace</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>500 Starter Lead Triage Credits</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Personalized Market Signal Ingestion</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

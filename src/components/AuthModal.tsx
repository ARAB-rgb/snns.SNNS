import React, { useState } from 'react';
import { Shield, LogOut, AlertTriangle } from 'lucide-react';
import { User } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { supabaseAuth } from '../services/supabaseAuth';
import { SUPPORTED_LANGUAGES } from '../types/i18n';

interface AuthModalProps {
  currentUser: User | null;
  onClose?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ currentUser, onClose }) => {
  const { t } = useLanguage();
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setAuthError(null);
    const result = await supabaseAuth.signInWithGoogle();
    setLoading(false);

    if (result.error) {
      setAuthError(result.error);
    } else if (onClose) {
      onClose();
    }
  };

  const handleLogout = async () => {
    await supabaseAuth.logout();
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 sm:absolute sm:inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl text-slate-100 flex flex-col space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">تسجيل الدخول عبر Supabase</h2>
          </div>
        </div>

        {currentUser ? (
          /* Current Logged In Profile */
          <div className="space-y-4">
            <div className="p-4 bg-slate-800/90 rounded-2xl border border-cyan-500/30 flex items-center gap-3">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-12 h-12 rounded-full object-cover border border-cyan-400"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>{currentUser.name}</span>
                  <span className="text-[10px]">{SUPPORTED_LANGUAGES[currentUser.language]?.flag}</span>
                </div>
                <p className="text-[11px] text-cyan-400 font-medium truncate">{currentUser.email || currentUser.phone || currentUser.statusText}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full py-3 rounded-2xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('logout')}</span>
            </button>
          </div>
        ) : (
          /* Login Screen when no user is logged in */
          <div className="space-y-4 text-center">
            <p className="text-xs text-slate-300 leading-relaxed">
              قم بتسجيل الدخول بحسابك الحقيقي لفتح جميع الميزات، إرسال الرسائل، وبدء المكالمات الصوتية والمرئية.
            </p>

            {authError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-xs text-right flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-900 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              {loading ? (
                <span>جاري تسجيل الدخول...</span>
              ) : (
                <>
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
                  <span>{t('loginWithGoogle')}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


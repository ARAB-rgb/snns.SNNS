import React, { useState } from 'react';
import { Globe, Check, User as UserIcon, Sparkles } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { SUPPORTED_LANGUAGES, LanguageCode } from '../types/i18n';
import { User } from '../types';
import { RealtimeStatusIndicator } from './RealtimeStatusIndicator';

interface HeaderProps {
  currentUser: User;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentUser, onOpenSettings, onOpenAuth }) => {
  const { currentLang, setLanguage, autoDetect, setAutoDetect, direction, t } = useLanguage();
  const [showLangMenu, setShowLangMenu] = useState(false);

  return (
    <header className="w-full bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between text-slate-100 z-20 shadow-sm relative">
      {/* App Branding */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-teal-500 p-0.5 shadow-md shadow-cyan-900/30 flex items-center justify-center">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <span className="text-cyan-400 font-black text-lg tracking-tighter">S</span>
          </div>
        </div>

        <div>
          <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-2">
            <span>{t('appName')}</span>
            <span className="text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded uppercase">
              {direction.toUpperCase()}
            </span>
          </h1>
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span>{SUPPORTED_LANGUAGES[currentLang].nativeName}</span>
            {autoDetect && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                Auto
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Right Controls: Diagnostic Indicator, Language Switcher & Auth Profile */}
      <div className="flex items-center gap-2.5">
        {/* Realtime Socket & Diagnostic Indicator */}
        <RealtimeStatusIndicator />

        {/* Language Quick Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all text-xs font-medium cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-base leading-none">{SUPPORTED_LANGUAGES[currentLang].flag}</span>
            <span className="hidden sm:inline font-semibold">{SUPPORTED_LANGUAGES[currentLang].code.toUpperCase()}</span>
          </button>

          {showLangMenu && (
            <div className="absolute top-full mt-2 right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 w-52 bg-slate-850 bg-slate-900 border border-slate-700 rounded-2xl shadow-xl p-2 z-50 text-xs flex flex-col gap-1 backdrop-blur-xl">
              <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>{t('language')}</span>
                <button
                  onClick={() => {
                    setAutoDetect(!autoDetect);
                    setShowLangMenu(false);
                  }}
                  className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                >
                  {autoDetect ? 'Manual' : 'Auto'}
                </button>
              </div>

              <div className="h-px bg-slate-800 my-1" />

              {Object.values(SUPPORTED_LANGUAGES).map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code as LanguageCode);
                    setShowLangMenu(false);
                  }}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-xl transition-all text-left ${
                    currentLang === lang.code
                      ? 'bg-cyan-500/15 text-cyan-300 font-semibold border border-cyan-500/30'
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{lang.flag}</span>
                    <div>
                      <div className="text-xs font-medium">{lang.nativeName}</div>
                      <div className="text-[10px] text-slate-400">{lang.name} ({lang.direction.toUpperCase()})</div>
                    </div>
                  </div>
                  {currentLang === lang.code && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Account Avatar Button */}
        <button
          onClick={onOpenAuth}
          className="flex items-center gap-2 p-1 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer"
          title={currentUser.name}
        >
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-7 h-7 rounded-full object-cover border border-cyan-500/40"
          />
        </button>
      </div>
    </header>
  );
};

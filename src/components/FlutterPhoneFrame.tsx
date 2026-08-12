import React, { useState } from 'react';
import { Smartphone, Monitor, Wifi, Battery, Signal } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface FlutterPhoneFrameProps {
  children: React.ReactNode;
}

export const FlutterPhoneFrame: React.FC<FlutterPhoneFrameProps> = ({ children }) => {
  const [isPhoneFrame, setIsPhoneFrame] = useState<boolean>(false);
  const { direction, currentLang, t } = useLanguage();

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-start font-sans antialiased transition-colors duration-300 selection:bg-teal-500/30">
      {/* Top Bar for View Toggle */}
      <header className="w-full max-w-6xl px-4 py-2.5 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md text-xs z-30">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-1 rounded-full font-medium">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>SNNS Web Engine</span>
          </div>
          <span className="text-slate-500 hidden sm:inline">•</span>
          <span className="text-slate-400 hidden sm:inline">
            Language: <strong className="text-slate-200 uppercase">{currentLang}</strong> ({direction.toUpperCase()})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPhoneFrame(!isPhoneFrame)}
            className="flex items-center gap-1.5 px-3 py-1.2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all font-medium active:scale-95 cursor-pointer"
            title="Toggle Flutter Phone Frame View"
          >
            {isPhoneFrame ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-teal-400" />
                <span>{t('fullScreen')}</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('phoneFrame')}</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full flex-1 flex items-center justify-center p-0 sm:p-4 overflow-x-hidden">
        {isPhoneFrame ? (
          /* Phone Frame Mockup */
          <div className="relative w-full max-w-[420px] h-[840px] bg-slate-950 rounded-[48px] p-3 shadow-2xl shadow-cyan-950/40 border-[8px] border-slate-800 flex flex-col overflow-hidden my-auto transition-all">
            {/* Phone Notch/Island */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-900 rounded-full z-50 flex items-center justify-center gap-2 border border-slate-800/50">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-950 border border-slate-800" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-900/80" />
            </div>

            {/* Mobile Status Bar */}
            <div className="w-full px-6 pt-2.5 pb-1 flex items-center justify-between text-[11px] font-semibold text-slate-300 z-40 select-none bg-slate-900/90">
              <span>{currentTime}</span>
              <div className="flex items-center gap-1.5">
                <Signal className="w-3 h-3 text-slate-300" />
                <Wifi className="w-3 h-3 text-slate-300" />
                <Battery className="w-3.5 h-3.5 text-slate-300" />
              </div>
            </div>

            {/* Content Area inside Frame */}
            <div className="flex-1 w-full h-full bg-slate-900 overflow-hidden flex flex-col relative rounded-b-[36px]">
              {children}
            </div>

            {/* Home Bar Indicator */}
            <div className="w-full pt-1 pb-0.5 flex justify-center bg-slate-950">
              <div className="w-32 h-1 bg-slate-600/60 rounded-full" />
            </div>
          </div>
        ) : (
          /* Full Web Application View */
          <div className="w-full max-w-5xl h-[calc(100vh-60px)] min-h-[680px] bg-slate-900 sm:rounded-2xl sm:border border-slate-800/80 shadow-2xl flex flex-col overflow-hidden relative">
            {children}
          </div>
        )}
      </main>
    </div>
  );
};

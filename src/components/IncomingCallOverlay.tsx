import React, { useEffect } from 'react';
import { Phone, Video, PhoneOff } from 'lucide-react';
import { User } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { sounds } from '../services/audioSynthesizer';

interface IncomingCallOverlayProps {
  caller: User;
  type: 'audio' | 'video';
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallOverlay: React.FC<IncomingCallOverlayProps> = ({
  caller,
  type,
  onAccept,
  onDecline
}) => {
  const { t } = useLanguage();

  useEffect(() => {
    sounds.startRingtone();
    return () => {
      sounds.stopRingtone();
    };
  }, []);

  return (
    <div className="fixed inset-0 sm:absolute sm:inset-0 bg-slate-950/90 backdrop-blur-xl z-50 flex flex-col items-center justify-between p-6 text-white font-sans animate-in fade-in duration-300 select-none">
      {/* Top Banner */}
      <div className="text-center pt-8">
        <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full tracking-wider uppercase">
          ZegoConnect Live Call
        </span>
        <h2 className="text-lg font-extrabold mt-3 text-slate-100">{t('incomingCall')}</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {type === 'video' ? t('videoCall') : t('audioCall')}
        </p>
      </div>

      {/* Caller Avatar */}
      <div className="flex flex-col items-center my-auto space-y-4">
        <div className="relative">
          <div className="absolute -inset-4 bg-teal-500/20 rounded-full animate-ping opacity-75" />
          <img
            src={caller.avatar}
            alt={caller.name}
            className="relative w-28 h-28 rounded-full object-cover border-4 border-cyan-400 shadow-2xl shadow-cyan-950"
          />
        </div>

        <div className="text-center">
          <h3 className="text-xl font-extrabold text-white">{caller.name}</h3>
          <p className="text-xs text-emerald-400 mt-1 font-medium">{t('ringing')}</p>
        </div>
      </div>

      {/* Accept & Decline Buttons */}
      <div className="w-full max-w-xs flex items-center justify-around pb-8">
        {/* Decline */}
        <button
          onClick={() => {
            sounds.stopRingtone();
            onDecline();
          }}
          className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-950/80 active:scale-95 transition-all cursor-pointer"
          title={t('decline')}
        >
          <PhoneOff className="w-7 h-7" />
        </button>

        {/* Accept */}
        <button
          onClick={() => {
            sounds.stopRingtone();
            onAccept();
          }}
          className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold flex items-center justify-center shadow-lg shadow-emerald-950/80 active:scale-95 transition-all cursor-pointer animate-bounce"
          title={t('accept')}
        >
          {type === 'video' ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
        </button>
      </div>
    </div>
  );
};

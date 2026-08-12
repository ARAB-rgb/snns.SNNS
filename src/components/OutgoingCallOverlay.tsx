import React from 'react';
import { PhoneOff } from 'lucide-react';
import { User } from '../types';

interface OutgoingCallOverlayProps {
  callee: User;
  type: 'audio' | 'video';
  onCancel: () => void;
}

export const OutgoingCallOverlay: React.FC<OutgoingCallOverlayProps> = ({
  callee,
  type,
  onCancel
}) => {
  return (
    <div className="fixed inset-0 sm:absolute sm:inset-0 bg-slate-950/90 backdrop-blur-xl z-50 flex flex-col items-center justify-between p-6 text-white font-sans animate-in fade-in duration-300 select-none">
      {/* Top Banner */}
      <div className="text-center pt-8">
        <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full tracking-wider uppercase">
          ZegoConnect Live Call
        </span>
        <h2 className="text-lg font-extrabold mt-3 text-slate-100">جاري الاتصال...</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {type === 'video' ? 'مكالمة فيديو' : 'مكالمة صوتية'}
        </p>
      </div>

      {/* Callee Avatar */}
      <div className="flex flex-col items-center my-auto space-y-4">
        <div className="relative">
          <div className="absolute -inset-4 bg-cyan-500/20 rounded-full animate-ping opacity-75" />
          <img
            src={callee.avatar}
            alt={callee.name}
            className="relative w-28 h-28 rounded-full object-cover border-4 border-cyan-400 shadow-2xl shadow-cyan-950"
          />
        </div>

        <div className="text-center">
          <h3 className="text-xl font-extrabold text-white">{callee.name}</h3>
          <p className="text-xs text-cyan-400 mt-1 font-medium flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            في انتظار الرد...
          </p>
        </div>
      </div>

      {/* Cancel Button */}
      <div className="w-full max-w-xs flex items-center justify-center pb-8">
        <button
          onClick={onCancel}
          className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-950/80 active:scale-95 transition-all cursor-pointer"
          title="إلغاء المكالمة"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
};

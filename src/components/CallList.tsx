import React, { useState } from 'react';
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Plus, Clock } from 'lucide-react';
import { CallLog, User } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { SUPPORTED_LANGUAGES } from '../types/i18n';

interface CallListProps {
  callLogs: CallLog[];
  users: User[];
  onStartCall: (participant: User, type: 'audio' | 'video') => void;
  onNewCall: () => void;
}

type FilterType = 'all' | 'incoming' | 'outgoing' | 'missed';

export const CallList: React.FC<CallListProps> = ({
  callLogs,
  users,
  onStartCall,
  onNewCall
}) => {
  const { t } = useLanguage();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Filter calculations
  const incomingCount = callLogs.filter((c) => c.direction === 'incoming').length;
  const outgoingCount = callLogs.filter((c) => c.direction === 'outgoing').length;
  const missedCount = callLogs.filter((c) => c.direction === 'missed').length;

  const filteredLogs = callLogs.filter((log) => {
    if (activeFilter === 'incoming') return log.direction === 'incoming';
    if (activeFilter === 'outgoing') return log.direction === 'outgoing';
    if (activeFilter === 'missed') return log.direction === 'missed';
    return true;
  });

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative">
      {/* Top Header */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">{t('calls')}</h2>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700/80 font-mono">
              {callLogs.length}
            </span>
          </div>
          <span className="text-[11px] text-cyan-400 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            ZegoCloud Engine
          </span>
        </div>

        {/* Filter Navigation Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeFilter === 'all'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 border border-slate-700/50'
            }`}
          >
            <span>الكل ({callLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveFilter('incoming')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeFilter === 'incoming'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 border border-slate-700/50'
            }`}
          >
            <PhoneIncoming className="w-3 h-3 text-emerald-400" />
            <span>الواردة ({incomingCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('outgoing')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeFilter === 'outgoing'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 border border-slate-700/50'
            }`}
          >
            <PhoneOutgoing className="w-3 h-3 text-sky-400" />
            <span>الصادرة ({outgoingCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('missed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeFilter === 'missed'
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 border border-slate-700/50'
            }`}
          >
            <PhoneMissed className="w-3 h-3 text-red-400" />
            <span>الفائتة ({missedCount})</span>
          </button>
        </div>
      </div>

      {/* Call Items List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50 p-2 space-y-1">
        {filteredLogs.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
            <Phone className="w-10 h-10 mb-2 text-slate-600" />
            <p className="text-xs">
              {activeFilter === 'incoming'
                ? 'لا توجد مكالمات واردة'
                : activeFilter === 'outgoing'
                ? 'لا توجد مكالمات صادرة'
                : activeFilter === 'missed'
                ? 'لا توجد مكالمات فائتة'
                : t('noCallsYet')}
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const participant = users.find((u) => u.id === log.participantId);
            if (!participant) return null;

            const langInfo = SUPPORTED_LANGUAGES[participant.language] || SUPPORTED_LANGUAGES['ar'];

            // Direction Styling & Labeling
            let DirectionIcon = PhoneIncoming;
            let directionColorClass = 'text-emerald-400';
            let directionBgClass = 'bg-emerald-500/10 border-emerald-500/20';
            let directionLabel = 'واردة';

            if (log.direction === 'outgoing') {
              DirectionIcon = PhoneOutgoing;
              directionColorClass = 'text-sky-400';
              directionBgClass = 'bg-sky-500/10 border-sky-500/20';
              directionLabel = 'صادرة';
            } else if (log.direction === 'missed') {
              DirectionIcon = PhoneMissed;
              directionColorClass = 'text-red-400';
              directionBgClass = 'bg-red-500/15 border-red-500/30';
              directionLabel = 'فائتة';
            }

            return (
              <div
                key={log.id}
                className={`flex items-center justify-between p-3 rounded-2xl transition-all group ${
                  log.direction === 'missed'
                    ? 'bg-red-950/20 hover:bg-red-900/30 border border-red-900/30'
                    : 'hover:bg-slate-800/80 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <img
                      src={participant.avatar}
                      alt={participant.name}
                      className={`w-11 h-11 rounded-full object-cover border ${
                        log.direction === 'missed' ? 'border-red-500/60' : 'border-slate-700'
                      }`}
                    />
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 p-1 rounded-full border border-slate-900 ${directionBgClass}`}
                    >
                      <DirectionIcon className={`w-3 h-3 ${directionColorClass}`} />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3
                        className={`font-semibold text-xs truncate ${
                          log.direction === 'missed' ? 'text-red-300 font-bold' : 'text-slate-100'
                        }`}
                      >
                        {participant.name}
                      </h3>
                      <span className="text-[10px]">{langInfo.flag}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] mt-0.5">
                      {/* Badge Call Direction */}
                      <span
                        className={`px-1.5 py-0.2 rounded-md border text-[9px] font-bold ${directionBgClass} ${directionColorClass}`}
                      >
                        {directionLabel}
                      </span>

                      {/* Call Type Indicator */}
                      <span className="text-slate-400 text-[10px] flex items-center gap-1">
                        {log.type === 'video' ? (
                          <Video className="w-3 h-3 text-teal-400 inline" />
                        ) : (
                          <Phone className="w-3 h-3 text-cyan-400 inline" />
                        )}
                        <span>{log.type === 'video' ? 'فيديو' : 'صوت'}</span>
                      </span>

                      {/* Timestamp & Duration */}
                      <span className="text-slate-400 text-[10px] flex items-center gap-1 truncate">
                        <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{log.timestamp}</span>
                        {log.duration ? <span className="text-slate-300 font-medium">({log.duration})</span> : null}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Call Back Actions */}
                <div className="flex items-center gap-1.5 ml-2 shrink-0">
                  <button
                    onClick={() => onStartCall(participant, 'audio')}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-cyan-600/30 text-cyan-300 border border-slate-700/80 hover:border-cyan-500/40 transition-all cursor-pointer"
                    title={`مكالمة صوتية مع ${participant.name}`}
                  >
                    <Phone className="w-3.5 h-3.5 text-cyan-400" />
                  </button>

                  <button
                    onClick={() => onStartCall(participant, 'video')}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-teal-600/30 text-teal-300 border border-slate-700/80 hover:border-teal-500/40 transition-all cursor-pointer"
                    title={`مكالمة فيديو مع ${participant.name}`}
                  >
                    <Video className="w-3.5 h-3.5 text-teal-400" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={onNewCall}
        className="absolute bottom-4 right-4 ltr:right-4 rtl:left-4 w-13 h-13 rounded-2xl bg-gradient-to-tr from-cyan-600 to-teal-500 text-slate-950 font-bold shadow-lg shadow-cyan-950/60 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer z-10"
        title={t('newCall')}
      >
        <Plus className="w-6 h-6 stroke-[3]" />
      </button>
    </div>
  );
};

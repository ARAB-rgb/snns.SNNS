import React from 'react';
import { User } from '../types';
import { MessageSquare, Phone, Video, Radio } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface OnlineUsersBarProps {
  users: User[];
  onSelectUser: (user: User) => void;
  onStartCall: (user: User, type: 'audio' | 'video') => void;
}

export const OnlineUsersBar: React.FC<OnlineUsersBarProps> = ({
  users,
  onSelectUser,
  onStartCall
}) => {
  const { t } = useLanguage();
  const onlineUsers = users.filter((u) => u.isOnline);

  if (onlineUsers.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-900/90 border-b border-slate-800/80 px-3 py-2.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Radio className="w-3.5 h-3.5" />
          <span>المتواجدون الآن ({onlineUsers.length})</span>
        </div>
        <span className="text-[10px] text-slate-400 font-medium">نشط فورياً</span>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
        {onlineUsers.map((user) => (
          <div
            key={user.id}
            onClick={() => onSelectUser(user)}
            className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
          >
            <div className="relative">
              <div className="p-0.5 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 shadow-md shadow-emerald-950/40 group-hover:scale-105 transition-transform">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-slate-900"
                />
              </div>
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full shadow" />
            </div>

            <span className="text-[11px] font-semibold text-slate-200 truncate max-w-[68px] group-hover:text-cyan-300">
              {user.name}
            </span>

            {/* Direct Quick Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectUser(user);
                }}
                className="p-1 rounded-lg bg-slate-800 text-cyan-400 hover:bg-cyan-500/20"
                title={t('chats')}
              >
                <MessageSquare className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartCall(user, 'audio');
                }}
                className="p-1 rounded-lg bg-slate-800 text-emerald-400 hover:bg-emerald-500/20"
                title={t('audioCall')}
              >
                <Phone className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

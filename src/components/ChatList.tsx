import React, { useState } from 'react';
import { Search, Plus, Video, Phone, CheckCheck, MessageSquare } from 'lucide-react';
import { User, Message } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { SUPPORTED_LANGUAGES } from '../types/i18n';
import { OnlineUsersBar } from './OnlineUsersBar';

interface ChatListProps {
  users: User[];
  conversations: Array<{ id: string; otherUserId: string; lastMessage: string; lastMessageTime: string }>;
  messages: Record<string, Message[]>;
  onSelectUser: (user: User) => void;
  onStartCall: (user: User, type: 'audio' | 'video') => void;
  onNewChat: () => void;
}

export const ChatList: React.FC<ChatListProps> = ({
  users,
  conversations,
  messages,
  onSelectUser,
  onStartCall,
  onNewChat
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useLanguage();

  // Map active conversations to user objects
  const activeChatItems = conversations.map((conv) => {
    const userObj = users.find((u) => u.id === conv.otherUserId) || {
      id: conv.otherUserId,
      name: 'مستخدم',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      language: 'ar' as const,
      isOnline: false,
      lastSeen: conv.lastMessageTime
    };
    const userMsgs = messages[userObj.id] || [];
    const lastMsg = userMsgs[userMsgs.length - 1];

    return {
      user: userObj,
      lastMessageText: lastMsg ? (lastMsg.type === 'image' ? '📷 صورة' : lastMsg.type === 'audio' ? '🎤 تسجيل صوتي' : lastMsg.type === 'file' ? '📁 ملف' : lastMsg.text) : conv.lastMessage,
      timestamp: lastMsg ? lastMsg.timestamp : conv.lastMessageTime,
      lastMsg
    };
  });

  const filteredItems = activeChatItems.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.user.name.toLowerCase().includes(q) ||
      (item.user.email && item.user.email.toLowerCase().includes(q)) ||
      item.lastMessageText.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative">
      {/* Search Input */}
      <div className="p-3 bg-slate-900 border-b border-slate-800">
        <div className="relative flex items-center bg-slate-800/90 rounded-2xl border border-slate-700/80 px-3 py-2 text-slate-200 focus-within:border-cyan-500/80 transition-all">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search')}
            className="w-full bg-transparent px-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Online Users Active Bar */}
      <OnlineUsersBar
        users={users}
        onSelectUser={onSelectUser}
        onStartCall={onStartCall}
      />

      {/* Chat Items List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50 p-2 space-y-1">
        {conversations.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
            <MessageSquare className="w-12 h-12 mb-3 text-slate-600 stroke-[1.5]" />
            <p className="text-xs font-medium text-slate-400">لا توجد محادثات بعد</p>
            <p className="text-[11px] text-slate-500 mt-1">انقر على زر (+) لبدء محادثة جديدة مع مستخدم حقيقي</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
            <Search className="w-8 h-8 mb-2 text-slate-600" />
            <p className="text-xs">لا توجد نتائج مطابقة للبحث</p>
          </div>
        ) : (
          filteredItems.map(({ user, lastMessageText, timestamp, lastMsg }) => {
            const langInfo = SUPPORTED_LANGUAGES[user.language] || SUPPORTED_LANGUAGES['ar'];

            return (
              <div
                key={user.id}
                onClick={() => onSelectUser(user)}
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-800/80 transition-all cursor-pointer group active:scale-[0.99]"
              >
                {/* User Info & Avatar */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-12 h-12 rounded-full object-cover border border-slate-700 group-hover:border-cyan-500/50 transition-colors"
                    />
                    {user.isOnline ? (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                    ) : (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-slate-500 border-2 border-slate-900 rounded-full" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h3 className="font-semibold text-xs text-slate-100 truncate flex items-center gap-1.5">
                        <span>{user.name}</span>
                        {langInfo && (
                          <span className="text-[10px] opacity-80" title={langInfo.name}>
                            {langInfo.flag}
                          </span>
                        )}
                      </h3>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {timestamp}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-400 truncate flex-1">
                        {lastMessageText || 'محادثة جديدة'}
                      </p>
                      {lastMsg && lastMsg.isRead && (
                        <CheckCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Call Action Icons */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity ml-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartCall(user, 'audio');
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-cyan-600/30 text-slate-300 hover:text-cyan-300 transition-all cursor-pointer"
                    title={t('audioCall')}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartCall(user, 'video');
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-teal-600/30 text-slate-300 hover:text-teal-300 transition-all cursor-pointer"
                    title={t('videoCall')}
                  >
                    <Video className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Flutter Floating Action Button (FAB) */}
      <button
        onClick={onNewChat}
        className="absolute bottom-4 right-4 ltr:right-4 rtl:left-4 w-13 h-13 rounded-2xl bg-gradient-to-tr from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-bold shadow-lg shadow-cyan-950/60 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer z-10"
        title={t('newChat')}
      >
        <Plus className="w-6 h-6 stroke-[3]" />
      </button>
    </div>
  );
};

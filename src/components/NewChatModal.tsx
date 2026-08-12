import React, { useState } from 'react';
import { X, Search, User, Mail, MessageSquarePlus } from 'lucide-react';
import { User as UserType } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { SUPPORTED_LANGUAGES } from '../types/i18n';

interface NewChatModalProps {
  users: UserType[];
  onSelectUser: (user: UserType) => void;
  onClose: () => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ users, onSelectUser, onClose }) => {
  const [search, setSearch] = useState('');
  const { t } = useLanguage();

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 sm:absolute sm:inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl p-4 shadow-2xl text-slate-100 flex flex-col space-y-3 max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">{t('startNewChat')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Field */}
        <div className="relative flex items-center bg-slate-800/90 rounded-2xl border border-slate-700/80 px-3 py-2 text-slate-200 focus-within:border-cyan-500/80 transition-all">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchByNameOrEmail')}
            className="w-full bg-transparent px-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none"
          />
        </div>

        {/* Registered Users List */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-72">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
              <User className="w-8 h-8 text-slate-600" />
              <p>لا يوجد مستخدمين آخرين مسجلين</p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const langInfo = SUPPORTED_LANGUAGES[user.language];

              return (
                <button
                  key={user.id}
                  onClick={() => {
                    onSelectUser(user);
                    onClose();
                  }}
                  className="w-full p-2.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 flex items-center justify-between transition-all cursor-pointer group text-right"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-700 group-hover:border-cyan-400 transition-colors"
                      />
                      {user.isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-right">
                      <div className="font-semibold text-xs text-white truncate flex items-center gap-1.5">
                        <span>{user.name}</span>
                        {langInfo && <span className="text-[10px]">{langInfo.flag}</span>}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate dir-ltr text-right">
                        {user.email || user.phone || user.statusText}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

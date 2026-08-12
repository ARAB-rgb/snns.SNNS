import React, { useState } from 'react';
import { Search, MessageSquare, Phone, Video, UserPlus, UserCheck, Radio, Users } from 'lucide-react';
import { User } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { SUPPORTED_LANGUAGES } from '../types/i18n';
import { supabaseService } from '../services/supabaseService';

interface ContactsListProps {
  currentUser: User;
  users: User[];
  onSelectUser: (user: User) => void;
  onStartCall: (participant: User, type: 'audio' | 'video') => void;
  onRefreshUsers?: () => void;
}

export const ContactsList: React.FC<ContactsListProps> = ({
  currentUser,
  users,
  onSelectUser,
  onStartCall,
  onRefreshUsers
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'online' | 'following'>('all');
  const { t } = useLanguage();

  const handleToggleFollow = async (targetUserId: string) => {
    await supabaseService.toggleFollow(currentUser.id, targetUserId);
    if (onRefreshUsers) onRefreshUsers();
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = u.name.toLowerCase().includes(q) || u.phone?.includes(q) || u.email?.includes(q);

    if (!matchesSearch) return false;

    if (activeFilter === 'online') {
      return u.isOnline;
    }
    if (activeFilter === 'following') {
      return u.isFollowedByMe;
    }

    return true;
  });

  const onlineCount = users.filter((u) => u.isOnline).length;
  const followingCount = users.filter((u) => u.isFollowedByMe).length;

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative">
      {/* Search Input & Filter Tabs */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 space-y-2">
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

        {/* Filters */}
        <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0 ${
              activeFilter === 'all'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-750'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>الكل ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveFilter('online')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0 ${
              activeFilter === 'online'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-750'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>المتواجدون الآن ({onlineCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('following')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0 ${
              activeFilter === 'following'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-750'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>أتابَعهم ({followingCount})</span>
          </button>
        </div>
      </div>

      {/* Users List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50 p-2 space-y-1">
        {filteredUsers.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
            <UserPlus className="w-10 h-10 mb-2 text-slate-600" />
            <p className="text-xs">
              {activeFilter === 'online'
                ? 'لا يوجد مستخدمون متصلون الآن'
                : activeFilter === 'following'
                ? 'لم تقم بمتابعة أحد بعد'
                : 'لا توجد جهات اتصال مطابقة'}
            </p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const langInfo = SUPPORTED_LANGUAGES[user.language] || SUPPORTED_LANGUAGES['ar'];

            return (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-800/80 transition-all group"
              >
                <div
                  onClick={() => onSelectUser(user)}
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                >
                  <div className="relative shrink-0">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-11 h-11 rounded-full object-cover border border-slate-700"
                    />
                    {user.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full shadow" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-xs text-slate-100 truncate">
                        {user.name}
                      </h3>
                      <span className="text-[10px]">{langInfo.flag}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span className="truncate">{user.statusText}</span>
                      {user.followersCount !== undefined && user.followersCount > 0 && (
                        <span className="bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-md border border-slate-700/80 shrink-0">
                          {user.followersCount} متابِع
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Follow Button & Call Action Buttons */}
                <div className="flex items-center gap-1.5 ml-2 shrink-0">
                  <button
                    onClick={() => handleToggleFollow(user.id)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      user.isFollowedByMe
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 hover:bg-teal-500/30'
                        : 'bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{user.isFollowedByMe ? 'تتابعه' : 'متابعة'}</span>
                  </button>

                  <button
                    onClick={() => onSelectUser(user)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all cursor-pointer"
                    title={t('chats')}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                  </button>

                  <button
                    onClick={() => onStartCall(user, 'audio')}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-cyan-600/30 text-cyan-300 transition-all cursor-pointer"
                    title={t('audioCall')}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onStartCall(user, 'video')}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-teal-600/30 text-teal-300 transition-all cursor-pointer"
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
    </div>
  );
};


import React from 'react';
import { MessageSquare, Phone, Users, Settings, CircleDot } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export type TabType = 'chats' | 'status' | 'calls' | 'contacts' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  unreadCount?: number;
  missedCallCount?: number;
  hasNewStatus?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  unreadCount = 0,
  missedCallCount = 0,
  hasNewStatus = false
}) => {
  const { t } = useLanguage();

  const navItems = [
    {
      id: 'chats' as TabType,
      label: t('chats'),
      icon: MessageSquare,
      badge: unreadCount > 0 ? unreadCount : null
    },
    {
      id: 'status' as TabType,
      label: t('status'),
      icon: CircleDot,
      hasDot: hasNewStatus
    },
    {
      id: 'calls' as TabType,
      label: t('calls'),
      icon: Phone,
      badge: missedCallCount > 0 ? missedCallCount : null
    },
    {
      id: 'contacts' as TabType,
      label: t('contacts'),
      icon: Users
    },
    {
      id: 'settings' as TabType,
      label: t('settings'),
      icon: Settings
    }
  ];

  return (
    <nav className="w-full bg-slate-950/90 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around z-20">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className="flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer group"
          >
            <div className="relative">
              {/* Flutter Active Indicator Pill */}
              <div
                className={`px-4 py-1.5 rounded-full transition-all duration-300 flex items-center justify-center ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-md shadow-cyan-950/50'
                    : 'text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} />
              </div>

              {/* Badge */}
              {item.badge && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-slate-950 animate-bounce">
                  {item.badge}
                </span>
              )}
              {item.hasDot && !item.badge && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-cyan-400 border border-slate-950 animate-pulse" />
              )}
            </div>

            <span
              className={`text-[11px] font-medium mt-1 transition-colors ${
                isActive ? 'text-cyan-300 font-bold' : 'text-slate-400'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

import React, { useState } from 'react';
import { Shield, Lock, Eye, EyeOff, UserX, Check, X, UserCheck, Smartphone } from 'lucide-react';
import { User, PrivacySettings } from '../types';
import { supabaseService } from '../services/supabaseService';
import { useLanguage } from '../i18n/LanguageContext';

interface PrivacyModalProps {
  currentUser: User;
  users: User[];
  onClose: () => void;
  onUpdateUserPrivacy: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({
  currentUser,
  users,
  onClose,
  onUpdateUserPrivacy
}) => {
  const { t } = useLanguage();
  const initialSettings = supabaseService.getLocalPrivacy(currentUser.id);
  const [settings, setSettings] = useState<PrivacySettings>(initialSettings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const blockedUsers = users.filter((u) => settings.blockedUserIds.includes(u.id));

  const handleSave = async () => {
    await supabaseService.updatePrivacySettings(currentUser.id, settings);
    setSavedSuccess(true);
    onUpdateUserPrivacy();
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleUnblock = async (userId: string) => {
    await supabaseService.toggleBlockUser(currentUser.id, userId);
    const updated = supabaseService.getLocalPrivacy(currentUser.id);
    setSettings(updated);
    onUpdateUserPrivacy();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-100 font-bold text-sm">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span>إعدادات الخصوصية والأمان</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4 text-slate-200 text-xs">
          {/* Encryption Badge */}
          <div className="p-3 bg-gradient-to-r from-cyan-950/40 via-teal-950/30 to-slate-900 border border-cyan-500/30 rounded-2xl flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs">تشفير المحادثات والمكالمات</h4>
              <p className="text-[11px] text-slate-400">
                جميع المراسلات والمكالمات الصوتية والمرئية مشفرة بضمان الخصوصية.
              </p>
            </div>
          </div>

          {/* 1. Last Seen Visibility */}
          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">من يمكنه رؤية آخر ظهور؟</span>
              <Eye className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {[
                { id: 'everyone', label: 'الجميع' },
                { id: 'followers', label: 'المتابعون' },
                { id: 'nobody', label: 'لا أحد' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() =>
                    setSettings({ ...settings, lastSeenVisibility: opt.id as any })
                  }
                  className={`py-2 px-2 rounded-xl font-medium text-[11px] border transition cursor-pointer ${
                    settings.lastSeenVisibility === opt.id
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Hide Online Status (Incognito Mode) */}
          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <EyeOff className="w-4 h-4 text-emerald-400" />
                <span>إخفاء حالة المتصل الآن</span>
              </div>
              <p className="text-[10px] text-slate-400">
                لن يتمكن أحد من رؤيتك متصلاً حتى لو كنت نشطاً باللحظة.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.hideOnlineStatus}
                onChange={(e) => setSettings({ ...settings, hideOnlineStatus: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* 3. Read Receipts (Blue Ticks) */}
          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-cyan-400" />
                <span>مؤشرات قراءة الرسائل (صحين القراءة)</span>
              </div>
              <p className="text-[10px] text-slate-400">
                إظهار تأكيد قراءة الرسائل للطرف الآخر عند فتح المحادثة.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.readReceipts}
                onChange={(e) => setSettings({ ...settings, readReceipts: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
            </label>
          </div>

          {/* 4. Profile Picture Visibility */}
          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60 space-y-2">
            <span className="font-semibold text-slate-200">من يمكنه رؤية الصورة الشخصية؟</span>
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {[
                { id: 'everyone', label: 'الجميع' },
                { id: 'followers', label: 'المتابعون' },
                { id: 'nobody', label: 'لا أحد' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() =>
                    setSettings({ ...settings, profilePhotoVisibility: opt.id as any })
                  }
                  className={`py-2 px-2 rounded-xl font-medium text-[11px] border transition cursor-pointer ${
                    settings.profilePhotoVisibility === opt.id
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 font-bold'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Blocked Users List */}
          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <UserX className="w-4 h-4 text-red-400" />
                <span>قائمة المحظورين ({blockedUsers.length})</span>
              </div>
            </div>

            {blockedUsers.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic py-1">لا يوجد مستخدمون محظورون.</p>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pt-1">
                {blockedUsers.map((bu) => (
                  <div
                    key={bu.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-800 border border-slate-700 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <img src={bu.avatar} alt={bu.name} className="w-7 h-7 rounded-full object-cover" />
                      <span className="font-semibold text-slate-200">{bu.name}</span>
                    </div>
                    <button
                      onClick={() => handleUnblock(bu.id)}
                      className="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] border border-red-500/30 cursor-pointer"
                    >
                      إلغاء الحظر
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            إلغاء
          </button>

          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            {savedSuccess ? <Check className="w-4 h-4" /> : null}
            <span>{savedSuccess ? 'تم الحفظ!' : 'حفظ التغييرات'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

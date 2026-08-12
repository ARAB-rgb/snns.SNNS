import React, { useState, useEffect } from 'react';
import { Globe, Shield, Sparkles, Check, RefreshCw, LogOut, Lock, Users, UserCheck, ChevronLeft, ChevronRight, Activity, Database, Radio, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { SUPPORTED_LANGUAGES, LanguageCode } from '../types/i18n';
import { User } from '../types';
import { supabaseAuth } from '../services/supabaseAuth';
import { diagnosticsManager, DiagnosticsInfo } from '../services/supabaseService';

interface SettingsScreenProps {
  currentUser: User;
  onOpenAuth: () => void;
  onOpenPrivacy: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  currentUser,
  onOpenAuth,
  onOpenPrivacy
}) => {
  const { currentLang, setLanguage, autoDetect, setAutoDetect, direction, t } = useLanguage();
  const [diagInfo, setDiagInfo] = useState<DiagnosticsInfo>(diagnosticsManager.getDiagnostics());

  useEffect(() => {
    diagnosticsManager.runHealthCheck(currentUser.id);
    const unsub = diagnosticsManager.subscribe((info) => {
      setDiagInfo(info);
    });
    return () => unsub();
  }, [currentUser.id]);

  const handleTestDiagnostics = () => {
    diagnosticsManager.runHealthCheck(currentUser.id);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-y-auto p-4 space-y-4 text-slate-100">
      {/* Profile Header */}
      <div className="bg-slate-800/90 rounded-3xl p-4 border border-slate-700/80 shadow-md flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-cyan-400 shadow-md"
            />
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>{currentUser.name}</span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  {SUPPORTED_LANGUAGES[currentUser.language]?.flag}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 truncate max-w-[180px] sm:max-w-[240px]">
                {currentUser.email || currentUser.phone || currentUser.statusText}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenAuth}
            className="p-2.5 rounded-2xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('switchAccount')}</span>
          </button>
        </div>

        {/* Follow Stats */}
        <div className="flex items-center justify-around pt-2 border-t border-slate-700/60 text-center">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-cyan-400" />
            <div className="text-xs">
              <span className="font-bold text-white">{currentUser.followersCount || 0}</span>
              <span className="text-slate-400 mr-1">المتابعون</span>
            </div>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-teal-400" />
            <div className="text-xs">
              <span className="font-bold text-white">{currentUser.followingCount || 0}</span>
              <span className="text-slate-400 mr-1">يتابع</span>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostics Panel */}
      <div className="bg-slate-800/80 rounded-3xl p-4 border border-slate-700/80 shadow-md space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">تشخيص الرسائل والمكالمات (Diagnostics)</h3>
          </div>
          <button
            onClick={handleTestDiagnostics}
            className="text-[10px] bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-2.5 py-1 rounded-full border border-cyan-500/30 cursor-pointer transition-all flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>فحص الاتصال</span>
          </button>
        </div>

        {/* Message Diagnostics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {/* Auth */}
          <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-300">Auth</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                diagInfo.authStatus === 'Connected'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-red-500/20 text-red-300 border-red-500/40'
              }`}
            >
              {diagInfo.authStatus}
            </span>
          </div>

          {/* Database */}
          <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-slate-300">Database</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                diagInfo.dbStatus === 'Connected'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-red-500/20 text-red-300 border-red-500/40'
              }`}
            >
              {diagInfo.dbStatus}
            </span>
          </div>

          {/* Messages Realtime */}
          <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-300">Messages Realtime</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                diagInfo.realtimeStatus === 'SUBSCRIBED'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : diagInfo.realtimeStatus === 'Connecting'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-red-500/20 text-red-300 border-red-500/40'
              }`}
            >
              {diagInfo.realtimeStatus}
            </span>
          </div>

          {/* Last message insert */}
          <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-300">Last message insert</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                diagInfo.lastInsertStatus === 'Success'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : diagInfo.lastInsertStatus === 'Failed'
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : 'bg-slate-700/50 text-slate-400 border-slate-600/50'
              }`}
            >
              {diagInfo.lastInsertStatus}
            </span>
          </div>
        </div>

        {/* Call Diagnostics Section */}
        <div className="pt-2 border-t border-slate-700/60">
          <h4 className="text-[11px] font-bold text-cyan-400 mb-2 uppercase tracking-wide">تشخيص المكالمات (Call Diagnostics)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* Calls Realtime */}
            <div className="flex items-center justify-between p-2 bg-slate-900/60 rounded-xl border border-slate-700/50">
              <span className="text-slate-300">Calls Realtime</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                diagInfo.callsRealtimeStatus === 'SUBSCRIBED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                {diagInfo.callsRealtimeStatus}
              </span>
            </div>

            {/* Edge Function Token */}
            <div className="flex items-center justify-between p-2 bg-slate-900/60 rounded-xl border border-slate-700/50">
              <span className="text-slate-300">Edge Token</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                diagInfo.edgeFunctionTokenStatus === 'Success' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : diagInfo.edgeFunctionTokenStatus === 'Failed' ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-slate-700/50 text-slate-400 border-slate-600/50'
              }`}>
                {diagInfo.edgeFunctionTokenStatus}
              </span>
            </div>

            {/* ZEGOCLOUD SDK */}
            <div className="flex items-center justify-between p-2 bg-slate-900/60 rounded-xl border border-slate-700/50">
              <span className="text-slate-300">ZEGOCLOUD SDK</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                diagInfo.zegoSdkStatus === 'Ready' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                {diagInfo.zegoSdkStatus}
              </span>
            </div>

            {/* Call Status */}
            <div className="flex items-center justify-between p-2 bg-slate-900/60 rounded-xl border border-slate-700/50">
              <span className="text-slate-300">Call Status</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                {diagInfo.callStatus}
              </span>
            </div>

            {/* Camera Permission */}
            <div className="flex items-center justify-between p-2 bg-slate-900/60 rounded-xl border border-slate-700/50">
              <span className="text-slate-300">Camera Perm</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                diagInfo.cameraPermission === 'Granted' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : diagInfo.cameraPermission === 'Denied' ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-slate-700/50 text-slate-400 border-slate-600/50'
              }`}>
                {diagInfo.cameraPermission}
              </span>
            </div>

            {/* Microphone Permission */}
            <div className="flex items-center justify-between p-2 bg-slate-900/60 rounded-xl border border-slate-700/50">
              <span className="text-slate-300">Microphone Perm</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                diagInfo.microphonePermission === 'Granted' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : diagInfo.microphonePermission === 'Denied' ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-slate-700/50 text-slate-400 border-slate-600/50'
              }`}>
                {diagInfo.microphonePermission}
              </span>
            </div>
          </div>
        </div>

        {diagInfo.currentCallId && (
          <div className="p-2.5 bg-slate-950/80 rounded-2xl border border-slate-800 text-[10px] font-mono space-y-1 text-slate-400">
            <div><span className="text-cyan-400">call_id:</span> {diagInfo.currentCallId}</div>
            {diagInfo.currentRoomId && <div><span className="text-teal-400">room_id:</span> {diagInfo.currentRoomId}</div>}
            {diagInfo.lastCallError && <div className="text-red-400"><span>Error:</span> {diagInfo.lastCallError}</div>}
          </div>
        )}
      </div>

      {/* 1. Privacy & Security Entry */}
      <button
        onClick={onOpenPrivacy}
        className="w-full bg-slate-800/80 hover:bg-slate-800 rounded-3xl p-4 border border-slate-700/80 shadow-sm flex items-center justify-between text-right cursor-pointer transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
              إعدادات الخصوصية والأمان
            </h3>
            <p className="text-[11px] text-slate-400">
              آخر ظهور، المتصل الآن، المحظورون، ومؤشرات القراءة
            </p>
          </div>
        </div>

        {direction === 'rtl' ? (
          <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:text-slate-200 transition-colors" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-200 transition-colors" />
        )}
      </button>

      {/* 2. Language & Direction Settings */}
      <div className="bg-slate-800/60 rounded-3xl p-4 border border-slate-700/60 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">{t('language')}</h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full">
              {direction === 'rtl' ? t('rtlMode') : t('ltrMode')}
            </span>
          </div>
        </div>

        {/* Auto Detect Toggle */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800 border border-slate-700/60 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="font-semibold text-slate-200">{t('autoDetectLanguage')}</div>
              <div className="text-[10px] text-slate-400">تحديد تلقائي من متصفح الجهاز</div>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoDetect}
              onChange={(e) => setAutoDetect(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
          </label>
        </div>

        {/* Language Grid Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
          {Object.values(SUPPORTED_LANGUAGES).map((lang) => {
            const isSelected = currentLang === lang.code;

            return (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code as LanguageCode)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-tr from-cyan-600/30 to-teal-600/20 border-cyan-500 text-white shadow-md'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xl">{lang.flag}</span>
                  {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                </div>

                <div>
                  <div className="text-xs font-bold">{lang.nativeName}</div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
                    <span>{lang.name}</span>
                    <span className="uppercase text-[9px] font-semibold">{lang.direction}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Account Info & Logout */}
      <div className="bg-slate-800/60 rounded-3xl p-4 border border-slate-700/60 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-700/60">
          <Shield className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">أمان الحساب</h3>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          أنت مسجل حالياً عبر حساب جوجل المحقق ({currentUser.email || currentUser.name}). جميع البيانات مشفرة ومحفوظة آمنة في Supabase.
        </p>

        <button
          onClick={() => supabaseAuth.logout()}
          className="w-full py-2.5 rounded-2xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{t('logout')}</span>
        </button>
      </div>
    </div>
  );
};


import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, Wifi, WifiOff, RefreshCw, Server, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useLanguage } from '../i18n/LanguageContext';

export interface RealtimeDiagnosticState {
  status: 'connected' | 'connecting' | 'disconnected' | 'error' | 'not_configured';
  latencyMs: number | null;
  lastChecked: Date | null;
  activeChannelsCount: number;
  reconnectCount: number;
  errorMessage: string | null;
}

export const useRealtimeDiagnostic = () => {
  const [diagnostic, setDiagnostic] = useState<RealtimeDiagnosticState>({
    status: isSupabaseConfigured ? 'connecting' : 'not_configured',
    latencyMs: null,
    lastChecked: null,
    activeChannelsCount: 0,
    reconnectCount: 0,
    errorMessage: null,
  });

  const channelRef = useRef<any>(null);
  const isCheckingRef = useRef(false);

  const measureLatency = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setDiagnostic((prev) => ({ ...prev, status: 'not_configured', latencyMs: null }));
      return;
    }

    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    const startTime = performance.now();
    try {
      // Light payload head request to verify server responsiveness & latency
      const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1);

      const endTime = performance.now();
      const roundTripTime = Math.round(endTime - startTime);

      // Check active channels count
      const channels = supabase.getChannels();
      const activeCount = channels.length;

      if (error && error.code !== 'PGRST116') {
        setDiagnostic((prev) => ({
          ...prev,
          status: 'error',
          latencyMs: roundTripTime,
          lastChecked: new Date(),
          activeChannelsCount: activeCount,
          errorMessage: error.message || 'فشل الاتصال بقاعدة البيانات',
        }));
      } else {
        setDiagnostic((prev) => ({
          ...prev,
          status: 'connected',
          latencyMs: roundTripTime,
          lastChecked: new Date(),
          activeChannelsCount: activeCount,
          errorMessage: null,
        }));
      }
    } catch (err: any) {
      setDiagnostic((prev) => ({
        ...prev,
        status: 'disconnected',
        latencyMs: null,
        lastChecked: new Date(),
        errorMessage: err?.message || 'انقطع الاتصال بالشبكة',
      }));
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  const forceReconnect = useCallback(async () => {
    setDiagnostic((prev) => ({
      ...prev,
      status: 'connecting',
      reconnectCount: prev.reconnectCount + 1,
      errorMessage: null,
    }));

    try {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      // Re-establish a diagnostic heartbeat channel
      const pingChannel = supabase.channel(`diagnostic_ping_${Date.now()}`);
      channelRef.current = pingChannel;

      pingChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await measureLatency();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setDiagnostic((prev) => ({
            ...prev,
            status: 'disconnected',
            errorMessage: `قناة الاتصال الفوري: ${status}`,
          }));
        }
      });
    } catch (e: any) {
      setDiagnostic((prev) => ({
        ...prev,
        status: 'disconnected',
        errorMessage: e?.message || 'إعادة المحاولة فشلت',
      }));
    }
  }, [measureLatency]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setDiagnostic({
        status: 'not_configured',
        latencyMs: null,
        lastChecked: new Date(),
        activeChannelsCount: 0,
        reconnectCount: 0,
        errorMessage: 'إعدادات Supabase غير مكتملة',
      });
      return;
    }

    // Initial check
    measureLatency();

    // Setup periodic diagnostic ping every 10 seconds
    const interval = setInterval(() => {
      measureLatency();
    }, 10000);

    // Also monitor online/offline window events
    const handleOnline = () => {
      measureLatency();
    };
    const handleOffline = () => {
      setDiagnostic((prev) => ({
        ...prev,
        status: 'disconnected',
        latencyMs: null,
        errorMessage: 'جهازك غير متصل بالإنترنت',
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [measureLatency]);

  return { diagnostic, measureLatency, forceReconnect };
};

export const RealtimeStatusIndicator: React.FC = () => {
  const { diagnostic, measureLatency, forceReconnect } = useRealtimeDiagnostic();
  const [showModal, setShowModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { currentLang } = useLanguage();
  const isRtl = currentLang === 'ar' || currentLang === 'ur';

  const handleManualCheck = async () => {
    setIsRefreshing(true);
    await forceReconnect();
    await measureLatency();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const getLatencyQuality = (ms: number | null) => {
    if (ms === null) return { color: 'text-slate-400', label: isRtl ? 'غير محدد' : 'N/A' };
    if (ms < 80) return { color: 'text-emerald-400', label: isRtl ? 'ممتاز' : 'Excellent' };
    if (ms < 200) return { color: 'text-amber-400', label: isRtl ? 'جيد' : 'Good' };
    return { color: 'text-rose-400', label: isRtl ? 'بطيء' : 'Slow' };
  };

  const latencyInfo = getLatencyQuality(diagnostic.latencyMs);

  return (
    <div className="relative">
      {/* Header Status Button */}
      <button
        onClick={() => setShowModal(!showModal)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-xs font-semibold cursor-pointer ${
          diagnostic.status === 'connected'
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/50 shadow-sm shadow-emerald-950'
            : diagnostic.status === 'connecting'
            ? 'bg-amber-950/40 border-amber-500/30 text-amber-300 hover:bg-amber-900/50 animate-pulse'
            : diagnostic.status === 'not_configured'
            ? 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-700'
            : 'bg-rose-950/50 border-rose-500/40 text-rose-300 hover:bg-rose-900/60 animate-bounce-short shadow-md shadow-rose-950'
        }`}
        title={isRtl ? 'تشخيص الاتصال الفوري بالخادم' : 'Server Connection Diagnostic'}
      >
        {diagnostic.status === 'connected' ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline font-mono text-[11px]">
              {diagnostic.latencyMs !== null ? `${diagnostic.latencyMs}ms` : (isRtl ? 'متصل' : 'Online')}
            </span>
          </>
        ) : diagnostic.status === 'connecting' ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span className="hidden sm:inline text-[11px]">{isRtl ? 'جارٍ التوصيل...' : 'Connecting...'}</span>
          </>
        ) : diagnostic.status === 'not_configured' ? (
          <>
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline text-[11px]">{isRtl ? 'محلّي' : 'Local'}</span>
          </>
        ) : (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <WifiOff className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[11px] font-bold text-rose-300">{isRtl ? 'انقطع الاتصال!' : 'Disconnected!'}</span>
          </>
        )}
      </button>

      {/* Diagnostic Details Popover/Modal */}
      {showModal && (
        <div
          className={`absolute top-full mt-2 ${
            isRtl ? 'left-0 sm:left-auto sm:right-0' : 'right-0'
          } w-80 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl p-4 z-50 text-xs backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150 text-slate-200`}
        >
          {/* Title bar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-sm text-white">
                {isRtl ? 'فحص الاتصال الفوري (Realtime)' : 'Realtime Diagnostics'}
              </h3>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded-lg hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          {/* Status Alert Banner */}
          <div
            className={`my-3 p-3 rounded-xl border flex items-start gap-2.5 ${
              diagnostic.status === 'connected'
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                : diagnostic.status === 'connecting'
                ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                : diagnostic.status === 'not_configured'
                ? 'bg-slate-800/80 border-slate-700 text-slate-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            }`}
          >
            {diagnostic.status === 'connected' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : diagnostic.status === 'connecting' ? (
              <RefreshCw className="w-5 h-5 text-amber-400 animate-spin shrink-0 mt-0.5" />
            ) : diagnostic.status === 'not_configured' ? (
              <Server className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold text-xs">
                {diagnostic.status === 'connected'
                  ? (isRtl ? 'الاتصال بالسيرفر يعمل بكفاءة عالية' : 'Messaging connection active')
                  : diagnostic.status === 'connecting'
                  ? (isRtl ? 'جاري التحقق من استجابة السيرفر...' : 'Testing server connectivity...')
                  : diagnostic.status === 'not_configured'
                  ? (isRtl ? 'تطبيقك يعمل في الوضع المحلي التلقائي' : 'Running in local mode')
                  : (isRtl ? 'تعذر الاتصال بسيرفر الرسائل الفورية!' : 'Messaging server connection lost!')}
              </div>
              {diagnostic.errorMessage && (
                <p className="text-[11px] opacity-80 mt-1 leading-relaxed font-mono">
                  {diagnostic.errorMessage}
                </p>
              )}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 my-3 text-[11px]">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-0.5">{isRtl ? 'زمن الاستجابة (Ping)' : 'Latency'}</span>
              <div className="font-bold text-sm flex items-center gap-1">
                <span className={latencyInfo.color}>
                  {diagnostic.latencyMs !== null ? `${diagnostic.latencyMs} ms` : '—'}
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${latencyInfo.color} bg-slate-900 border border-current/20`}>
                  {latencyInfo.label}
                </span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-0.5">{isRtl ? 'قنوات الاستماع' : 'Active Channels'}</span>
              <div className="font-bold text-sm text-cyan-300 font-mono">
                {diagnostic.activeChannelsCount} {isRtl ? 'قناة' : 'channels'}
              </div>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-0.5">{isRtl ? 'آخر فحص' : 'Last Ping'}</span>
              <div className="font-medium text-slate-200">
                {diagnostic.lastChecked
                  ? diagnostic.lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : '—'}
              </div>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-0.5">{isRtl ? 'محاولات الربط' : 'Reconnects'}</span>
              <div className="font-medium text-slate-200 font-mono">
                {diagnostic.reconnectCount} {isRtl ? 'مرة' : 'times'}
              </div>
            </div>
          </div>

          {/* Footer Action */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Supabase Realtime Engine
            </span>
            <button
              onClick={handleManualCheck}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold transition-all cursor-pointer shadow-sm shadow-cyan-900/40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRtl ? 'إعادة الفحص الآن' : 'Test Connection'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

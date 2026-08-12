import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, Hand, Signal, Volume2, ShieldCheck } from 'lucide-react';
import { ActiveCallState, User } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { zegoCallService } from '../services/zegoCallService';
import { sounds } from '../services/audioSynthesizer';

interface CallScreenProps {
  callState: ActiveCallState;
  onEndCall: () => void;
}

export const CallScreen: React.FC<CallScreenProps> = ({ callState, onEndCall }) => {
  const { t } = useLanguage();

  const [isMuted, setIsMuted] = useState(callState.isMuted);
  const [isVideoOff, setIsVideoOff] = useState(callState.isVideoOff);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [hasHandRaised, setHasHandRaised] = useState(false);
  const [duration, setDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  // Call duration counter
  useEffect(() => {
    sounds.playConnectedChime();
    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize camera and video stream
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function setupCamera() {
      if (callState.type === 'video' && !isVideoOff) {
        try {
          if (navigator.mediaDevices?.getUserMedia) {
            activeStream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
              audio: true
            });
            if (activeStream && localVideoRef.current) {
              localVideoRef.current.srcObject = activeStream;
            }
          }
        } catch (err) {
          console.warn('Camera permission denied or unavailable:', err);
        }
      }
    }
    setupCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [callState.type, isVideoOff]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleVideo = async () => {
    const nextVideoOff = !isVideoOff;
    setIsVideoOff(nextVideoOff);
    if (!nextVideoOff && localVideoRef.current) {
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            audio: true
          });
          if (stream) {
            localVideoRef.current.srcObject = stream;
          }
        }
      } catch (err) {
        console.warn('Camera stream error:', err);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        if (navigator.mediaDevices?.getDisplayMedia) {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });
          if (stream && screenVideoRef.current) {
            screenVideoRef.current.srcObject = stream;
            setIsScreenSharing(true);
          }
        }
      } catch (err) {
        console.warn('Screen share canceled:', err);
      }
    } else {
      setIsScreenSharing(false);
    }
  };

  const handleEnd = () => {
    sounds.playHangupTone();
    onEndCall();
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const { participant, roomId } = callState;

  return (
    <div className="fixed inset-0 sm:absolute sm:inset-0 bg-slate-950 text-white flex flex-col justify-between z-50 overflow-hidden font-sans select-none">
      {/* Background Stream View */}
      <div className="absolute inset-0 z-0 bg-slate-900 flex items-center justify-center">
        {callState.type === 'video' && !isVideoOff ? (
          /* Remote Video or Screen Share */
          <div className="relative w-full h-full flex items-center justify-center">
            {isScreenSharing ? (
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              /* Participant Video Simulation with Live Mirror */
              <div className="relative w-full h-full bg-slate-900 overflow-hidden flex items-center justify-center">
                <img
                  src={participant.avatar}
                  alt={participant.name}
                  className="w-full h-full object-cover blur-xl opacity-20 absolute inset-0 scale-110"
                />
                <div className="relative z-10 text-center flex flex-col items-center">
                  <div className="relative">
                    <img
                      src={participant.avatar}
                      alt={participant.name}
                      className="w-28 h-28 rounded-full object-cover border-4 border-cyan-500/50 shadow-2xl shadow-cyan-500/20 mb-3"
                    />
                    <span className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-2 border-slate-950 rounded-full" />
                  </div>
                  <h3 className="text-base font-bold text-slate-100">{participant.name}</h3>
                  <p className="text-xs text-cyan-400 mt-1 font-medium flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                    <span>ZegoCloud HD Audio & Video Stream</span>
                  </p>
                </div>
              </div>
            )}

            {/* Local Video Picture-in-Picture (PIP) */}
            <div className="absolute bottom-24 right-4 ltr:right-4 rtl:left-4 w-28 h-40 sm:w-36 sm:h-48 bg-slate-800 rounded-2xl border-2 border-slate-700 shadow-2xl overflow-hidden z-20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <span className="absolute bottom-1 left-1.5 text-[9px] bg-slate-900/80 px-1.5 py-0.5 rounded text-slate-300 font-semibold">
                You
              </span>
            </div>
          </div>
        ) : (
          /* Audio Call Avatar View */
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="relative">
              {/* Pulsing Audio Ripples */}
              <div className="absolute -inset-4 bg-cyan-500/20 rounded-full animate-ping opacity-75" />
              <div className="absolute -inset-8 bg-teal-500/10 rounded-full animate-pulse" />

              <img
                src={participant.avatar}
                alt={participant.name}
                className="relative w-32 h-32 rounded-full object-cover border-4 border-cyan-400 shadow-2xl"
              />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">{participant.name}</h2>
              <p className="text-xs text-cyan-300 mt-1 font-semibold flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{t('callConnected')} ({formatDuration(duration)})</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Top Header Bar */}
      <div className="relative z-20 p-4 bg-gradient-to-b from-slate-950/90 to-transparent flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold text-[11px]">
            {t('zegoRoom')}: {roomId.slice(0, 14)}
          </span>
          <span className="text-emerald-400 text-[11px] font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            {formatDuration(duration)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded-full border border-slate-800">
          <Signal className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px]">{t('excellent')}</span>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="relative z-20 p-4 pb-8 sm:pb-4 bg-gradient-to-t from-slate-950/95 via-slate-950/80 to-transparent flex items-center justify-center gap-3">
        {/* Mute Mic */}
        <button
          onClick={toggleMute}
          className={`p-3.5 rounded-2xl transition-all cursor-pointer ${
            isMuted
              ? 'bg-red-500/20 text-red-400 border border-red-500/40'
              : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
          title={isMuted ? t('unmuteMic') : t('muteMic')}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Video Cam Off */}
        {callState.type === 'video' && (
          <button
            onClick={toggleVideo}
            className={`p-3.5 rounded-2xl transition-all cursor-pointer ${
              isVideoOff
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title={isVideoOff ? t('cameraOn') : t('cameraOff')}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        )}

        {/* Screen Share */}
        <button
          onClick={toggleScreenShare}
          className={`p-3.5 rounded-2xl transition-all cursor-pointer ${
            isScreenSharing
              ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
              : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
          title={t('shareScreen')}
        >
          <Monitor className="w-5 h-5" />
        </button>

        {/* Raise Hand */}
        <button
          onClick={() => setHasHandRaised(!hasHandRaised)}
          className={`p-3.5 rounded-2xl transition-all cursor-pointer ${
            hasHandRaised
              ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
              : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
          title={t('raiseHand')}
        >
          <Hand className="w-5 h-5" />
        </button>

        {/* End Call */}
        <button
          onClick={handleEnd}
          className="p-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-950/60 active:scale-95 transition-all cursor-pointer ml-2"
          title={t('endCall')}
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

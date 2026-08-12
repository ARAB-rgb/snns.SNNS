import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, Phone, Video, Send, Mic, Image, Paperclip,
  Smile, Trash2, Reply, X, Play, Pause, CheckCheck,
  Sparkles, FileText, Download, Loader2, Maximize2
} from 'lucide-react';
import { User, Message } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { SUPPORTED_LANGUAGES } from '../types/i18n';
import { sounds } from '../services/audioSynthesizer';
import { supabaseService } from '../services/supabaseService';
import { supabase } from '../lib/supabase';

interface ChatDetailProps {
  currentUserId: string;
  participant: User;
  messages: Message[];
  onBack: () => void;
  onSendMessage: (
    text: string,
    type?: 'text' | 'audio' | 'image' | 'file',
    mediaUrl?: string,
    fileName?: string,
    replyTo?: { id: string; text: string; senderName?: string }
  ) => Promise<boolean> | void;
  onDeleteMessage?: (messageId: string) => void;
  onStartCall: (participant: User, type: 'audio' | 'video') => void;
}

const EMOJI_LIST = ['😀', '😂', '😍', '👍', '❤️', '🔥', '🎉', '🙏', '😊', '🤝', '🙌', '✨'];

export const ChatDetail: React.FC<ChatDetailProps> = ({
  currentUserId,
  participant,
  messages,
  onBack,
  onSendMessage,
  onDeleteMessage,
  onStartCall
}) => {
  const { currentLang, direction, t } = useLanguage();
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, boolean>>({});
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; text: string; senderName?: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean up audio player on unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []);

  // Real Audio playback for voice messages using HTML5 Audio
  const togglePlayAudio = (msgId: string, url?: string) => {
    if (!url || url === '#') return;

    if (playingAudioId === msgId) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setPlayingAudioId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const newAudio = new Audio(url);
      audioPlayerRef.current = newAudio;
      setPlayingAudioId(msgId);

      newAudio.onended = () => {
        setPlayingAudioId(null);
      };

      newAudio.onerror = (e) => {
        console.warn('Audio playback error:', e);
        setPlayingAudioId(null);
      };

      newAudio.play().catch((err) => {
        console.warn('Playback failed:', err);
        setPlayingAudioId(null);
      });
    }
  };

  // Voice recording logic using Web MediaRecorder API & Supabase Storage
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        setIsUploading(true);
        setUploadStatusText('جاري رفع التسجيل الصوتي إلى السحابة...');
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
          const fileName = `voice_${Date.now()}.${ext}`;

          const uploadRes = await supabaseService.uploadAttachment(audioBlob, fileName, mimeType);
          if (uploadRes?.url) {
            const success = await onSendMessage('تسجيل صوتي', 'audio', uploadRes.url, fileName, replyingTo || undefined);
            if (success !== false) {
              setReplyingTo(null);
              sounds.playMessageSentSound();
            }
          } else {
            console.error('Failed to upload voice recording to Supabase Storage');
          }
        } catch (err) {
          console.error('Voice note upload exception:', err);
        } finally {
          setIsUploading(false);
          setUploadStatusText('');
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      recorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Mic access error for voice note:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleSend = async () => {
    console.log('SEND_BUTTON_CLICKED');
    setSendError(null);

    const trimmedMessage = inputText.trim();
    if (!trimmedMessage) {
      return;
    }

    const {
      data: { session }
    } = await supabase.auth.getSession();

    const conversationId = await supabaseService.ensureConversation(currentUserId, participant.id);

    console.log({
      messageText: trimmedMessage,
      currentUserId,
      targetUserId: participant.id,
      conversationId,
      session
    });

    if (!session) {
      const sessionErr = 'انتهت الجلسة، سجل الدخول مجددًا';
      console.error(sessionErr);
      setSendError(sessionErr);
      return;
    }

    if (isUploading || isSending) return;

    setIsSending(true);
    try {
      if (!conversationId) {
        const convErr = 'فشل إنشاء أو تحديد رقم المحادثة';
        console.error(convErr);
        setSendError(convErr);
        return;
      }

      const success = await onSendMessage(trimmedMessage, 'text', undefined, undefined, replyingTo || undefined);
      if (success !== false) {
        setInputText('');
        setReplyingTo(null);
        setShowEmojiPicker(false);
        sounds.playMessageSentSound();
      } else {
        const sendFailErr = 'فشل إرسال الرسالة إلى قاعدة البيانات';
        console.error(sendFailErr);
        setSendError(sendFailErr);
      }
    } catch (err: any) {
      console.error('Error in handleSend:', err);
      setSendError(err?.message || 'حدث خطأ أثناء إرسال الرسالة');
    } finally {
      setIsSending(false);
    }
  };

  const toggleTranslation = (msgId: string) => {
    setTranslatedMessages((prev) => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatusText('جاري رفع الصورة إلى التخزين السحابي...');
    try {
      const uploadRes = await supabaseService.uploadAttachment(file, file.name, file.type);
      if (uploadRes?.url) {
        const success = await onSendMessage('صورة', 'image', uploadRes.url, file.name, replyingTo || undefined);
        if (success !== false) {
          setReplyingTo(null);
          sounds.playMessageSentSound();
        }
      } else {
        console.error('Supabase image upload failed. Image message not sent.');
      }
    } catch (err) {
      console.error('Image upload exception:', err);
    } finally {
      setIsUploading(false);
      setUploadStatusText('');
      e.target.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatusText('جاري رفع الملف إلى التخزين السحابي...');
    try {
      const uploadRes = await supabaseService.uploadAttachment(file, file.name, file.type);
      if (uploadRes?.url) {
        const success = await onSendMessage(`ملف: ${file.name}`, 'file', uploadRes.url, file.name, replyingTo || undefined);
        if (success !== false) {
          setReplyingTo(null);
          sounds.playMessageSentSound();
        }
      } else {
        console.error('Supabase file upload failed. File message not sent.');
      }
    } catch (err) {
      console.error('File upload exception:', err);
    } finally {
      setIsUploading(false);
      setUploadStatusText('');
      e.target.value = '';
    }
  };

  const addEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  const langInfo = SUPPORTED_LANGUAGES[participant.language] || SUPPORTED_LANGUAGES['ar'];

  return (
    <div className="flex-1 flex flex-col bg-slate-950 h-full overflow-hidden relative">
      {/* Image Lightbox Modal */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-10 right-0 p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImageUrl}
              alt="Expanded view"
              className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-slate-800"
            />
            <a
              href={previewImageUrl}
              download="image.jpg"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
            >
              <Download className="w-4 h-4" />
              <span>تنزيل الصورة</span>
            </a>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="px-3 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
            title="رجوع"
          >
            <ArrowLeft className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
          </button>

          <div className="relative shrink-0">
            <img
              src={participant.avatar}
              alt={participant.name}
              className="w-10 h-10 rounded-full object-cover border border-slate-700"
            />
            {participant.isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full" />
            )}
          </div>

          <div className="min-w-0">
            <h2 className="text-xs font-bold text-slate-100 truncate flex items-center gap-1.5">
              <span>{participant.name}</span>
              {langInfo && <span className="text-[10px] opacity-90">{langInfo.flag}</span>}
            </h2>
            <p className="text-[10px] text-emerald-400 font-medium">
              {participant.isOnline ? t('online') : participant.lastSeen}
            </p>
          </div>
        </div>

        {/* Action Call Icons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onStartCall(participant, 'audio')}
            className="p-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 transition-all cursor-pointer"
            title={t('audioCall')}
          >
            <Phone className="w-4 h-4" />
          </button>

          <button
            onClick={() => onStartCall(participant, 'video')}
            className="p-2.5 rounded-xl bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 transition-all cursor-pointer"
            title={t('videoCall')}
          >
            <Video className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUserId;
          const isTranslated = translatedMessages[msg.id];

          return (
            <div
              key={msg.id}
              className={`group relative flex flex-col ${isMe ? 'items-end' : 'items-start'} transition-all`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[70%] p-3 rounded-2xl shadow-md text-xs relative ${
                  isMe
                    ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-br-none'
                    : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/80'
                }`}
              >
                {/* Reply Context Header if msg has replyTo */}
                {msg.replyTo && (
                  <div className="mb-2 p-2 rounded-xl bg-black/20 border-l-2 border-cyan-300 text-[11px] text-slate-200">
                    <span className="font-bold text-cyan-300 block text-[10px]">
                      {msg.replyTo.senderName || 'رد على:'}
                    </span>
                    <span className="truncate block opacity-90">{msg.replyTo.text}</span>
                  </div>
                )}

                {/* Media Image with Click-to-Expand Lightbox */}
                {msg.type === 'image' && msg.mediaUrl && (
                  <div className="relative group/img cursor-pointer overflow-hidden rounded-xl mb-2 border border-black/20">
                    <img
                      src={msg.mediaUrl}
                      alt="attachment"
                      onClick={() => setPreviewImageUrl(msg.mediaUrl || null)}
                      className="max-w-full max-h-60 rounded-xl object-cover hover:scale-105 transition-transform duration-200"
                    />
                    <button
                      onClick={() => setPreviewImageUrl(msg.mediaUrl || null)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                      title="تكبير الصورة"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* File Attachment */}
                {msg.type === 'file' && (
                  <a
                    href={msg.mediaUrl || '#'}
                    download={msg.fileName || 'file'}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-black/20 hover:bg-black/30 border border-white/10 text-white mb-1 transition-all"
                  >
                    <FileText className="w-5 h-5 text-cyan-300 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs truncate">{msg.fileName || 'ملف مرفق'}</p>
                      <span className="text-[10px] text-slate-300 opacity-80">تنزيل الملف</span>
                    </div>
                    <Download className="w-4 h-4 text-cyan-300 shrink-0" />
                  </a>
                )}

                {/* Voice Note Audio Player */}
                {msg.type === 'audio' && (
                  <div className="flex items-center gap-3 py-1 min-w-[200px]">
                    <button
                      onClick={() => togglePlayAudio(msg.id, msg.mediaUrl)}
                      className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer shrink-0"
                      title={playingAudioId === msg.id ? 'إيقاف' : 'تشغيل الصوت'}
                    >
                      {playingAudioId === msg.id ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 h-5 my-1">
                        {[40, 70, 30, 90, 50, 80, 40, 60, 30, 80, 50, 70, 40, 60].map((h, i) => (
                          <div
                            key={i}
                            style={{ height: `${h}%` }}
                            className={`w-1 rounded-full transition-all ${
                              playingAudioId === msg.id
                                ? 'bg-cyan-300 animate-pulse'
                                : 'bg-white/40'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] opacity-90 block font-medium">
                        {playingAudioId === msg.id ? 'جاري التشغيل...' : 'تسجيل صوتي'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Text Message */}
                {msg.type === 'text' && (
                  <p className="leading-relaxed font-sans whitespace-pre-wrap break-words">
                    {isTranslated && msg.translatedText ? msg.translatedText : msg.text}
                  </p>
                )}

                {/* AI Translation Toggle Button */}
                {msg.translatedText && !isMe && (
                  <button
                    onClick={() => toggleTranslation(msg.id)}
                    className="mt-1.5 pt-1 border-t border-white/10 text-[10px] text-cyan-300 hover:text-cyan-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>
                      {isTranslated
                        ? `${t('originalMessage')} (${msg.originalLang?.toUpperCase()})`
                        : `${t('translateMessage')} ➔ ${currentLang.toUpperCase()}`}
                    </span>
                  </button>
                )}

                {/* Footer Time & Status */}
                <div className="flex items-center justify-end gap-1 mt-1 text-[9px] opacity-75">
                  <span>{msg.timestamp}</span>
                  {isMe && <CheckCheck className="w-3 h-3 text-cyan-200" />}
                </div>

                {/* Message Hover Actions (Reply & Delete) */}
                <div
                  className={`absolute top-1 ${
                    isMe ? '-left-16' : '-right-16'
                  } hidden group-hover:flex items-center gap-1 bg-slate-900/90 border border-slate-700 rounded-xl p-1 shadow-lg z-20`}
                >
                  <button
                    onClick={() =>
                      setReplyingTo({
                        id: msg.id,
                        text: msg.type === 'text' ? msg.text : msg.type === 'image' ? '📷 صورة' : msg.type === 'audio' ? '🎤 تسجيل صوتي' : '📁 ملف',
                        senderName: isMe ? 'أنت' : participant.name
                      })
                    }
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-cyan-400 cursor-pointer"
                    title="رد"
                  >
                    <Reply className="w-3.5 h-3.5" />
                  </button>

                  {onDeleteMessage && (
                    <button
                      onClick={() => onDeleteMessage(msg.id)}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-red-400 cursor-pointer"
                      title="حذف الرسالة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Uploading Status Banner */}
      {isUploading && (
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 text-cyan-300 flex items-center gap-2 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
          <span>{uploadStatusText}</span>
        </div>
      )}

      {/* Reply Banner */}
      {replyingTo && (
        <div className="px-3 py-2 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0 border-l-2 border-cyan-400 pl-2">
            <Reply className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <span className="font-bold text-cyan-300 text-[11px] block">{replyingTo.senderName}</span>
              <p className="text-slate-300 truncate text-[11px]">{replyingTo.text}</p>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Recording Bar Indicator */}
      {isRecording && (
        <div className="px-4 py-2 bg-red-950/80 border-t border-red-800 text-red-200 flex items-center justify-between text-xs animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span>{t('recordingVoice')} ({recordingSeconds}s)</span>
          </div>
          <button
            onClick={stopRecording}
            className="px-3 py-1 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer"
          >
            {t('releaseToSend')}
          </button>
        </div>
      )}

      {/* Emoji Bar Picker */}
      {showEmojiPicker && (
        <div className="p-2 bg-slate-900 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto">
          {EMOJI_LIST.map((emoji) => (
            <button
              key={emoji}
              onClick={() => addEmoji(emoji)}
              className="p-1.5 text-base hover:bg-slate-800 rounded-xl transition-all cursor-pointer shrink-0"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Send Error Banner */}
      {sendError && (
        <div className="px-3.5 py-2 bg-red-950/90 border-t border-red-800 text-red-200 flex items-center justify-between text-xs animate-pulse">
          <span className="font-medium">{sendError}</span>
          <button
            type="button"
            onClick={() => setSendError(null)}
            className="p-1 rounded-lg text-red-300 hover:text-white hover:bg-red-900/50 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Message Input Controls */}
      <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-1.5">
        {/* Emoji Button */}
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          disabled={isUploading || isSending}
          className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-all disabled:opacity-50"
          title="إيموجي"
        >
          <Smile className="w-4 h-4 text-amber-400" />
        </button>

        {/* Photo Attachment */}
        <label
          className={`p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-all ${
            isUploading || isSending ? 'opacity-50 pointer-events-none' : ''
          }`}
          title="إرسال صورة"
        >
          <Image className="w-4 h-4 text-cyan-400" />
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading || isSending} />
        </label>

        {/* File Attachment */}
        <label
          className={`p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-all ${
            isUploading || isSending ? 'opacity-50 pointer-events-none' : ''
          }`}
          title="إرسال ملف"
        >
          <Paperclip className="w-4 h-4 text-teal-400" />
          <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading || isSending} />
        </label>

        {/* Text Input */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={t('typeMessage')}
          disabled={isUploading || isSending}
          className="flex-1 bg-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-400 border border-slate-700/80 focus:border-cyan-500 focus:outline-none transition-all disabled:opacity-50"
        />

        {/* Mic Voice Button */}
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isUploading || isSending}
          className={`p-2.5 rounded-2xl transition-all cursor-pointer disabled:opacity-50 ${
            isRecording
              ? 'bg-red-600 text-white animate-bounce'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
          title={t('holdToRecord')}
        >
          <Mic className="w-4 h-4 text-teal-400" />
        </button>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!inputText.trim() || isUploading || isSending}
          className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-600 to-teal-500 disabled:opacity-40 text-slate-950 font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0"
          title="إرسال"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
          ) : (
            <Send className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
          )}
        </button>
      </div>
    </div>
  );
};


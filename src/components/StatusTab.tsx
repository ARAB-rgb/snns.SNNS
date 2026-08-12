import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Clock, Eye, Sparkles, Send, X, ChevronLeft, ChevronRight, Image as ImageIcon, Camera, Loader2 } from 'lucide-react';
import { User, UserStatus } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { supabaseService } from '../services/supabaseService';

interface StatusTabProps {
  currentUser: User;
}

const BG_GRADIENTS = [
  { name: 'Cyan Blue', value: 'from-cyan-600 via-teal-700 to-slate-900' },
  { name: 'Purple Night', value: 'from-purple-600 via-indigo-700 to-slate-900' },
  { name: 'Sunset Glow', value: 'from-amber-600 via-rose-700 to-slate-900' },
  { name: 'Emerald Forest', value: 'from-emerald-600 via-teal-800 to-slate-900' },
  { name: 'Midnight', value: 'from-slate-800 via-zinc-900 to-black' }
];

export const StatusTab: React.FC<StatusTabProps> = ({ currentUser }) => {
  const { t } = useLanguage();
  const [statuses, setStatuses] = useState<UserStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [selectedBg, setSelectedBg] = useState(BG_GRADIENTS[0].value);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStatuses = async () => {
    setIsLoading(true);
    try {
      const active = await supabaseService.fetchActiveStatuses();
      setStatuses(active);
    } catch (e) {
      console.error('Failed to load statuses:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatuses();
    // Refresh status expiration every 30 seconds
    const interval = setInterval(() => {
      loadStatuses();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  const removePhoto = () => {
    setSelectedFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetForm = () => {
    setStatusText('');
    setSelectedBg(BG_GRADIENTS[0].value);
    removePhoto();
    setIsAddModalOpen(false);
  };

  const handleCreateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!statusText.trim() && !selectedFile) || isPublishing) return;

    setIsPublishing(true);
    try {
      let uploadedMediaUrl: string | undefined = undefined;
      if (selectedFile) {
        uploadedMediaUrl = await supabaseService.uploadStatusImage(selectedFile);
      }

      const created = await supabaseService.createStatus({
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        text: statusText.trim(),
        bgColor: selectedBg,
        mediaUrl: uploadedMediaUrl
      });

      setStatuses(prev => [created, ...prev.filter(s => s.id !== created.id)]);
      resetForm();
    } catch (err) {
      console.error('Failed to publish status:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteStatus = async (statusId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await supabaseService.deleteStatus(statusId);
      setStatuses(prev => prev.filter(s => s.id !== statusId));
      if (activeStoryIndex !== null) {
        if (statuses[activeStoryIndex]?.id === statusId) {
          setActiveStoryIndex(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete status:', err);
    }
  };

  // Filter currentUser status vs others
  const myStatuses = statuses.filter(s => s.userId === currentUser.id);
  const otherStatuses = statuses.filter(s => s.userId !== currentUser.id);

  const formatHoursLeft = (expiresAt: string) => {
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Expired';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
  };

  const currentActiveStory = activeStoryIndex !== null ? statuses[activeStoryIndex] : null;

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-950 p-4 text-slate-100 flex flex-col max-w-2xl mx-auto w-full">
      {/* Header title */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            {t('status')}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{t('expiresIn24Hours')}</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs rounded-full shadow-lg shadow-cyan-950/40 transition-all transform active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>{t('addStatus')}</span>
        </button>
      </div>

      {/* MY STATUS CARD */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3 mb-6 shadow-sm">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
          {t('myStatus')}
        </span>

        {myStatuses.length > 0 ? (
          <div className="mt-2 space-y-2">
            {myStatuses.map(st => (
              <div
                key={st.id}
                onClick={() => {
                  const idx = statuses.findIndex(s => s.id === st.id);
                  if (idx !== -1) setActiveStoryIndex(idx);
                }}
                className={`relative overflow-hidden rounded-xl p-3 bg-gradient-to-r ${st.bgColor || 'from-cyan-700 to-slate-900'} cursor-pointer group border border-slate-700/50 transition-all hover:scale-[1.01]`}
              >
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {st.mediaUrl ? (
                        <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-cyan-400 shadow-md">
                          <img
                            src={st.mediaUrl}
                            alt="Status Media"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <img
                          src={st.userAvatar || currentUser.avatar}
                          alt={st.userName}
                          className="w-10 h-10 rounded-full object-cover border-2 border-cyan-400 shadow-md"
                        />
                      )}
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        {st.mediaUrl && <ImageIcon className="w-3.5 h-3.5 text-cyan-300" />}
                        <p className="text-sm font-semibold text-white line-clamp-1">
                          {st.text || (st.mediaUrl ? 'Photo status' : '')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-cyan-200/80 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{formatHoursLeft(st.expiresAt)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteStatus(st.id, e)}
                    title={t('deleteStatus')}
                    className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-black/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            onClick={() => setIsAddModalOpen(true)}
            className="mt-2 flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-dashed border-slate-700 cursor-pointer transition-colors"
          >
            <div className="relative">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-10 h-10 rounded-full object-cover opacity-80"
              />
              <div className="absolute -bottom-1 -right-1 bg-cyan-500 text-slate-950 rounded-full p-0.5 border border-slate-950">
                <Plus className="w-3.5 h-3.5 font-bold" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">{t('addStatus')}</p>
              <p className="text-xs text-slate-400">{t('typeStatusPlaceholder')}</p>
            </div>
          </div>
        )}
      </div>

      {/* RECENT UPDATES FROM OTHERS */}
      <div className="flex-1">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1 block mb-3">
          {t('recentUpdates')}
        </span>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 bg-slate-900/60 animate-pulse rounded-xl border border-slate-800" />
            ))}
          </div>
        ) : otherStatuses.length === 0 ? (
          <div className="text-center py-10 px-4 bg-slate-900/40 rounded-2xl border border-slate-800/60">
            <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">{t('noStatusesYet')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {otherStatuses.map(st => (
              <div
                key={st.id}
                onClick={() => {
                  const idx = statuses.findIndex(s => s.id === st.id);
                  if (idx !== -1) setActiveStoryIndex(idx);
                }}
                className={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${st.bgColor || 'from-slate-900 to-slate-950'} border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition-all hover:scale-[1.01]`}
              >
                <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-cyan-400 to-purple-500">
                  <img
                    src={st.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt={st.userName}
                    className="w-11 h-11 rounded-full object-cover border-2 border-slate-950"
                  />
                  {st.mediaUrl && (
                    <div className="absolute -bottom-1 -right-1 bg-cyan-500 text-slate-950 p-1 rounded-full border border-slate-950" title="Photo status">
                      <ImageIcon className="w-2.5 h-2.5 font-bold" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-slate-100 truncate">{st.userName}</h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {st.mediaUrl && <ImageIcon className="w-3 h-3 text-cyan-400 shrink-0" />}
                    <p className="text-xs text-slate-300 truncate">{st.text || 'Photo status'}</p>
                  </div>
                  <span className="text-[10px] text-cyan-400/90 flex items-center gap-1 mt-1">
                    <Clock className="w-2.5 h-2.5" />
                    {formatHoursLeft(st.expiresAt)}
                  </span>
                </div>
                {st.mediaUrl && (
                  <img
                    src={st.mediaUrl}
                    alt="Thumbnail"
                    className="w-12 h-12 rounded-lg object-cover border border-slate-700/60"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE STATUS MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                {t('publishStatus')}
              </h3>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-full hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStatus} className="p-4 space-y-4">
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* STATUS PREVIEW CARD */}
              <div
                className={`w-full min-h-[170px] max-h-[220px] p-4 rounded-2xl bg-gradient-to-br ${selectedBg} flex flex-col justify-center items-center text-center shadow-inner border border-white/10 relative overflow-hidden`}
              >
                {imagePreview ? (
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                    <img
                      src={imagePreview}
                      alt="Status Attachment Preview"
                      className="max-h-[140px] w-auto rounded-xl object-contain border border-white/30 shadow-lg"
                    />
                    {statusText.trim() && (
                      <p className="text-xs font-semibold text-white drop-shadow-md mt-2 line-clamp-2 px-2 bg-black/40 py-1 rounded-lg backdrop-blur-xs">
                        {statusText.trim()}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-10 h-10 rounded-full border-2 border-white/50 mb-2 shadow"
                    />
                    <p className="text-base font-semibold text-white drop-shadow-md break-words max-w-xs">
                      {statusText.trim() || t('typeStatusPlaceholder')}
                    </p>
                  </>
                )}
              </div>

              {/* ATTACH PHOTO BUTTON / PREVIEW BADGE */}
              <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
                  >
                    <Camera className="w-4 h-4 text-cyan-400" />
                    <span>{selectedFile ? 'Change Photo' : 'Attach Photo'}</span>
                  </button>
                  <span className="text-[11px] text-slate-500 hidden sm:inline">Supabase Storage</span>
                </div>

                {imagePreview && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-cyan-400 font-medium truncate max-w-[120px]">
                      {selectedFile?.name}
                    </span>
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Remove Photo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* INPUT FIELD */}
              <div>
                <textarea
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  placeholder={t('typeStatusPlaceholder')}
                  maxLength={200}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 resize-none"
                />
                <div className="flex justify-end text-[10px] text-slate-500 mt-1">
                  {statusText.length}/200
                </div>
              </div>

              {/* BG COLOR PICKER */}
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-2">Background Theme</label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {BG_GRADIENTS.map((bg, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setSelectedBg(bg.value)}
                      className={`h-8 w-8 rounded-full bg-gradient-to-br ${bg.value} border-2 transition-all ${
                        selectedBg === bg.value ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={(!statusText.trim() && !selectedFile) || isPublishing}
                  className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-full shadow-lg shadow-cyan-950/40 transition-all"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{t('publishStatus')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULLSCREEN STORY VIEWER MODAL */}
      {currentActiveStory && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-4 backdrop-blur-lg">
          {/* Top Bar with progress indicator */}
          <div className="w-full max-w-md space-y-3 pt-2">
            <div className="w-full bg-slate-800/80 h-1 rounded-full overflow-hidden">
              <div className="bg-cyan-400 h-full w-full animate-pulse" />
            </div>

            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <img
                  src={currentActiveStory.userAvatar || currentUser.avatar}
                  alt={currentActiveStory.userName}
                  className="w-9 h-9 rounded-full object-cover border border-cyan-400"
                />
                <div>
                  <p className="text-sm font-bold text-slate-100">{currentActiveStory.userName}</p>
                  <p className="text-[10px] text-slate-400">{formatHoursLeft(currentActiveStory.expiresAt)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {currentActiveStory.userId === currentUser.id && (
                  <button
                    onClick={() => handleDeleteStatus(currentActiveStory.id)}
                    className="p-2 text-slate-400 hover:text-red-400 rounded-full hover:bg-slate-800/60"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setActiveStoryIndex(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800/60"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Story Content Canvas */}
          <div
            className={`w-full max-w-md my-auto aspect-[9/14] rounded-3xl bg-gradient-to-br ${
              currentActiveStory.bgColor || 'from-cyan-600 to-slate-900'
            } flex flex-col items-center justify-center p-6 text-center shadow-2xl border border-white/10 relative overflow-hidden`}
          >
            {currentActiveStory.mediaUrl ? (
              <div className="w-full h-full flex flex-col items-center justify-between relative z-10 py-2">
                <div className="flex-1 w-full flex items-center justify-center overflow-hidden my-auto">
                  <img
                    src={currentActiveStory.mediaUrl}
                    alt="Status Attachment"
                    className="max-h-full max-w-full object-contain rounded-2xl border border-white/20 shadow-2xl"
                  />
                </div>
                {currentActiveStory.text && (
                  <div className="w-full mt-3 p-3 bg-black/60 backdrop-blur-md rounded-xl border border-white/15">
                    <p className="text-sm md:text-base font-semibold text-white drop-shadow">
                      {currentActiveStory.text}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xl md:text-2xl font-bold text-white leading-relaxed drop-shadow-lg">
                {currentActiveStory.text}
              </p>
            )}

            {/* Tap navigation zones */}
            <button
              onClick={() => {
                if (activeStoryIndex > 0) setActiveStoryIndex(activeStoryIndex - 1);
              }}
              className="absolute left-0 top-0 bottom-0 w-1/3 flex items-center justify-start pl-2 opacity-0 hover:opacity-100 transition-opacity z-20"
            >
              <ChevronLeft className="w-8 h-8 text-white/70" />
            </button>
            <button
              onClick={() => {
                if (activeStoryIndex < statuses.length - 1) setActiveStoryIndex(activeStoryIndex + 1);
                else setActiveStoryIndex(null);
              }}
              className="absolute right-0 top-0 bottom-0 w-1/3 flex items-center justify-end pr-2 opacity-0 hover:opacity-100 transition-opacity z-20"
            >
              <ChevronRight className="w-8 h-8 text-white/70" />
            </button>
          </div>

          {/* Bottom Views Indicator */}
          <div className="text-slate-400 text-xs flex items-center gap-1.5 pb-2">
            <Eye className="w-4 h-4 text-cyan-400" />
            <span>{currentActiveStory.viewsCount || 1} views</span>
          </div>
        </div>
      )}
    </div>
  );
};

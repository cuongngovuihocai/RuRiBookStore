import {
  ChevronUp,
  Clock,
  ListMusic,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import type {AudioStory, ListenerStoryState} from '../types';
import {formatDuration} from '../utils/format';

interface AudioPlayerBarProps {
  story: AudioStory | null;
  listenerState: ListenerStoryState | null;
  chapterIndex: number;
  isPlaying: boolean;
  onPlayingChange: (playing: boolean) => void;
  onChangeChapter: (index: number) => void;
  onSaveProgress: (storyId: string, chapterIndex: number, positionSec: number) => void;
  onOpenStoryDetail: (story: AudioStory) => void;
  onClosePlayer: () => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export function AudioPlayerBar({
  story,
  listenerState,
  chapterIndex,
  isPlaying,
  onPlayingChange,
  onChangeChapter,
  onSaveProgress,
  onOpenStoryDetail,
  onClosePlayer,
}: AudioPlayerBarProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    const saved = localStorage.getItem('ts_playback_rate');
    return saved ? parseFloat(saved) || 1 : 1;
  });
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('ts_volume');
    return saved ? parseFloat(saved) : 0.9;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const [showChapters, setShowChapters] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [sleepTimerMode, setSleepTimerMode] = useState<'off' | 'end_chapter' | number>('off');
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number | null>(null);

  const lastSavedRef = useRef<number>(0);
  const resumeAppliedRef = useRef<string>('');

  const chapter = story?.chapters[chapterIndex] || story?.chapters[0];
  const activeSrc = chapter?.audioUrl || '';

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = playbackRate;
    localStorage.setItem('ts_playback_rate', String(playbackRate));
  }, [playbackRate]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = isMuted ? 0 : volume;
    localStorage.setItem('ts_volume', String(volume));
  }, [volume, isMuted]);

  useEffect(() => {
    setAudioError(null);
    setCurrentTime(0);
    setDuration(chapter?.durationSec || 0);
  }, [story?.id, chapter?.id]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !activeSrc) return;

    if (isPlaying) {
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          onPlayingChange(false);
        });
      }
    } else {
      el.pause();
    }
  }, [isPlaying, activeSrc]);

  useEffect(() => {
    if (typeof sleepTimerMode !== 'number') {
      setSleepRemainingSec(null);
      return;
    }
    setSleepRemainingSec(sleepTimerMode * 60);
    const interval = window.setInterval(() => {
      setSleepRemainingSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          onPlayingChange(false);
          setSleepTimerMode('off');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [sleepTimerMode]);

  if (!story || !chapter) return null;

  const handleLoadedMetadata = () => {
    const el = audioRef.current;
    if (!el) return;
    setIsBuffering(false);

    const actualDur = Number.isFinite(el.duration) ? Math.round(el.duration) : 0;
    if (actualDur > 0) {
      setDuration(actualDur);
    }

    const key = `${story.id}:${chapterIndex}`;
    if (
      resumeAppliedRef.current !== key &&
      listenerState &&
      listenerState.lastChapterIndex === chapterIndex &&
      listenerState.lastPositionSec > 2 &&
      listenerState.lastPositionSec < actualDur - 2
    ) {
      el.currentTime = listenerState.lastPositionSec;
      setCurrentTime(listenerState.lastPositionSec);
    }
    resumeAppliedRef.current = key;
    el.playbackRate = playbackRate;
  };

  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el) return;
    const sec = el.currentTime;
    setCurrentTime(sec);

    if (Math.abs(sec - lastSavedRef.current) >= 5) {
      lastSavedRef.current = sec;
      onSaveProgress(story.id, chapterIndex, Math.floor(sec));
    }
  };

  const handleEnded = () => {
    if (sleepTimerMode === 'end_chapter') {
      setSleepTimerMode('off');
      onPlayingChange(false);
      return;
    }
    if (chapterIndex < story.chapters.length - 1) {
      onChangeChapter(chapterIndex + 1);
      onSaveProgress(story.id, chapterIndex + 1, 0);
    } else {
      onPlayingChange(false);
      onSaveProgress(story.id, chapterIndex, 0);
    }
  };

  const handleAudioError = () => {
    setIsBuffering(false);
    setAudioError('Không thể phát nguồn audio này. Kiểm tra lại đường dẫn hoặc quyền truy cập file.');
    onPlayingChange(false);
  };

  const seekTo = (sec: number) => {
    const el = audioRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(duration || el.duration || 0, sec));
    el.currentTime = clamped;
    setCurrentTime(clamped);
    onSaveProgress(story.id, chapterIndex, Math.floor(clamped));
  };

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(playbackRate);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setPlaybackRate(next);
  };

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#DEC999] bg-[#FBF3DC]/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(65,45,10,0.08)] dark:border-[#302B4F] dark:bg-[#19162D]/95">
      <audio
        ref={audioRef}
        src={activeSrc}
        preload="metadata"
        onLoadStart={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleAudioError}
      />

      {showChapters && (
        <div className="absolute right-4 bottom-full mb-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[#DFCCA0] bg-[#FDF8EB] shadow-xl dark:border-[#302B4F] dark:bg-[#1E1B33]">
          <div className="flex items-center justify-between border-b border-[#ECDCB4] px-4 py-2.5 dark:border-[#2C2748]">
            <span className="text-xs font-semibold text-[#2B2111] dark:text-[#F1ECF8]">
              Danh sách chương ({story.chapters.length})
            </span>
            <button
              type="button"
              onClick={() => setShowChapters(false)}
              className="rounded p-1 text-[#6D5937] hover:bg-[#EFE0BA] dark:text-[#ACA4CA] dark:hover:bg-[#292447]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-60 divide-y divide-[#ECDCB4] overflow-y-auto dark:divide-[#2C2748]">
            {story.chapters.map((ch, idx) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  onChangeChapter(idx);
                  onPlayingChange(true);
                  setShowChapters(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs transition-colors ${
                  idx === chapterIndex
                    ? 'bg-[#7A4B0C]/10 font-semibold text-[#663E07] dark:bg-[#6A58C8]/25 dark:text-[#E5DEF9]'
                    : 'text-[#4B3B21] hover:bg-[#F5E8C7] dark:text-[#CFC8E6] dark:hover:bg-[#262140]'
                }`}
              >
                <span className="truncate">{ch.title}</span>
                {ch.durationSec > 0 && (
                  <span className="font-mono-tabular shrink-0 text-[#87714D] dark:text-[#9E94C0]">
                    {formatDuration(ch.durationSec)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {showTimerMenu && (
        <div className="absolute right-16 bottom-full mb-2 w-52 overflow-hidden rounded-xl border border-[#DFCCA0] bg-[#FDF8EB] p-1.5 shadow-xl dark:border-[#302B4F] dark:bg-[#1E1B33]">
          <p className="px-2.5 py-1.5 text-[11px] font-semibold text-[#6D5937] dark:text-[#ACA4CA]">
            Hẹn giờ tắt tự động
          </p>
          {(
            [
              {value: 'off', label: 'Tắt hẹn giờ'},
              {value: 15, label: 'Sau 15 phút'},
              {value: 30, label: 'Sau 30 phút'},
              {value: 45, label: 'Sau 45 phút'},
              {value: 60, label: 'Sau 60 phút'},
              {value: 'end_chapter', label: 'Khi hết chương này'},
            ] as const
          ).map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => {
                setSleepTimerMode(opt.value);
                setShowTimerMenu(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs ${
                sleepTimerMode === opt.value
                  ? 'bg-[#7A4B0C] text-white dark:bg-[#6A58C8]'
                  : 'text-[#4B3B21] hover:bg-[#F3E5BF] dark:text-[#CFC8E6] dark:hover:bg-[#292447]'
              }`}
            >
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}

      {audioError && (
        <div className="border-b border-rose-300 bg-rose-50 px-4 py-1 text-center text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/50 dark:text-rose-200">
          {audioError}
        </div>
      )}

      <div className="h-1 w-full bg-[#E5D3A3] sm:hidden dark:bg-[#2B2647]">
        <div
          className="h-full bg-[#7A4B0C] dark:bg-[#8E7DF0]"
          style={{width: `${progressPct}%`}}
        />
      </div>

      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-3 py-2.5 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-[280px]">
          <button
            type="button"
            onClick={() => onOpenStoryDetail(story)}
            className="h-11 w-9 shrink-0 overflow-hidden rounded-md border border-[#DFCCA0] bg-[#EADAB2] dark:border-[#37315A] dark:bg-[#262240]"
          >
            <img
              src={story.coverUrl}
              alt={story.title}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          </button>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onOpenStoryDetail(story)}
              className="block w-full truncate text-left text-xs font-semibold text-[#2B2111] hover:text-[#7A4B0C] sm:text-sm dark:text-[#F1ECF8] dark:hover:text-[#D5B263]"
            >
              {story.title}
            </button>
            <p className="truncate text-[11px] text-[#6D5937] dark:text-[#ACA4CA]">
              {chapter.title}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 sm:flex-1 sm:max-w-xl">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              type="button"
              disabled={chapterIndex === 0}
              onClick={() => {
                onChangeChapter(chapterIndex - 1);
                onPlayingChange(true);
              }}
              className="hidden h-8 w-8 items-center justify-center rounded-full text-[#5C492B] hover:bg-[#EFE0BA] disabled:opacity-30 sm:inline-flex dark:text-[#CFC8E6] dark:hover:bg-[#292447]"
              aria-label="Chương trước"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => seekTo(currentTime - 15)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#5C492B] hover:bg-[#EFE0BA] dark:text-[#CFC8E6] dark:hover:bg-[#292447]"
              title="Lùi 15 giây"
              aria-label="Lùi 15 giây"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isPlaying && audioRef.current) {
                  onPlayingChange(true);
                } else {
                  onPlayingChange(false);
                  onSaveProgress(story.id, chapterIndex, Math.floor(currentTime));
                }
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#7A4B0C] text-white shadow-sm transition-transform hover:scale-105 hover:bg-[#5E3807] dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
              aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
            >
              {isBuffering && isPlaying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 translate-x-0.5 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={() => seekTo(currentTime + 15)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#5C492B] hover:bg-[#EFE0BA] dark:text-[#CFC8E6] dark:hover:bg-[#292447]"
              title="Tua tới 15 giây"
              aria-label="Tua tới 15 giây"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            <button
              type="button"
              disabled={chapterIndex >= story.chapters.length - 1}
              onClick={() => {
                onChangeChapter(chapterIndex + 1);
                onPlayingChange(true);
              }}
              className="hidden h-8 w-8 items-center justify-center rounded-full text-[#5C492B] hover:bg-[#EFE0BA] disabled:opacity-30 sm:inline-flex dark:text-[#CFC8E6] dark:hover:bg-[#292447]"
              aria-label="Chương tiếp theo"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

          <div className="hidden w-full items-center gap-2.5 sm:flex">
            <span className="font-mono-tabular w-11 text-right text-[11px] text-[#6D5937] dark:text-[#ACA4CA]">
              {formatDuration(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={Math.min(currentTime, duration || 100)}
              onChange={(e) => seekTo(Number(e.target.value))}
              aria-label="Vị trí phát audio"
              className="audio-range h-1 flex-1 rounded-full bg-[#E3D0A0] text-[#7A4B0C] dark:bg-[#2D274D] dark:text-[#8E7DF0]"
              style={{
                background: `linear-gradient(to right, currentColor ${progressPct}%, rgba(168,144,96,0.3) ${progressPct}%)`,
              }}
            />
            <span className="font-mono-tabular w-11 text-[11px] text-[#6D5937] dark:text-[#ACA4CA]">
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={cycleSpeed}
            className="font-mono-tabular inline-flex h-8 items-center rounded-md border border-[#DEC999] px-2 text-xs font-medium text-[#4B3B21] hover:bg-[#EFE0BA] dark:border-[#37315A] dark:text-[#E5DEF9] dark:hover:bg-[#292447]"
            title="Tốc độ đọc"
          >
            {playbackRate}x
          </button>

          <button
            type="button"
            onClick={() => {
              setShowTimerMenu((v) => !v);
              setShowChapters(false);
            }}
            className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors ${
              sleepTimerMode !== 'off'
                ? 'bg-[#7A4B0C]/15 text-[#663E07] dark:bg-[#6A58C8]/25 dark:text-[#E5DEF9]'
                : 'text-[#5C492B] hover:bg-[#EFE0BA] dark:text-[#CFC8E6] dark:hover:bg-[#292447]'
            }`}
            title="Hẹn giờ tắt"
            aria-label="Hẹn giờ tắt"
          >
            <Clock className="h-4 w-4" />
            {sleepRemainingSec !== null && (
              <span className="font-mono-tabular hidden md:inline">
                {formatDuration(sleepRemainingSec)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowChapters((v) => !v);
              setShowTimerMenu(false);
            }}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-[#5C492B] hover:bg-[#EFE0BA] dark:text-[#CFC8E6] dark:hover:bg-[#292447]"
            title="Danh sách chương"
            aria-label="Danh sách chương"
          >
            <ListMusic className="h-4 w-4" />
            <ChevronUp className="hidden h-3 w-3 sm:inline" />
          </button>

          <div className="hidden items-center gap-1.5 lg:flex">
            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#5C492B] hover:bg-[#EFE0BA] dark:text-[#CFC8E6] dark:hover:bg-[#292447]"
              aria-label={isMuted ? 'Bật âm' : 'Tắt âm'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setIsMuted(false);
                setVolume(Number(e.target.value));
              }}
              aria-label="Âm lượng"
              className="audio-range w-16 text-[#6D5937] dark:text-[#CFC8E6]"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              onSaveProgress(story.id, chapterIndex, Math.floor(currentTime));
              onClosePlayer();
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#856F4B] hover:bg-[#EFE0BA] hover:text-[#2B2111] dark:text-[#9E94C0] dark:hover:bg-[#292447] dark:hover:text-[#F1ECF8]"
            aria-label="Đóng trình phát"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

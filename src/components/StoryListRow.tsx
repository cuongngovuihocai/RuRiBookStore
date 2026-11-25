import {BookOpen, Check, Heart, Lock, LockOpen, Pause, Play, Share2} from 'lucide-react';
import {useEffect, useState} from 'react';
import type {AudioStory, ListenerStoryState} from '../types';
import {buildStoryShareUrl, copyTextToClipboard, formatDuration} from '../utils/format';
import {CoverImage} from './CoverImage';

interface StoryListRowProps {
  story: AudioStory;
  listenerState: ListenerStoryState;
  isAdminView: boolean;
  isUnlocked?: boolean;
  isCurrentStory: boolean;
  isPlaying: boolean;
  onPlayStory: (story: AudioStory) => void;
  onOpenDetail: (story: AudioStory) => void;
  onToggleFavorite: (story: AudioStory) => void;
  onSelectKeyword: (keyword: string) => void;
}

export function StoryListRow({
  story,
  listenerState,
  isAdminView,
  isUnlocked = false,
  isCurrentStory,
  isPlaying,
  onPlayStory,
  onOpenDetail,
  onToggleFavorite,
  onSelectKeyword,
}: StoryListRowProps) {
  const [imgError, setImgError] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [story.coverUrl]);

  const handleShare = async () => {
    const ok = await copyTextToClipboard(buildStoryShareUrl(story.id));
    if (ok) {
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const requiresUnlock = Boolean(story.isLocked && !isUnlocked);
  const displayChapterCount =
    story.isLocked && !isUnlocked
      ? story.lockedChapterCount || story.chapters.length
      : story.chapters.length;
  const totalDuration = requiresUnlock
    ? 0
    : story.chapters.reduce((acc, ch) => acc + (ch.durationSec || 0), 0);

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
        isCurrentStory
          ? 'border-[#9B6D23]/60 bg-[#FAF0D4] dark:border-[#7E6CE0]/60 dark:bg-[#262144]'
          : 'border-[#DFCCA0] bg-[#FDF8EB] hover:border-[#C5AB72] dark:border-[#302B4F] dark:bg-[#1E1B33] dark:hover:border-[#4A4278]'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-[#EADAB2] dark:bg-[#262240]">
          {!imgError && story.coverUrl ? (
            <CoverImage
              src={story.coverUrl}
              alt={`Bìa ${story.title}`}
              targetWidth={160}
              onError={() => setImgError(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#735E3B] dark:text-[#9E94C0]">
              <BookOpen className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6D5937] dark:text-[#ACA4CA]">
            <span className="font-medium text-[#7A4B0C] dark:text-[#D5B263]">{story.category}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{displayChapterCount} chương</span>
            {totalDuration > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{formatDuration(totalDuration)}</span>
              </>
            )}
            {isAdminView && !story.isPublished && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-amber-800 dark:text-amber-300">Nháp</span>
              </>
            )}
            {isCurrentStory && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-[#7A4B0C] dark:text-[#B9ACFA]">
                  {isPlaying ? 'Đang phát' : 'Đang tạm dừng'}
                </span>
              </>
            )}
          </div>

          <h3 className="mt-0.5 truncate">
            <button
              type="button"
              onClick={() => onOpenDetail(story)}
              className="font-display text-base font-semibold text-[#2B2111] hover:text-[#7A4B0C] dark:text-[#F1ECF8] dark:hover:text-[#D5B263]"
            >
              {story.title}
            </button>
          </h3>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6D5937] dark:text-[#ACA4CA]">
            <span>
              {story.author}
              {story.narrator ? ` · ${story.narrator}` : ''}
            </span>
            {story.keywords.slice(0, 3).map((kw) => (
              <button
                key={kw}
                type="button"
                onClick={() => onSelectKeyword(kw)}
                className="text-[#735E3B] hover:text-[#7A4B0C] hover:underline dark:text-[#9E94C0] dark:hover:text-[#D5B263]"
              >
                #{kw}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 shrink-0">
        {story.isLocked && (
          <button
            type="button"
            onClick={() => onOpenDetail(story)}
            aria-label={requiresUnlock ? 'Truyện có mật khẩu' : 'Truyện đã mở khoá'}
            title={requiresUnlock ? 'Truyện có mật khẩu' : 'Đã mở khoá'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#DEC999] text-[#5C492B] hover:bg-[#F3E5BF] dark:border-[#37315A] dark:text-[#D6CFF0] dark:hover:bg-[#292447]"
          >
            {requiresUnlock ? (
              <Lock className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            ) : (
              <LockOpen className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={handleShare}
          aria-label="Chia sẻ link truyện"
          title={copiedLink ? 'Đã sao chép link!' : 'Chia sẻ / Sao chép link truyện'}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#DEC999] text-[#5C492B] hover:bg-[#F3E5BF] dark:border-[#37315A] dark:text-[#D6CFF0] dark:hover:bg-[#292447]"
        >
          {copiedLink ? (
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onToggleFavorite(story)}
          aria-label={listenerState.isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#DEC999] text-[#5C492B] hover:bg-[#F3E5BF] dark:border-[#37315A] dark:text-[#D6CFF0] dark:hover:bg-[#292447]"
        >
          <Heart
            className={`h-4 w-4 ${listenerState.isFavorite ? 'fill-rose-500 text-rose-500' : ''}`}
          />
        </button>

        <button
          type="button"
          onClick={() => onOpenDetail(story)}
          className="inline-flex min-h-[40px] items-center rounded-lg border border-[#DEC999] px-3 py-2 text-xs font-medium text-[#4B3B21] hover:bg-[#F3E5BF] whitespace-nowrap dark:border-[#37315A] dark:text-[#E5DEF9] dark:hover:bg-[#292447]"
        >
          {isAdminView ? 'Quản lý' : 'Chương'}
        </button>

        <button
          type="button"
          onClick={() => onPlayStory(story)}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#7A4B0C] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#5E3807] whitespace-nowrap dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
        >
          {requiresUnlock ? (
            <>
              <Lock className="h-3.5 w-3.5" />
              <span>Mở khoá</span>
            </>
          ) : isCurrentStory && isPlaying ? (
            <>
              <Pause className="h-3.5 w-3.5 fill-current" />
              <span>Tạm dừng</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Nghe</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

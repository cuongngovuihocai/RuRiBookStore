import {BookOpen, Check, Heart, Pause, Play, Share2} from 'lucide-react';
import {useEffect, useState} from 'react';
import type {AudioStory, ListenerStoryState} from '../types';
import {buildStoryShareUrl, copyTextToClipboard, formatDuration} from '../utils/format';
import {CoverImage} from './CoverImage';

interface StoryCardProps {
  story: AudioStory;
  listenerState: ListenerStoryState;
  isAdminView: boolean;
  isCurrentStory: boolean;
  isPlaying: boolean;
  onPlayStory: (story: AudioStory) => void;
  onOpenDetail: (story: AudioStory) => void;
  onToggleFavorite: (story: AudioStory) => void;
  onSelectKeyword: (keyword: string) => void;
}

export function StoryCard({
  story,
  listenerState,
  isAdminView,
  isCurrentStory,
  isPlaying,
  onPlayStory,
  onOpenDetail,
  onToggleFavorite,
  onSelectKeyword,
}: StoryCardProps) {
  const [imgError, setImgError] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [story.coverUrl]);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyTextToClipboard(buildStoryShareUrl(story.id));
    if (ok) {
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const totalDuration = story.chapters.reduce((acc, ch) => acc + (ch.durationSec || 0), 0);
  const currentChapter = story.chapters[listenerState.lastChapterIndex] || story.chapters[0];
  const chapterDuration = currentChapter?.durationSec || 0;
  const progressRatio =
    chapterDuration > 0 && listenerState.lastPositionSec > 0
      ? Math.min(1, listenerState.lastPositionSec / chapterDuration)
      : 0;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-[#DFCCA0] bg-[#FDF8EB] transition-colors duration-150 hover:border-[#C5AB72] dark:border-[#302B4F] dark:bg-[#1E1B33] dark:hover:border-[#4A4278]">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#EADAB2] dark:bg-[#262240]">
        {!imgError && story.coverUrl ? (
          <CoverImage
            src={story.coverUrl}
            alt={`Bìa truyện ${story.title}`}
            targetWidth={540}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-[#EFE0BA] via-[#F6EBCD] to-[#E2CB96] p-5 dark:from-[#262240] dark:via-[#1E1B33] dark:to-[#2D274C]">
            <BookOpen className="h-6 w-6 text-[#6D5937] dark:text-[#A99FCA]" />
            <div>
              <p className="font-display text-lg font-semibold leading-snug text-[#2B2111] line-clamp-3 dark:text-[#F1ECF8]">
                {story.title}
              </p>
              <p className="mt-1 text-xs text-[#6D5937] dark:text-[#ACA4CA]">{story.author}</p>
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent opacity-80 transition-opacity group-hover:opacity-100" />

        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Sao chép link chia sẻ truyện"
            title={copiedLink ? 'Đã sao chép link!' : 'Chia sẻ / Sao chép link truyện'}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-full bg-black/45 px-2.5 text-xs font-medium text-white backdrop-blur-xs transition-colors hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                <span className="text-[11px] text-emerald-200">Đã chép</span>
              </>
            ) : (
              <Share2 className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onToggleFavorite(story)}
            aria-label={listenerState.isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-xs transition-colors hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white"
          >
            <Heart
              className={`h-4 w-4 ${
                listenerState.isFavorite ? 'fill-rose-400 text-rose-400' : 'text-white'
              }`}
            />
          </button>
        </div>

        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onPlayStory(story)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#FFFDF6] px-3.5 py-2 text-xs font-semibold text-[#2B2111] shadow-sm transition-colors hover:bg-[#F5E8C7] focus-visible:outline-2 focus-visible:outline-white whitespace-nowrap dark:bg-[#F1ECF8] dark:text-[#141224] dark:hover:bg-white"
          >
            {isCurrentStory && isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5 fill-current" />
                <span>Tạm dừng</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{progressRatio > 0.03 ? 'Nghe tiếp' : 'Nghe ngay'}</span>
              </>
            )}
          </button>

          {isCurrentStory && (
            <span className="text-xs font-medium text-white/95 whitespace-nowrap">
              {isPlaying ? 'Đang phát' : 'Đang chọn'}
            </span>
          )}
        </div>

        {progressRatio > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
            <div
              className="h-full bg-[#C69C43] dark:bg-[#8E7DF0]"
              style={{width: `${Math.round(progressRatio * 100)}%`}}
            />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-[#6D5937] dark:text-[#ACA4CA]">
            <span className="truncate font-medium text-[#7A4B0C] dark:text-[#D5B263]">
              {story.category}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular whitespace-nowrap">
              {story.chapters.length} chương
            </span>
            {totalDuration > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular whitespace-nowrap">
                  {formatDuration(totalDuration)}
                </span>
              </>
            )}
            {isAdminView && !story.isPublished && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-amber-800 dark:text-amber-300">Nháp</span>
              </>
            )}
          </div>

          <h3 className="mt-1.5">
            <button
              type="button"
              onClick={() => onOpenDetail(story)}
              className="text-left font-display text-base font-semibold leading-snug text-[#2B2111] transition-colors hover:text-[#7A4B0C] line-clamp-2 dark:text-[#F1ECF8] dark:hover:text-[#D5B263]"
            >
              {story.title}
            </button>
          </h3>

          <p className="mt-1 truncate text-xs text-[#6D5937] dark:text-[#ACA4CA]">
            {story.author}
            {story.narrator ? ` · ${story.narrator}` : ''}
          </p>
        </div>

        {story.keywords.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-[#ECDCB4] pt-2.5 text-xs text-[#735E3B] dark:border-[#2C2748] dark:text-[#9E94C0]">
            {story.keywords.slice(0, 4).map((kw) => (
              <button
                key={kw}
                type="button"
                onClick={() => onSelectKeyword(kw)}
                className="hover:text-[#7A4B0C] hover:underline dark:hover:text-[#D5B263]"
              >
                #{kw}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

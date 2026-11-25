export type AudioSourceType = 'url' | 'sample';

export interface AudioChapter {
  id: string;
  title: string;
  sourceType: AudioSourceType;
  /** Direct playable audio URL (Cloudflare R2, Archive.org, Dropbox raw, MP3, or /samples/...) */
  audioUrl: string;
  /** Original link entered by admin */
  originalUrl?: string;
  /** File size in bytes if known */
  sizeBytes?: number;
  /** Duration in seconds */
  durationSec: number;
  /** MIME type e.g. audio/mpeg */
  mimeType?: string;
}

export interface AudioStory {
  id: string;
  title: string;
  author: string;
  narrator: string;
  category: string;
  keywords: string[];
  description: string;
  coverUrl: string;
  chapters: AudioChapter[];
  isPublished: boolean;
  isLocked?: boolean;
  accessSalt?: string;
  lockedPayload?: string;
  lockedChapterCount?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoryAdminVault {
  description: string;
  chapters: AudioChapter[];
  lockPassword: string;
}

export interface CategoryDoc {
  id: string;
  name: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: string;
}

/** Stored locally in each listener's browser so listeners never overwrite each other */
export interface ListenerStoryState {
  isFavorite: boolean;
  lastChapterIndex: number;
  lastPositionSec: number;
  lastPlayedAt?: string;
}

export interface LibraryStats {
  totalStories: number;
  totalChapters: number;
  totalDurationSec: number;
}

export type NavSection = 'all' | 'in_progress' | 'favorites' | 'drafts' | 'backup';
export type SortOption = 'newest' | 'recent_played' | 'title_asc' | 'duration_desc';
export type ViewMode = 'grid' | 'list';
export type AppRouteMode = 'listener' | 'admin';

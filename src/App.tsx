import {onAuthStateChanged, type User} from 'firebase/auth';
import {
  ArrowUpDown,
  BookOpen,
  Image as ImageIcon,
  LayoutGrid,
  List,
  LogOut,
  Menu,
  Mic,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {AddStoryModal} from './components/AddStoryModal';
import {AdminLoginGate} from './components/AdminLoginGate';
import {AudioPlayerBar} from './components/AudioPlayerBar';
import {BackupModal} from './components/BackupModal';
import {BrandingModal} from './components/BrandingModal';
import {Header} from './components/Header';
import {OfflineIndicator} from './components/OfflineIndicator';
import {PWAInstallButton} from './components/PWAInstallButton';
import {RuRiTTSModal} from './components/RuRiTTSModal';
import {Sidebar} from './components/Sidebar';
import {StoryCard} from './components/StoryCard';
import {StoryDetailModal} from './components/StoryDetailModal';
import {StoryListRow} from './components/StoryListRow';
import {
  auth,
  createCategoryDoc,
  deleteCategoryDoc,
  deleteStoryDoc,
  loadStoryAdminVault,
  seedStarterLibrary,
  signOutAdmin,
  subscribeCategories,
  subscribeStories,
  updateStoryDoc,
  verifyIsAdminUser,
} from './firebase';
import type {
  AppRouteMode,
  AudioStory,
  CategoryDoc,
  LibraryStats,
  ListenerStoryState,
  NavSection,
  SortOption,
  ViewMode,
} from './types';
import {
  buildStoryShareUrl,
  extractStoryIdFromLocation,
  removeVietnameseTones,
} from './utils/format';
import {parseRuRiTTSMessage, type RuRiTTSImportedDraft} from './utils/ruriTtsBridge';
import type {LockedStorySecret} from './utils/storyLock';

const DEFAULT_PAGE_TITLE = 'Tủ sách Rủ Rỉ Rù Rì — Lưu Trữ & Nghe Truyện Audio Trực Tuyến';
const LISTENER_STATE_KEY = 'ts_listener_state_v1';
const DEFAULT_LISTENER_STATE: ListenerStoryState = {
  isFavorite: false,
  lastChapterIndex: 0,
  lastPositionSec: 0,
};

function detectRouteMode(): AppRouteMode {
  if (
    window.location.pathname === '/admin' ||
    window.location.pathname.startsWith('/admin/') ||
    window.location.hash === '#/admin' ||
    window.location.hash.startsWith('#/admin/')
  ) {
    return 'admin';
  }
  return 'listener';
}

function loadListenerStateMap(): Record<string, ListenerStoryState> {
  try {
    const raw = localStorage.getItem(LISTENER_STATE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ListenerStoryState>;
  } catch {
    return {};
  }
}

export default function App() {
  const [routeMode, setRouteMode] = useState<AppRouteMode>(detectRouteMode);

  // Firebase Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);

  // Firestore Library State
  const [stories, setStories] = useState<AudioStory[]>([]);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Per-Listener Private State (Favorites & Playback Progress in localStorage)
  const [listenerMap, setListenerMap] =
    useState<Record<string, ListenerStoryState>>(loadListenerStateMap);

  // Navigation & Filtering
  const [activeSection, setActiveSection] = useState<NavSection>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Theme
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('ts_theme') === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('ts_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('ts_theme', 'light');
    }
  }, [isDarkMode]);

  const syncStoryUrl = useCallback(
    (storyId: string | null, usePush = false) => {
      if (routeMode !== 'listener') return;
      const url = new URL(window.location.href);
      if (url.pathname.startsWith('/story/')) {
        url.pathname = '/';
      }
      if (/^#\/story\//i.test(url.hash)) {
        url.hash = '';
      }
      if (storyId) {
        url.searchParams.set('story', storyId);
      } else {
        url.searchParams.delete('story');
      }
      const nextHref = `${url.pathname}${url.search}${url.hash}`;
      const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextHref === currentHref) return;
      if (usePush) {
        window.history.pushState(null, '', nextHref);
      } else {
        window.history.replaceState(null, '', nextHref);
      }
    },
    [routeMode]
  );

  // Sync browser back/forward & hash changes
  useEffect(() => {
    const onNavChange = () => {
      const nextMode = detectRouteMode();
      setRouteMode(nextMode);
      setActiveSection('all');
      if (nextMode === 'listener') {
        setDetailStoryId(extractStoryIdFromLocation());
      } else {
        setDetailStoryId(null);
      }
    };
    window.addEventListener('popstate', onNavChange);
    window.addEventListener('hashchange', onNavChange);
    return () => {
      window.removeEventListener('popstate', onNavChange);
      window.removeEventListener('hashchange', onNavChange);
    };
  }, []);

  const switchRoute = useCallback((mode: AppRouteMode) => {
    setRouteMode(mode);
    setActiveSection('all');
    if (mode === 'admin') {
      setDetailStoryId(null);
      setPendingPlayOnUnlockId(null);
      const url = new URL(window.location.href);
      url.searchParams.delete('story');
      window.history.pushState(null, '', `${url.pathname}${url.search}#/admin`);
    } else {
      setUnlockedMap({});
      setPendingPlayOnUnlockId(null);
      window.history.pushState(null, '', '/');
    }
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const ok = await verifyIsAdminUser(user);
        setIsAdminAuthorized(ok);
      } else {
        setIsAdminAuthorized(false);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Real-time Firestore Subscriptions
  useEffect(() => {
    if (routeMode === 'admin' && authLoading) return;
    if (routeMode === 'admin' && !isAdminAuthorized) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    const adminQuery = routeMode === 'admin' && isAdminAuthorized;
    const unsubStories = subscribeStories(
      adminQuery,
      (items) => {
        setStories(items);
        setIsLoading(false);
      },
      (err) => {
        setLoadError(err.message);
        setIsLoading(false);
      }
    );

    const unsubCats = subscribeCategories(
      (cats) => setCategories(cats),
      (err) => console.error('Categories error:', err)
    );

    return () => {
      unsubStories();
      unsubCats();
    };
  }, [routeMode, authLoading, isAdminAuthorized]);

  // Modals & App Avatar Slot
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);
  const [isRuRiTTSModalOpen, setIsRuRiTTSModalOpen] = useState(false);
  const [importedTtsDraft, setImportedTtsDraft] = useState<RuRiTTSImportedDraft | null>(null);
  const [detailStoryId, setDetailStoryId] = useState<string | null>(null);
  const [pendingSharedStoryId, setPendingSharedStoryId] = useState<string | null>(() =>
    extractStoryIdFromLocation()
  );
  const [sharedLinkNotice, setSharedLinkNotice] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [appAvatarPreview, setAppAvatarPreview] = useState<string | null>(() => {
    try {
      return localStorage.getItem('ts_app_avatar_preview_v1');
    } catch {
      return null;
    }
  });

  const handleUpdateAvatarPreview = useCallback((url: string | null) => {
    setAppAvatarPreview(url);
    try {
      if (url) {
        localStorage.setItem('ts_app_avatar_preview_v1', url);
      } else {
        localStorage.removeItem('ts_app_avatar_preview_v1');
      }
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  // Audio Player & Per-Session Locked Story Unlock State (memory-only)
  const [currentStoryId, setCurrentStoryId] = useState<string | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [unlockedMap, setUnlockedMap] = useState<
    Record<string, {secret: LockedStorySecret; payloadKey: string}>
  >({});
  const [pendingPlayOnUnlockId, setPendingPlayOnUnlockId] = useState<string | null>(null);

  const getListenerState = useCallback(
    (storyId: string): ListenerStoryState => listenerMap[storyId] || DEFAULT_LISTENER_STATE,
    [listenerMap]
  );

  const updateListenerState = useCallback(
    (storyId: string, patch: Partial<ListenerStoryState>) => {
      setListenerMap((prev) => {
        const current = prev[storyId] || DEFAULT_LISTENER_STATE;
        const next = {
          ...prev,
          [storyId]: {...current, ...patch},
        };
        try {
          localStorage.setItem(LISTENER_STATE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage quota errors
        }
        return next;
      });
    },
    []
  );

  const stats: LibraryStats = useMemo(() => {
    let totalChapters = 0;
    let totalDurationSec = 0;
    for (const s of stories) {
      totalChapters += s.isLocked ? s.lockedChapterCount ?? s.chapters.length : s.chapters.length;
      if (!s.isLocked) {
        for (const ch of s.chapters) {
          totalDurationSec += ch.durationSec || 0;
        }
      }
    }
    return {
      totalStories: stories.length,
      totalChapters,
      totalDurationSec,
    };
  }, [stories]);

  const existingKeywords = useMemo(() => {
    const freq = new Map<string, number>();
    for (const s of stories) {
      for (const kw of s.keywords) {
        freq.set(kw, (freq.get(kw) || 0) + 1);
      }
    }
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([kw]) => kw);
  }, [stories]);

  const filteredStories = useMemo(() => {
    const normQuery = removeVietnameseTones(searchQuery.trim());

    const list = stories.filter((story) => {
      const ls = getListenerState(story.id);

      if (routeMode === 'listener' && !story.isPublished) return false;
      if (activeSection === 'drafts' && story.isPublished) return false;
      if (activeSection === 'favorites' && !ls.isFavorite) return false;
      if (activeSection === 'in_progress' && ls.lastPositionSec <= 0 && !ls.lastPlayedAt) {
        return false;
      }

      if (selectedCategory && story.category !== selectedCategory) return false;
      if (selectedKeyword && !story.keywords.includes(selectedKeyword)) return false;

      if (normQuery) {
        const searchable = removeVietnameseTones(
          [
            story.title,
            story.author,
            story.narrator,
            story.category,
            story.description,
            ...story.keywords,
          ].join(' ')
        );
        if (!searchable.includes(normQuery)) return false;
      }

      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'title_asc') {
        return a.title.localeCompare(b.title, 'vi');
      }
      if (sortBy === 'recent_played') {
        const ta = getListenerState(a.id).lastPlayedAt
          ? new Date(getListenerState(a.id).lastPlayedAt!).getTime()
          : 0;
        const tb = getListenerState(b.id).lastPlayedAt
          ? new Date(getListenerState(b.id).lastPlayedAt!).getTime()
          : 0;
        return tb - ta;
      }
      if (sortBy === 'duration_desc') {
        const da = a.chapters.reduce((s, c) => s + (c.durationSec || 0), 0);
        const db = b.chapters.reduce((s, c) => s + (c.durationSec || 0), 0);
        return db - da;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return list;
  }, [
    stories,
    routeMode,
    activeSection,
    selectedCategory,
    selectedKeyword,
    searchQuery,
    sortBy,
    getListenerState,
  ]);

  const isStoryUnlocked = useCallback(
    (story: AudioStory): boolean => {
      if (!story.isLocked) return true;
      const entry = unlockedMap[story.id];
      if (!entry) return false;
      return entry.payloadKey === (story.lockedPayload || '');
    },
    [unlockedMap]
  );

  const resolveEffectiveStory = useCallback(
    (story: AudioStory): AudioStory => {
      if (!story.isLocked) return story;
      const entry = unlockedMap[story.id];
      if (!entry || entry.payloadKey !== (story.lockedPayload || '')) {
        return story;
      }
      return {
        ...story,
        description: entry.secret.description,
        chapters: entry.secret.chapters,
      };
    },
    [unlockedMap]
  );

  // Stop playback automatically if the active story gets locked or its password changes
  useEffect(() => {
    if (!currentStoryId) return;
    const raw = stories.find((s) => s.id === currentStoryId);
    if (raw && raw.isLocked && !isStoryUnlocked(raw)) {
      setIsPlaying(false);
      setCurrentStoryId(null);
    }
  }, [stories, currentStoryId, isStoryUnlocked]);

  const currentStory = useMemo(() => {
    const raw = stories.find((s) => s.id === currentStoryId);
    if (!raw) return null;
    if (raw.isLocked && !isStoryUnlocked(raw)) return null;
    return resolveEffectiveStory(raw);
  }, [stories, currentStoryId, isStoryUnlocked, resolveEffectiveStory]);

  const detailStory = useMemo(
    () => stories.find((s) => s.id === detailStoryId) || null,
    [stories, detailStoryId]
  );

  // Open shared story automatically once library finishes loading
  useEffect(() => {
    if (!pendingSharedStoryId || isLoading) return;
    if (routeMode === 'admin' && authLoading) return;

    const match = stories.find(
      (s) => s.id === pendingSharedStoryId && (routeMode === 'admin' || s.isPublished)
    );
    if (match) {
      setDetailStoryId(match.id);
      setSharedLinkNotice(null);
      if (routeMode === 'listener') {
        const expected = `${window.location.pathname}${window.location.search}`;
        const normalized = new URL(buildStoryShareUrl(match.id));
        if (expected !== `${normalized.pathname}${normalized.search}` || window.location.hash) {
          window.history.replaceState(null, '', `${normalized.pathname}${normalized.search}`);
        }
      }
    } else if (!loadError) {
      setSharedLinkNotice('Không tìm thấy truyện từ đường dẫn chia sẻ (truyện có thể đã bị xoá hoặc đang ở chế độ nháp).');
      syncStoryUrl(null, false);
    }
    setPendingSharedStoryId(null);
  }, [pendingSharedStoryId, isLoading, stories, routeMode, authLoading, loadError, syncStoryUrl]);

  // Keep page title synced with active story
  useEffect(() => {
    const active = detailStory || currentStory;
    document.title = active ? `${active.title} — Tủ sách Rủ Rỉ Rù Rì` : DEFAULT_PAGE_TITLE;
  }, [detailStory, currentStory]);

  const handleOpenDetail = useCallback(
    (story: AudioStory) => {
      setSharedLinkNotice(null);
      setDetailStoryId(story.id);
      syncStoryUrl(story.id, true);
    },
    [syncStoryUrl]
  );

  const handleCloseDetail = useCallback(() => {
    setDetailStoryId(null);
    setPendingPlayOnUnlockId(null);
    syncStoryUrl(currentStoryId, false);
  }, [syncStoryUrl, currentStoryId]);

  const handleSelectSection = (section: NavSection) => {
    if (section === 'backup') {
      setIsBackupModalOpen(true);
      return;
    }
    setActiveSection(section);
  };

  const handleUnlockSuccess = useCallback(
    (storyId: string, secret: LockedStorySecret, shouldAutoPlay = false) => {
      const rawStory = stories.find((s) => s.id === storyId);
      if (!rawStory) return;
      setUnlockedMap((prev) => ({
        ...prev,
        [storyId]: {
          secret,
          payloadKey: rawStory.lockedPayload || '',
        },
      }));
      setPendingPlayOnUnlockId(null);

      if (shouldAutoPlay && secret.chapters.length > 0) {
        const ls = getListenerState(storyId);
        const targetIdx = Math.min(
          ls.lastChapterIndex || 0,
          Math.max(0, secret.chapters.length - 1)
        );
        setCurrentStoryId(storyId);
        setCurrentChapterIndex(targetIdx);
        setIsPlaying(true);
        updateListenerState(storyId, {
          lastChapterIndex: targetIdx,
          lastPlayedAt: new Date().toISOString(),
        });
      }
    },
    [stories, getListenerState, updateListenerState]
  );

  const handlePlayStory = async (story: AudioStory) => {
    if (story.isLocked && !isStoryUnlocked(story)) {
      if (routeMode === 'admin' && isAdminAuthorized) {
        try {
          const vault = await loadStoryAdminVault(story.id);
          if (vault && vault.chapters.length > 0) {
            setUnlockedMap((prev) => ({
              ...prev,
              [story.id]: {
                secret: {description: vault.description, chapters: vault.chapters},
                payloadKey: story.lockedPayload || '',
              },
            }));
            const ls = getListenerState(story.id);
            const targetIdx = Math.min(
              ls.lastChapterIndex || 0,
              Math.max(0, vault.chapters.length - 1)
            );
            setCurrentStoryId(story.id);
            setCurrentChapterIndex(targetIdx);
            setIsPlaying(true);
            updateListenerState(story.id, {lastPlayedAt: new Date().toISOString()});
            return;
          }
        } catch {
          // Fallback to opening detail modal
        }
      }
      setPendingPlayOnUnlockId(story.id);
      handleOpenDetail(story);
      return;
    }

    if (currentStoryId === story.id) {
      setIsPlaying((prev) => !prev);
      return;
    }
    const effective = resolveEffectiveStory(story);
    const ls = getListenerState(story.id);
    const targetIdx = Math.min(
      ls.lastChapterIndex || 0,
      Math.max(0, effective.chapters.length - 1)
    );
    setCurrentStoryId(story.id);
    setCurrentChapterIndex(targetIdx);
    setIsPlaying(true);
    updateListenerState(story.id, {lastPlayedAt: new Date().toISOString()});
    if (!detailStoryId) {
      syncStoryUrl(story.id, false);
    }
  };

  const handlePlayChapter = (story: AudioStory, chapterIdx: number) => {
    if (story.isLocked && !isStoryUnlocked(story)) {
      const hasRealAdminChapters =
        routeMode === 'admin' &&
        isAdminAuthorized &&
        story.chapters.length > 0 &&
        story.chapters[0]?.id !== 'locked-chapter-placeholder';

      if (hasRealAdminChapters) {
        setUnlockedMap((prev) => ({
          ...prev,
          [story.id]: {
            secret: {description: story.description, chapters: story.chapters},
            payloadKey: story.lockedPayload || '',
          },
        }));
      } else {
        setPendingPlayOnUnlockId(story.id);
        handleOpenDetail(story);
        return;
      }
    }

    if (currentStoryId === story.id && currentChapterIndex === chapterIdx) {
      setIsPlaying((prev) => !prev);
      return;
    }
    setCurrentStoryId(story.id);
    setCurrentChapterIndex(chapterIdx);
    setIsPlaying(true);
    updateListenerState(story.id, {
      lastChapterIndex: chapterIdx,
      lastPlayedAt: new Date().toISOString(),
    });
  };

  const handleToggleFavorite = (story: AudioStory) => {
    const current = getListenerState(story.id);
    updateListenerState(story.id, {isFavorite: !current.isFavorite});
  };

  const handleSaveProgress = useCallback(
    (storyId: string, chIndex: number, posSec: number) => {
      updateListenerState(storyId, {
        lastChapterIndex: chIndex,
        lastPositionSec: posSec,
        lastPlayedAt: new Date().toISOString(),
      });
    },
    [updateListenerState]
  );

  const handleSeedStarters = async () => {
    if (!currentUser) return;
    setIsSeeding(true);
    try {
      await seedStarterLibrary(currentUser.uid);
    } finally {
      setIsSeeding(false);
    }
  };

  const isAdminView = routeMode === 'admin';
  const showAdminGate = isAdminView && (!isAdminAuthorized || authLoading);

  // Listen for postMessage exports from RuRiTTS
  useEffect(() => {
    if (!isAdminView || !isAdminAuthorized) return;
    const handleMessage = (event: MessageEvent) => {
      const draft = parseRuRiTTSMessage(event);
      if (!draft) return;
      setImportedTtsDraft(draft);
      setIsRuRiTTSModalOpen(false);
      setIsAddModalOpen(true);
      try {
        if (event.source && 'postMessage' in event.source) {
          (event.source as Window).postMessage({type: 'TUSACH_IMPORT_ACK', ok: true}, '*');
        }
      } catch {
        // Ignore cross-origin reply errors
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isAdminView, isAdminAuthorized]);

  const sectionHeading =
    activeSection === 'favorites'
      ? 'Truyện yêu thích'
      : activeSection === 'in_progress'
        ? 'Đang nghe dở'
        : activeSection === 'drafts'
          ? 'Bản nháp (chưa công khai)'
          : selectedCategory
            ? selectedCategory
            : isAdminView
              ? 'Quản lý kho truyện audio'
              : 'Kho truyện audio';

  const hasActiveFilters = Boolean(
    selectedCategory || selectedKeyword || searchQuery.trim() || activeSection !== 'all'
  );

  return (
    <div
      id="top"
      className="bg-heritage-canvas flex min-h-screen flex-col text-[#2B2111] dark:text-[#F1ECF8]"
    >
      <Header
        appAvatarUrl={appAvatarPreview || '/app-avatar.png'}
        onGoHome={() => {
          switchRoute('listener');
          setActiveSection('all');
        }}
      />

      {showAdminGate ? (
        <main className="flex-1">
          <AdminLoginGate
            currentUser={currentUser}
            authLoading={authLoading}
            onGoToListener={() => switchRoute('listener')}
          />
        </main>
      ) : (
        <div className="mx-auto flex w-full max-w-[1440px] flex-1">
          <Sidebar
            isAdminView={isAdminView}
            isAdminAuthorized={isAdminAuthorized}
            stories={stories}
            categories={categories}
            selectedCategory={selectedCategory}
            selectedKeyword={selectedKeyword}
            activeSection={activeSection}
            stats={stats}
            isOpenMobile={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
            onSelectSection={handleSelectSection}
            onSelectCategory={setSelectedCategory}
            onSelectKeyword={setSelectedKeyword}
            onAddCategory={async (name) => {
              if (currentUser) await createCategoryDoc(name, currentUser.uid);
            }}
            onDeleteCategory={deleteCategoryDoc}
          />

          <main
            className={`min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 ${
              currentStory ? 'pb-28' : 'pb-12'
            }`}
          >
            {/* Workspace Navigation Sub-bar (outside Header) */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#DEC999] pb-3.5 dark:border-[#2E294D]">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DEC999] bg-[#FDF8EA] px-3 text-xs font-medium text-[#3B2E17] hover:bg-[#EFE0BA] lg:hidden dark:border-[#322C52] dark:bg-[#1E1B33] dark:text-[#DCD6F0] dark:hover:bg-[#292447]"
                  aria-label="Mở danh mục phân loại"
                >
                  <Menu className="h-4 w-4" />
                  <span>Danh mục</span>
                </button>

                {!isAdminView ? (
                  <nav className="flex flex-wrap items-center gap-1" aria-label="Điều hướng thư viện">
                    {(
                      [
                        {id: 'all', label: 'Tất cả truyện'},
                        {id: 'in_progress', label: 'Đang nghe'},
                        {id: 'favorites', label: 'Yêu thích'},
                      ] as {id: NavSection; label: string}[]
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectSection(item.id)}
                        className={`h-9 rounded-lg px-3.5 text-sm font-medium whitespace-nowrap transition-colors ${
                          activeSection === item.id
                            ? 'bg-[#7A4B0C] text-white dark:bg-[#6A58C8]'
                            : 'text-[#4B3B21] hover:bg-[#EFE0BA] dark:text-[#CFC8E6] dark:hover:bg-[#211D38]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </nav>
                ) : (
                  <nav className="flex flex-wrap items-center gap-1" aria-label="Điều hướng quản trị">
                    {(
                      [
                        {id: 'all', label: 'Kho truyện'},
                        {id: 'drafts', label: 'Bản nháp'},
                        {id: 'backup', label: 'Sao lưu JSON'},
                      ] as {id: NavSection; label: string}[]
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectSection(item.id)}
                        className={`h-9 rounded-lg px-3.5 text-sm font-medium whitespace-nowrap transition-colors ${
                          activeSection === item.id
                            ? 'bg-[#7A4B0C] text-white dark:bg-[#6A58C8]'
                            : 'text-[#4B3B21] hover:bg-[#EFE0BA] dark:text-[#CFC8E6] dark:hover:bg-[#211D38]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => switchRoute('listener')}
                      className="h-9 rounded-lg px-3.5 text-sm font-medium text-[#4B3B21] whitespace-nowrap hover:bg-[#EFE0BA] dark:text-[#CFC8E6] dark:hover:bg-[#211D38]"
                    >
                      Trang người nghe
                    </button>
                  </nav>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <PWAInstallButton />

                {isAdminView && isAdminAuthorized && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsRuRiTTSModalOpen(true)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DEC999] bg-[#FDF8EA] px-3 text-xs font-medium text-[#7A4B0C] whitespace-nowrap hover:bg-[#EFE0BA] dark:border-[#322C52] dark:bg-[#1E1B33] dark:text-[#D5B263] dark:hover:bg-[#292447]"
                      title="Mở phòng thu RuRiTTS để chuyển văn bản thành audio"
                    >
                      <Mic className="h-3.5 w-3.5" />
                      <span>Tạo Audio (RuRiTTS)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsBrandingModalOpen(true)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DEC999] bg-[#FDF8EA] px-3 text-xs font-medium text-[#4B3B21] whitespace-nowrap hover:bg-[#EFE0BA] dark:border-[#322C52] dark:bg-[#1E1B33] dark:text-[#DCD6F0] dark:hover:bg-[#292447]"
                      title="Quản lý Logo / Avatar ứng dụng & Icon PWA"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span>Avatar & PWA</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(true)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#7A4B0C] px-3.5 text-xs font-medium text-white whitespace-nowrap hover:bg-[#5E3807] dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Thêm truyện</span>
                    </button>
                    <button
                      type="button"
                      onClick={signOutAdmin}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DEC999] bg-[#FDF8EA] px-3 text-xs font-medium text-[#4B3B21] whitespace-nowrap hover:bg-[#EFE0BA] dark:border-[#322C52] dark:bg-[#1E1B33] dark:text-[#DCD6F0] dark:hover:bg-[#292447]"
                      title="Đăng xuất tài khoản quản trị"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Đăng xuất</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Title & Workspace Toolbar */}
            <div className="mb-6 space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold tracking-tight text-[#2B2111] sm:text-3xl dark:text-[#F4EFFB]">
                    {sectionHeading}
                  </h1>
                  <p className="mt-1 text-sm text-[#5C492B] dark:text-[#ACA4CA]">
                    {isAdminView
                      ? 'Thêm mới, sắp xếp phân loại và quản lý toàn bộ kho truyện.'
                      : 'Chọn một bộ truyện yêu thích và thưởng thức trực tuyến mọi lúc.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg border border-[#DEC999] bg-[#FDF8EA] p-0.5 dark:border-[#322C52] dark:bg-[#1E1B33]">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                        viewMode === 'grid'
                          ? 'bg-[#E9D7AA] text-[#2B2111] dark:bg-[#2E294D] dark:text-[#F4EFFB]'
                          : 'text-[#6D5937] hover:text-[#2B2111] dark:text-[#9E94C0] dark:hover:text-[#F4EFFB]'
                      }`}
                      aria-label="Xem dạng lưới"
                      title="Xem dạng lưới"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                        viewMode === 'list'
                          ? 'bg-[#E9D7AA] text-[#2B2111] dark:bg-[#2E294D] dark:text-[#F4EFFB]'
                          : 'text-[#6D5937] hover:text-[#2B2111] dark:text-[#9E94C0] dark:hover:text-[#F4EFFB]'
                      }`}
                      aria-label="Xem dạng danh sách"
                      title="Xem dạng danh sách"
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDarkMode((d) => !d)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DEC999] bg-[#FDF8EA] text-[#4B3B21] hover:bg-[#EFE0BA] dark:border-[#322C52] dark:bg-[#1E1B33] dark:text-[#E5DEF9] dark:hover:bg-[#292447]"
                    aria-label={isDarkMode ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
                    title={isDarkMode ? 'Giao diện sáng' : 'Chế độ ban đêm'}
                  >
                    {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Search & Sort Bar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#856F4B] dark:text-[#9E94C0]" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm theo tên truyện, tác giả, giọng đọc hoặc từ khoá..."
                    className="h-11 w-full rounded-xl border border-[#DEC999] bg-[#FFFDF6] pr-9 pl-10 text-sm text-[#2B2111] placeholder:text-[#8A7553] focus:border-[#7A4B0C] focus:outline-none dark:border-[#322C52] dark:bg-[#1E1B33] dark:text-[#F1ECF8] dark:placeholder:text-[#8E84B2] dark:focus:border-[#8B7AE0]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-[#856F4B] hover:text-[#2B2111] dark:text-[#9E94C0] dark:hover:text-[#F1ECF8]"
                      aria-label="Xoá từ khoá tìm kiếm"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <ArrowUpDown className="h-4 w-4 text-[#856F4B] dark:text-[#9E94C0]" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    aria-label="Sắp xếp truyện"
                    className="h-11 rounded-xl border border-[#DEC999] bg-[#FFFDF6] px-3 text-sm text-[#2B2111] focus:border-[#7A4B0C] focus:outline-none dark:border-[#322C52] dark:bg-[#1E1B33] dark:text-[#F1ECF8] dark:focus:border-[#8B7AE0]"
                  >
                    <option value="newest">Mới thêm gần đây</option>
                    <option value="recent_played">Vừa nghe gần đây</option>
                    <option value="title_asc">Tên truyện A – Z</option>
                    <option value="duration_desc">Thời lượng dài nhất</option>
                  </select>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#DEC999] pb-3 text-xs text-[#5C492B] dark:border-[#2E294D] dark:text-[#ACA4CA]">
                  <span>
                    Đang hiển thị{' '}
                    <strong className="font-mono-tabular text-[#2B2111] dark:text-[#F4EFFB]">
                      {filteredStories.length}
                    </strong>{' '}
                    truyện
                  </span>
                  {selectedCategory && (
                    <span>
                      Phân loại:{' '}
                      <strong className="text-[#2B2111] dark:text-[#F4EFFB]">
                        {selectedCategory}
                      </strong>
                    </span>
                  )}
                  {selectedKeyword && (
                    <span>
                      Từ khoá:{' '}
                      <strong className="text-[#2B2111] dark:text-[#F4EFFB]">
                        #{selectedKeyword}
                      </strong>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection('all');
                      setSelectedCategory(null);
                      setSelectedKeyword(null);
                      setSearchQuery('');
                    }}
                    className="font-medium text-[#7A4B0C] hover:underline dark:text-[#D5B263]"
                  >
                    Xoá tất cả bộ lọc
                  </button>
                </div>
              )}
            </div>

            {/* Shared link notice if story unavailable */}
            {sharedLinkNotice && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
                <span>{sharedLinkNotice}</span>
                <button
                  type="button"
                  onClick={() => setSharedLinkNotice(null)}
                  className="rounded p-1 hover:bg-amber-200/60 dark:hover:bg-amber-900/50"
                  aria-label="Đóng thông báo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Content States */}
            {loadError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900/40 dark:bg-rose-950/30">
                <p className="text-sm font-medium text-rose-800 dark:text-rose-200">{loadError}</p>
              </div>
            ) : isLoading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({length: 4}).map((_, i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-xl border border-[#DFCCA0] bg-[#FDF8EB] dark:border-[#302B4F] dark:bg-[#1E1B33]"
                  >
                    <div className="aspect-[3/4] animate-pulse bg-[#E9D7AA] dark:bg-[#292447]" />
                    <div className="space-y-2.5 p-4">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-[#E9D7AA] dark:bg-[#292447]" />
                      <div className="h-4 w-5/6 animate-pulse rounded bg-[#E9D7AA] dark:bg-[#292447]" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-[#E9D7AA] dark:bg-[#292447]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredStories.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D3BC87] bg-[#FDF8EB]/85 px-6 py-16 text-center dark:border-[#37315A] dark:bg-[#1E1B33]/80">
                <BookOpen className="h-10 w-10 text-[#856F4B] dark:text-[#9E94C0]" />
                <h2 className="mt-3 font-display text-lg font-semibold text-[#2B2111] dark:text-[#F4EFFB]">
                  {hasActiveFilters
                    ? 'Không tìm thấy truyện audio phù hợp'
                    : isAdminView
                      ? 'Kho truyện trên Firestore đang trống'
                      : 'Thư viện đang được cập nhật'}
                </h2>
                <p className="mt-1 max-w-md text-sm text-[#5C492B] dark:text-[#ACA4CA]">
                  {hasActiveFilters
                    ? 'Thử thay đổi từ khoá tìm kiếm hoặc bỏ chọn phân loại hiện tại.'
                    : isAdminView
                      ? 'Hãy bấm "Thêm truyện" để gắn link audio đầu tiên, hoặc khởi tạo nhanh 4 bộ truyện mẫu.'
                      : 'Quản trị viên chưa đăng tải bộ truyện nào. Vui lòng quay lại sau.'}
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection('all');
                        setSelectedCategory(null);
                        setSelectedKeyword(null);
                        setSearchQuery('');
                      }}
                      className="min-h-[40px] rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-4 py-2 text-sm font-medium text-[#4B3B21] hover:bg-[#EFE0BA] dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#DCD6F0] dark:hover:bg-[#2D284D]"
                    >
                      Xem tất cả truyện
                    </button>
                  )}
                  {isAdminView && isAdminAuthorized && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsAddModalOpen(true)}
                        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#7A4B0C] px-4 py-2 text-sm font-medium text-white hover:bg-[#5E3807] dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Thêm truyện mới</span>
                      </button>
                      {stories.length === 0 && (
                        <button
                          type="button"
                          disabled={isSeeding}
                          onClick={handleSeedStarters}
                          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#D3BC87] bg-[#FFFDF6] px-4 py-2 text-sm font-medium text-[#3B2E17] hover:bg-[#EFE0BA] disabled:opacity-60 dark:border-[#37315A] dark:bg-[#231F3D] dark:text-[#DCD6F0] dark:hover:bg-[#2D284D]"
                        >
                          <Sparkles className="h-4 w-4" />
                          <span>{isSeeding ? 'Đang tạo...' : 'Khởi tạo 4 truyện mẫu'}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredStories.map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    listenerState={getListenerState(story.id)}
                    isAdminView={isAdminView}
                    isUnlocked={isStoryUnlocked(story)}
                    isCurrentStory={currentStoryId === story.id}
                    isPlaying={isPlaying}
                    onPlayStory={handlePlayStory}
                    onOpenDetail={handleOpenDetail}
                    onToggleFavorite={handleToggleFavorite}
                    onSelectKeyword={(kw) => setSelectedKeyword((prev) => (prev === kw ? null : kw))}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredStories.map((story) => (
                  <StoryListRow
                    key={story.id}
                    story={story}
                    listenerState={getListenerState(story.id)}
                    isAdminView={isAdminView}
                    isUnlocked={isStoryUnlocked(story)}
                    isCurrentStory={currentStoryId === story.id}
                    isPlaying={isPlaying}
                    onPlayStory={handlePlayStory}
                    onOpenDetail={handleOpenDetail}
                    onToggleFavorite={handleToggleFavorite}
                    onSelectKeyword={(kw) => setSelectedKeyword((prev) => (prev === kw ? null : kw))}
                  />
                ))}
              </div>
            )}

            {/* Quiet Footer with Admin entry */}
            <footer className="mt-14 border-t border-[#DEC999] pt-6 text-xs text-[#6D5937] dark:border-[#2E294D] dark:text-[#9E94C0]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span>Tủ sách Rủ Rỉ Rù Rì · Nghe truyện audio trực tuyến miễn phí</span>
                <button
                  type="button"
                  onClick={() => switchRoute(isAdminView ? 'listener' : 'admin')}
                  className="hover:text-[#2B2111] hover:underline dark:hover:text-[#F1ECF8]"
                >
                  {isAdminView ? 'Chuyển sang Trang Người nghe' : 'Khu vực quản trị'}
                </button>
              </div>
            </footer>
          </main>
        </div>
      )}

      <AudioPlayerBar
        story={currentStory}
        listenerState={currentStory ? getListenerState(currentStory.id) : null}
        chapterIndex={currentChapterIndex}
        isPlaying={isPlaying}
        onPlayingChange={setIsPlaying}
        onChangeChapter={(idx) => setCurrentChapterIndex(idx)}
        onSaveProgress={handleSaveProgress}
        onOpenStoryDetail={handleOpenDetail}
        onClosePlayer={() => {
          setIsPlaying(false);
          setCurrentStoryId(null);
          syncStoryUrl(detailStoryId, false);
        }}
      />

      {isAdminView && isAdminAuthorized && currentUser && (
        <>
          <AddStoryModal
            isOpen={isAddModalOpen}
            adminUid={currentUser.uid}
            categories={categories}
            existingKeywords={existingKeywords}
            importedDraft={importedTtsDraft}
            onClearDraft={() => setImportedTtsDraft(null)}
            onOpenRuRiTTS={() => {
              setIsAddModalOpen(false);
              setIsRuRiTTSModalOpen(true);
            }}
            onClose={() => setIsAddModalOpen(false)}
            onCreated={() => {}}
          />

          <RuRiTTSModal
            isOpen={isRuRiTTSModalOpen}
            onClose={() => setIsRuRiTTSModalOpen(false)}
          />

          <BackupModal
            isOpen={isBackupModalOpen}
            adminUid={currentUser.uid}
            stories={stories}
            categories={categories}
            stats={stats}
            onClose={() => setIsBackupModalOpen(false)}
          />

          <BrandingModal
            isOpen={isBrandingModalOpen}
            currentAvatarUrl={appAvatarPreview || '/app-avatar.png'}
            onUpdatePreviewAvatar={handleUpdateAvatarPreview}
            onClose={() => setIsBrandingModalOpen(false)}
          />
        </>
      )}

      <OfflineIndicator hasPlayer={Boolean(currentStory)} />

      <StoryDetailModal
        story={detailStory}
        listenerState={
          detailStory ? getListenerState(detailStory.id) : DEFAULT_LISTENER_STATE
        }
        isAdminView={isAdminView}
        isAdminAuthorized={isAdminAuthorized}
        isUnlocked={detailStory ? isStoryUnlocked(detailStory) : false}
        unlockedSecret={
          detailStory && isStoryUnlocked(detailStory)
            ? unlockedMap[detailStory.id]?.secret ?? null
            : null
        }
        autoPlayOnUnlock={Boolean(detailStory && pendingPlayOnUnlockId === detailStory.id)}
        categories={categories}
        currentStoryId={currentStoryId}
        currentChapterIndex={currentChapterIndex}
        isPlaying={isPlaying}
        onClose={handleCloseDetail}
        onPlayChapter={handlePlayChapter}
        onToggleFavorite={handleToggleFavorite}
        onUpdateStory={updateStoryDoc}
        onDeleteStory={async (id) => {
          await deleteStoryDoc(id);
          if (currentStoryId === id) {
            setIsPlaying(false);
            setCurrentStoryId(null);
          }
        }}
        onSelectKeyword={(kw) => setSelectedKeyword(kw)}
        onUnlockSuccess={handleUnlockSuccess}
      />
    </div>
  );
}

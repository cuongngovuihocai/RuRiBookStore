import {initializeApp} from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type {AudioChapter, AudioStory, CategoryDoc, StoryAdminVault} from './types';
import {
  encryptStorySecret,
  LOCKED_PLACEHOLDER_CHAPTERS,
  LOCKED_PLACEHOLDER_DESCRIPTION,
} from './utils/storyLock';

export const ADMIN_EMAIL = 'cuongngovuihocai@gmail.com';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({prompt: 'select_account'});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export async function signInAdminWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

export async function verifyIsAdminUser(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (user.email === ADMIN_EMAIL) return true;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch {
    return false;
  }
}

function timestampToIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof (val as Timestamp).toDate === 'function') {
    return (val as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 120);
  return cleaned || `id-${Date.now()}`;
}

function sanitizeChapters(chapters: AudioChapter[]): AudioChapter[] {
  return chapters.slice(0, 200).map((ch, idx) => ({
    id: String(ch.id || `ch-${idx + 1}`).slice(0, 100),
    title: String(ch.title || `Chương ${idx + 1}`).trim().slice(0, 200),
    sourceType: ch.sourceType === 'sample' ? 'sample' : 'url',
    audioUrl: String(ch.audioUrl || '').trim().slice(0, 1000),
    ...(ch.originalUrl ? {originalUrl: String(ch.originalUrl).trim().slice(0, 1000)} : {}),
    ...(typeof ch.sizeBytes === 'number' && ch.sizeBytes > 0 ? {sizeBytes: ch.sizeBytes} : {}),
    durationSec: typeof ch.durationSec === 'number' ? Math.max(0, Math.round(ch.durationSec)) : 0,
    ...(ch.mimeType ? {mimeType: String(ch.mimeType).slice(0, 100)} : {}),
  }));
}

function sanitizeKeywords(keywords: string[]): string[] {
  return Array.from(
    new Set(
      keywords
        .map((k) => String(k).trim().slice(0, 50))
        .filter(Boolean)
    )
  ).slice(0, 20);
}

function mapStoryDoc(id: string, data: Record<string, unknown>): AudioStory {
  return {
    id,
    title: String(data.title || ''),
    author: String(data.author || 'Chưa rõ tác giả'),
    narrator: String(data.narrator || 'Chưa rõ giọng đọc'),
    category: String(data.category || 'Truyện ngắn'),
    keywords: Array.isArray(data.keywords) ? data.keywords.map(String) : [],
    description: String(data.description || ''),
    coverUrl: String(data.coverUrl || '/src/assets/images/cover_novel_rain_1794949188336.jpg'),
    chapters: Array.isArray(data.chapters) ? (data.chapters as AudioChapter[]) : [],
    isPublished: Boolean(data.isPublished),
    isLocked: Boolean(data.isLocked),
    ...(typeof data.accessSalt === 'string' ? {accessSalt: data.accessSalt} : {}),
    ...(typeof data.lockedPayload === 'string' ? {lockedPayload: data.lockedPayload} : {}),
    ...(typeof data.lockedChapterCount === 'number'
      ? {lockedChapterCount: data.lockedChapterCount}
      : {}),
    createdBy: String(data.createdBy || ''),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export async function loadStoryAdminVault(storyId: string): Promise<StoryAdminVault | null> {
  const path = `stories/${storyId}/adminVault/content`;
  try {
    const snap = await getDoc(doc(db, 'stories', storyId, 'adminVault', 'content'));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    return {
      description: String(data.description || ''),
      chapters: Array.isArray(data.chapters) ? (data.chapters as AudioChapter[]) : [],
      lockPassword: String(data.lockPassword || ''),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeStories(
  isAdminMode: boolean,
  onData: (stories: AudioStory[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'stories';
  const q = isAdminMode
    ? query(collection(db, path))
    : query(collection(db, path), where('isPublished', '==', true));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => mapStoryDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeCategories(
  onData: (categories: CategoryDoc[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'categories';
  const q = query(collection(db, path), where('isPublic', '==', true));

  return onSnapshot(
    q,
    (snap) => {
      const items: CategoryDoc[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: String(data.name || ''),
          isPublic: Boolean(data.isPublic),
          createdBy: String(data.createdBy || ''),
          createdAt: timestampToIso(data.createdAt),
        };
      });
      items.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createStoryDoc(
  input: {
    id?: string;
    title: string;
    author: string;
    narrator: string;
    category: string;
    keywords: string[];
    description: string;
    coverUrl: string;
    chapters: AudioChapter[];
    isPublished?: boolean;
    lockPassword?: string;
  },
  adminUid: string
): Promise<string> {
  const storyId = sanitizeId(input.id || `story-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const path = `stories/${storyId}`;
  const cleanDescription = (input.description || '').trim().slice(0, 2500);
  const cleanChapters = sanitizeChapters(input.chapters);
  const cleanLockPass = (input.lockPassword || '').trim().slice(0, 100);

  let encryptedLock: {accessSalt: string; lockedPayload: string} | null = null;
  if (cleanLockPass) {
    encryptedLock = await encryptStorySecret(
      {description: cleanDescription, chapters: cleanChapters},
      cleanLockPass
    );
  }

  const payload: Record<string, unknown> = {
    title: input.title.trim().slice(0, 200),
    author: (input.author || 'Chưa rõ tác giả').trim().slice(0, 150),
    narrator: (input.narrator || 'Chưa rõ giọng đọc').trim().slice(0, 150),
    category: (input.category || 'Truyện ngắn').trim().slice(0, 80),
    keywords: sanitizeKeywords(input.keywords),
    description: encryptedLock ? LOCKED_PLACEHOLDER_DESCRIPTION : cleanDescription,
    coverUrl: (input.coverUrl || '/src/assets/images/cover_novel_rain_1794949188336.jpg').trim().slice(0, 1000),
    chapters: encryptedLock ? LOCKED_PLACEHOLDER_CHAPTERS : cleanChapters,
    isPublished: input.isPublished !== false,
    isLocked: Boolean(encryptedLock),
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (encryptedLock) {
    payload.accessSalt = encryptedLock.accessSalt;
    payload.lockedPayload = encryptedLock.lockedPayload.slice(0, 250000);
    payload.lockedChapterCount = cleanChapters.length;
  }

  try {
    await setDoc(doc(db, 'stories', storyId), payload);
    if (encryptedLock) {
      await setDoc(doc(db, 'stories', storyId, 'adminVault', 'content'), {
        description: cleanDescription,
        chapters: cleanChapters,
        lockPassword: cleanLockPass,
        updatedBy: adminUid,
        updatedAt: serverTimestamp(),
      });
    }
    return storyId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export interface UpdateStoryPatch
  extends Partial<
    Pick<
      AudioStory,
      | 'title'
      | 'author'
      | 'narrator'
      | 'category'
      | 'keywords'
      | 'description'
      | 'coverUrl'
      | 'chapters'
      | 'isPublished'
    >
  > {
  lockConfig?: {enabled: boolean; password?: string};
}

export async function updateStoryDoc(storyId: string, patch: UpdateStoryPatch): Promise<void> {
  const path = `stories/${storyId}`;
  const adminUid = auth.currentUser?.uid;
  const cleanPatch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (patch.title !== undefined) cleanPatch.title = patch.title.trim().slice(0, 200);
  if (patch.author !== undefined) cleanPatch.author = patch.author.trim().slice(0, 150);
  if (patch.narrator !== undefined) cleanPatch.narrator = patch.narrator.trim().slice(0, 150);
  if (patch.category !== undefined) cleanPatch.category = patch.category.trim().slice(0, 80);
  if (patch.coverUrl !== undefined) cleanPatch.coverUrl = patch.coverUrl.trim().slice(0, 1000);
  if (patch.keywords !== undefined) cleanPatch.keywords = sanitizeKeywords(patch.keywords);
  if (patch.isPublished !== undefined) cleanPatch.isPublished = Boolean(patch.isPublished);

  try {
    const storyRef = doc(db, 'stories', storyId);
    const storySnap = await getDoc(storyRef);
    const existingData = (storySnap.data() || {}) as Record<string, unknown>;
    const currentlyLocked = Boolean(existingData.isLocked);

    const needsLockHandling =
      patch.lockConfig !== undefined ||
      (currentlyLocked && (patch.chapters !== undefined || patch.description !== undefined));

    if (!needsLockHandling) {
      if (patch.description !== undefined) {
        cleanPatch.description = patch.description.trim().slice(0, 2500);
      }
      if (patch.chapters !== undefined) {
        cleanPatch.chapters = sanitizeChapters(patch.chapters);
      }
      await updateDoc(storyRef, cleanPatch);
      return;
    }

    const vault = currentlyLocked ? await loadStoryAdminVault(storyId) : null;
    const realDescription = (
      patch.description !== undefined
        ? patch.description
        : vault?.description ?? String(existingData.description || '')
    )
      .trim()
      .slice(0, 2500);

    const realChapters = sanitizeChapters(
      patch.chapters !== undefined
        ? patch.chapters
        : vault?.chapters?.length
          ? vault.chapters
          : ((existingData.chapters as AudioChapter[]) || [])
    );

    const targetLocked =
      patch.lockConfig !== undefined ? patch.lockConfig.enabled : currentlyLocked;

    if (targetLocked) {
      const targetPassword = (
        patch.lockConfig?.password !== undefined
          ? patch.lockConfig.password
          : vault?.lockPassword || ''
      )
        .trim()
        .slice(0, 100);

      if (!targetPassword) {
        throw new Error('Vui lòng nhập mật khẩu để khoá truyện.');
      }
      if (!adminUid) {
        throw new Error('Cần đăng nhập Admin để cập nhật khoá truyện.');
      }

      const encrypted = await encryptStorySecret(
        {description: realDescription, chapters: realChapters},
        targetPassword
      );

      cleanPatch.isLocked = true;
      cleanPatch.accessSalt = encrypted.accessSalt;
      cleanPatch.lockedPayload = encrypted.lockedPayload.slice(0, 250000);
      cleanPatch.lockedChapterCount = realChapters.length;
      cleanPatch.description = LOCKED_PLACEHOLDER_DESCRIPTION;
      cleanPatch.chapters = LOCKED_PLACEHOLDER_CHAPTERS;

      await updateDoc(storyRef, cleanPatch);
      await setDoc(doc(db, 'stories', storyId, 'adminVault', 'content'), {
        description: realDescription,
        chapters: realChapters,
        lockPassword: targetPassword,
        updatedBy: adminUid,
        updatedAt: serverTimestamp(),
      });
    } else {
      cleanPatch.isLocked = false;
      cleanPatch.accessSalt = deleteField();
      cleanPatch.lockedPayload = deleteField();
      cleanPatch.lockedChapterCount = deleteField();
      cleanPatch.description = realDescription;
      cleanPatch.chapters = realChapters;

      await updateDoc(storyRef, cleanPatch);
      try {
        await deleteDoc(doc(db, 'stories', storyId, 'adminVault', 'content'));
      } catch {
        // Ignore if vault did not exist
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteStoryDoc(storyId: string): Promise<void> {
  const path = `stories/${storyId}`;
  try {
    try {
      await deleteDoc(doc(db, 'stories', storyId, 'adminVault', 'content'));
    } catch {
      // Ignore if vault does not exist
    }
    await deleteDoc(doc(db, 'stories', storyId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createCategoryDoc(name: string, adminUid: string): Promise<void> {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return;
  const slug = sanitizeId(
    trimmed
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/\s+/g, '-')
  );
  const path = `categories/${slug}`;
  try {
    await setDoc(doc(db, 'categories', slug), {
      name: trimmed,
      isPublic: true,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCategoryDoc(categoryId: string): Promise<void> {
  const path = `categories/${categoryId}`;
  try {
    await deleteDoc(doc(db, 'categories', categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export const DEFAULT_CATEGORIES = [
  'Tiểu thuyết',
  'Truyện ngắn',
  'Kiếm hiệp & Tiên hiệp',
  'Trinh thám & Bí ẩn',
  'Phát triển bản thân',
  'Tản văn & Chữa lành',
  'Truyện thiếu nhi',
  'Lịch sử & Văn hoá',
];

export async function seedStarterLibrary(adminUid: string): Promise<number> {
  const existingStories = await getDocs(collection(db, 'stories'));
  const existingCats = await getDocs(collection(db, 'categories'));

  if (existingCats.empty) {
    for (const catName of DEFAULT_CATEGORIES) {
      await createCategoryDoc(catName, adminUid);
    }
  }

  if (!existingStories.empty) return 0;

  const starters = [
    {
      id: 'story-sample-1',
      title: 'Những Mùa Mưa Đi Qua Hiên Vắng',
      author: 'Minh Nhật',
      narrator: 'Giọng đọc Trầm Ấm (Audio mẫu)',
      category: 'Tiểu thuyết',
      keywords: ['tình cảm', 'hoài niệm', 'đêm khuya', 'nhẹ nhàng'],
      description:
        'Tuyển tập truyện dài nhiều chương về những ký ức tuổi trẻ bên hiên nhà ngày mưa. Bản thu mẫu có sẵn 2 chương để bạn thử nghiệm tính năng chuyển chương, hẹn giờ tắt và ghi nhớ vị trí nghe.',
      coverUrl: '/src/assets/images/cover_novel_rain_1794949188336.jpg',
      chapters: [
        {
          id: 'ch-1-1',
          title: 'Chương 1: Tiếng mưa đầu hạ',
          sourceType: 'sample' as const,
          audioUrl: '/samples/mua_ben_hien_1.wav',
          durationSec: 24,
          mimeType: 'audio/wav',
        },
        {
          id: 'ch-1-2',
          title: 'Chương 2: Chuyến tàu cuối năm',
          sourceType: 'sample' as const,
          audioUrl: '/samples/mua_ben_hien_2.wav',
          durationSec: 22,
          mimeType: 'audio/wav',
        },
      ],
      isPublished: true,
    },
    {
      id: 'story-sample-2',
      title: 'Đèn Hoa Đăng Trên Bến Cổ',
      author: 'Lâm Hạc',
      narrator: 'Thanh Thảo (Audio mẫu)',
      category: 'Kiếm hiệp & Tiên hiệp',
      keywords: ['cổ trang', 'giang hồ', 'huyền huyễn', 'dài tập'],
      description:
        'Câu chuyện giang hồ ân oán bên dòng sông tĩnh lặng mỗi đêm rằm thả hoa đăng. Bạn có thể chèn hàng chục link chương từ Cloudflare R2 hoặc Archive.org vào bộ truyện này.',
      coverUrl: '/src/assets/images/cover_folklore_lantern_1794949188795.jpg',
      chapters: [
        {
          id: 'ch-2-1',
          title: 'Hồi 1: Ánh đèn bên bến nước',
          sourceType: 'sample' as const,
          audioUrl: '/samples/den_long_song_dem.wav',
          durationSec: 28,
          mimeType: 'audio/wav',
        },
      ],
      isPublished: true,
    },
    {
      id: 'story-sample-3',
      title: 'Bí Mật Thư Phòng Cầu Thang Xoắn',
      author: 'Hoàng Bách',
      narrator: 'Quốc Khánh (Audio mẫu)',
      category: 'Trinh thám & Bí ẩn',
      keywords: ['trinh thám', 'phá án', 'hồi hộp', 'thư viện'],
      description:
        'Một vụ mất tích kỳ lạ trong căn biệt thự cổ có chiếc cầu thang xoắn dẫn lên gác mái. Phù hợp nghe buổi tối với tốc độ phát 1.25x hoặc 1.5x.',
      coverUrl: '/src/assets/images/cover_mystery_library_1794949189389.jpg',
      chapters: [
        {
          id: 'ch-3-1',
          title: 'Phần mở đầu: Ngọn đèn lúc nửa đêm',
          sourceType: 'sample' as const,
          audioUrl: '/samples/thu_phong_co.wav',
          durationSec: 26,
          mimeType: 'audio/wav',
        },
      ],
      isPublished: true,
    },
    {
      id: 'story-sample-4',
      title: 'Sương Sớm Trên Đồi Tĩnh Lặng',
      author: 'An Nhiên',
      narrator: 'Bảo Ngọc (Audio mẫu)',
      category: 'Tản văn & Chữa lành',
      keywords: ['chữa lành', 'thư giãn', 'ngủ ngon', 'tản văn'],
      description:
        'Những trang tản văn nhẹ nhàng giúp thả lỏng tâm trí trước khi đi ngủ, kết hợp cùng bộ hẹn giờ tắt tự động ngay trên thanh phát audio.',
      coverUrl: '/src/assets/images/cover_mindfulness_lotus_1794949189015.jpg',
      chapters: [
        {
          id: 'ch-4-1',
          title: 'Tản văn 1: Hơi thở buổi sớm',
          sourceType: 'sample' as const,
          audioUrl: '/samples/suong_som.wav',
          durationSec: 30,
          mimeType: 'audio/wav',
        },
      ],
      isPublished: true,
    },
  ];

  for (const item of starters) {
    await createStoryDoc(item, adminUid);
  }
  return starters.length;
}

import type {AudioChapter} from '../types';

export const LOCKED_PLACEHOLDER_DESCRIPTION = 'Truyện này đang được bảo vệ bằng mật khẩu.';

export const LOCKED_PLACEHOLDER_CHAPTERS: AudioChapter[] = [
  {
    id: 'locked-chapter-placeholder',
    title: 'Nội dung được bảo vệ bằng mật khẩu',
    sourceType: 'url',
    audioUrl: '',
    durationSec: 0,
  },
];

export interface LockedStorySecret {
  description: string;
  chapters: AudioChapter[];
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function deriveAesKey(password: string, saltBytes: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer.slice(
        saltBytes.byteOffset,
        saltBytes.byteOffset + saltBytes.byteLength
      ) as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    {name: 'AES-GCM', length: 256},
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptStorySecret(
  secret: LockedStorySecret,
  password: string
): Promise<{accessSalt: string; lockedPayload: string}> {
  const cleanPass = password.trim();
  if (!cleanPass) {
    throw new Error('Mật khẩu khoá truyện không được để trống.');
  }

  const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
  const ivBytes = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(cleanPass, saltBytes);

  const enc = new TextEncoder();
  const plaintextBytes = enc.encode(
    JSON.stringify({
      description: secret.description || '',
      chapters: secret.chapters || [],
    })
  );

  const cipherBuffer = await window.crypto.subtle.encrypt(
    {name: 'AES-GCM', iv: ivBytes},
    key,
    plaintextBytes
  );

  return {
    accessSalt: bytesToHex(saltBytes),
    lockedPayload: `${bytesToBase64(ivBytes)}.${bytesToBase64(new Uint8Array(cipherBuffer))}`,
  };
}

export async function decryptStorySecret(
  lockedPayload: string,
  accessSalt: string,
  password: string
): Promise<LockedStorySecret> {
  const cleanPass = password.trim();
  if (!cleanPass || !lockedPayload || !accessSalt) {
    throw new Error('Vui lòng nhập mật khẩu.');
  }

  const parts = lockedPayload.split('.');
  if (parts.length !== 2) {
    throw new Error('Dữ liệu mã hoá của truyện không hợp lệ.');
  }

  try {
    const ivBytes = base64ToBytes(parts[0]);
    const cipherBytes = base64ToBytes(parts[1]);
    const saltBytes = hexToBytes(accessSalt);
    const key = await deriveAesKey(cleanPass, saltBytes);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes.buffer.slice(
          ivBytes.byteOffset,
          ivBytes.byteOffset + ivBytes.byteLength
        ) as ArrayBuffer,
      },
      key,
      cipherBytes.buffer.slice(
        cipherBytes.byteOffset,
        cipherBytes.byteOffset + cipherBytes.byteLength
      ) as ArrayBuffer
    );

    const dec = new TextDecoder();
    const parsed = JSON.parse(dec.decode(decryptedBuffer)) as Partial<LockedStorySecret>;
    return {
      description: typeof parsed.description === 'string' ? parsed.description : '',
      chapters: Array.isArray(parsed.chapters) ? parsed.chapters : [],
    };
  } catch {
    throw new Error('Mật khẩu không đúng, vui lòng thử lại.');
  }
}

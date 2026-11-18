import {useState} from 'react';

interface HeaderProps {
  onGoHome: () => void;
  appAvatarUrl?: string;
}

const LOGO_LIGHT_URL = 'https://lh3.googleusercontent.com/d/1yOLi510GeFZT7mihMrnhZRKXtel1C6-z';
const LOGO_DARK_URL = 'https://lh3.googleusercontent.com/d/1q6B38HJxp8PEO5qmufm3HrJ0gBv8a2Z8';

export function Header({onGoHome, appAvatarUrl = '/app-avatar.png'}: HeaderProps) {
  const [lightLogoErr, setLightLogoErr] = useState(false);
  const [darkLogoErr, setDarkLogoErr] = useState(false);
  const [avatarErr, setAvatarErr] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-[#DEC999] bg-[#F7ECCE]/95 backdrop-blur-sm dark:border-[#2E294D] dark:bg-[#19162D]/95">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        {/* App Avatar Slot + App Name */}
        <a
          href="#/"
          onClick={(e) => {
            e.preventDefault();
            onGoHome();
          }}
          className="flex items-center gap-3 whitespace-nowrap shrink-0 group"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#DEC999] bg-[#18152C] shadow-xs transition-transform group-hover:scale-[1.03] sm:h-10 sm:w-10 dark:border-[#3A3460]">
            {!avatarErr ? (
              <img
                src={appAvatarUrl}
                alt="Avatar Tủ sách Rủ Rỉ Rù Rì"
                onError={() => setAvatarErr(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src="/pwa-192x192.png"
                alt="Avatar Tủ sách Rủ Rỉ Rù Rì"
                className="h-full w-full object-cover"
              />
            )}
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-[#2B2111] sm:text-xl dark:text-[#F4EFFB]">
            Tủ sách Rủ Rỉ Rù Rì
          </span>
        </a>

        {/* Ham Chơi Logo (Top Right) */}
        <div className="flex items-center shrink-0">
          {!lightLogoErr ? (
            <img
              src={LOGO_LIGHT_URL}
              alt="Logo Ham Chơi"
              referrerPolicy="no-referrer"
              onError={() => setLightLogoErr(true)}
              className="h-9 w-auto object-contain dark:hidden sm:h-10"
            />
          ) : (
            <span className="font-display text-base font-semibold text-[#2B2111] dark:hidden">
              Ham Chơi
            </span>
          )}

          {!darkLogoErr ? (
            <img
              src={LOGO_DARK_URL}
              alt="Logo Ham Chơi"
              referrerPolicy="no-referrer"
              onError={() => setDarkLogoErr(true)}
              className="hidden h-9 w-auto object-contain dark:block sm:h-10"
            />
          ) : (
            <span className="hidden font-display text-base font-semibold text-[#F4EFFB] dark:inline">
              Ham Chơi
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

import {WifiOff} from 'lucide-react';
import {useOnlineStatus} from '../hooks/useOnlineStatus';

interface OfflineIndicatorProps {
  hasPlayer?: boolean;
}

export function OfflineIndicator({hasPlayer = false}: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className={`fixed left-4 z-40 flex items-center gap-2 rounded-lg border border-amber-600/30 bg-[#7A4B0C] px-3 py-2 text-xs font-medium text-white shadow-lg dark:border-[#8B7AE0]/30 dark:bg-[#2B254A] ${
        hasPlayer ? 'bottom-24' : 'bottom-4'
      }`}
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Đang ngoại tuyến — Hiển thị dữ liệu đã lưu</span>
    </div>
  );
}

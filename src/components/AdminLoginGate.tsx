import type {User} from 'firebase/auth';
import {ArrowLeft, Loader2, Lock, LogIn, LogOut} from 'lucide-react';
import {useState} from 'react';
import {ADMIN_EMAIL, signInAdminWithGoogle, signOutAdmin} from '../firebase';

interface AdminLoginGateProps {
  currentUser: User | null;
  authLoading: boolean;
  onGoToListener: () => void;
}

export function AdminLoginGate({
  currentUser,
  authLoading,
  onGoToListener,
}: AdminLoginGateProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsSigningIn(true);
    try {
      await signInAdminWithGoogle();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Đăng nhập không thành công. Vui lòng thử lại.'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-12">
      <div className="w-full rounded-2xl border border-[#DFCCA0] bg-[#FDF8EB] p-7 text-center shadow-xs dark:border-[#302B4F] dark:bg-[#1E1B33]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EFE0BA] text-[#663E07] dark:bg-[#2A2548] dark:text-[#E5DEF9]">
          <Lock className="h-5 w-5" />
        </div>

        <h1 className="mt-4 font-display text-2xl font-semibold text-[#2B2111] dark:text-[#F4EFFB]">
          Khu vực Quản trị
        </h1>

        {authLoading ? (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[#6D5937] dark:text-[#ACA4CA]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Đang kiểm tra phiên đăng nhập...</span>
          </div>
        ) : currentUser ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-[#5C492B] dark:text-[#ACA4CA]">
              Tài khoản{' '}
              <strong className="text-[#2B2111] dark:text-[#F1ECF8]">{currentUser.email}</strong>{' '}
              không có quyền quản trị thư viện này.
            </p>
            <p className="text-xs text-[#735E3B] dark:text-[#8E84B2]">
              Vui lòng đăng nhập bằng tài khoản quản trị (<span className="font-mono">{ADMIN_EMAIL}</span>).
            </p>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={signOutAdmin}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#7A4B0C] px-4 py-2 text-sm font-medium text-white hover:bg-[#5E3807] dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
              >
                <LogOut className="h-4 w-4" />
                <span>Đăng xuất & Đổi tài khoản</span>
              </button>
              <button
                type="button"
                onClick={onGoToListener}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-[#D8C28F] px-4 py-2 text-sm font-medium text-[#4B3B21] hover:bg-[#F3E5BF] dark:border-[#37315A] dark:text-[#E5DEF9] dark:hover:bg-[#292447]"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Quay lại Trang Người nghe</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-5">
            <p className="text-sm text-[#5C492B] dark:text-[#ACA4CA]">
              Đăng nhập bằng tài khoản Google quản trị để thêm, chỉnh sửa, sắp xếp truyện và quản lý danh mục.
            </p>

            {errorMsg && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                disabled={isSigningIn}
                onClick={handleGoogleSignIn}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#7A4B0C] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#5E3807] disabled:opacity-60 dark:bg-[#6A58C8] dark:hover:bg-[#5947B5]"
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Đang đăng nhập...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span>Đăng nhập bằng Google</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onGoToListener}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-[#D8C28F] px-4 py-2 text-sm font-medium text-[#4B3B21] hover:bg-[#F3E5BF] dark:border-[#37315A] dark:text-[#E5DEF9] dark:hover:bg-[#292447]"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Quay lại Trang Người nghe</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

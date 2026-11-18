import {AlertTriangle} from 'lucide-react';
import {Component, type ErrorInfo, type ReactNode} from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Đã xảy ra lỗi không mong muốn.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMsg = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed && typeof parsed.error === 'string') {
          friendlyMsg = `Lỗi truy cập dữ liệu (${parsed.operationType || 'read'}): ${parsed.error}`;
        }
      } catch {
        // Keep plain message
      }

      return (
        <div className="bg-heritage-canvas flex min-h-screen items-center justify-center p-6 text-[#2B2111] dark:text-[#F1ECF8]">
          <div className="w-full max-w-md rounded-2xl border border-[#DFCCA0] bg-[#FDF8EB] p-6 text-center shadow-sm dark:border-[#302B4F] dark:bg-[#1E1B33]">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" />
            <h1 className="mt-3 font-display text-xl font-semibold">Không thể tải ứng dụng</h1>
            <p className="mt-2 text-sm text-[#5C492B] dark:text-[#ACA4CA]">{friendlyMsg}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex min-h-[40px] items-center rounded-lg bg-[#7A4B0C] px-4 py-2 text-sm font-medium text-white hover:bg-[#5E3807] dark:bg-[#6A58C8]"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

'use client';

import { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] 捕获到组件错误:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMsg = this.state.error?.message || '';
      const isNetworkError = errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('Failed');
      const isPermissionError = errorMsg.includes('permission') || errorMsg.includes('denied') || errorMsg.includes('403');

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              页面出现异常
            </h2>
            <p className="text-gray-600 mb-4">
              {isNetworkError
                ? '网络连接出现问题，请检查网络后重试'
                : isPermissionError
                ? '权限不足，请检查登录状态'
                : '应用遇到了一个意外错误'}
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left text-sm text-blue-800">
              <p className="font-medium mb-2">您可以尝试：</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>点击下方{'"重试"'}按钮</li>
                <li>刷新浏览器页面</li>
                {isNetworkError && <li>检查网络连接是否正常</li>}
                <li>清除浏览器缓存后重新访问</li>
                <li>如果问题持续，请返回首页</li>
              </ul>
            </div>
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                  错误详情
                </summary>
                <pre className="mt-2 p-3 bg-gray-100 rounded-lg text-xs text-red-700 overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700"
              >
                重试
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-100 text-gray-700 py-2.5 px-6 rounded-lg font-medium hover:bg-gray-200"
              >
                刷新页面
              </button>
              <button
                onClick={this.handleGoHome}
                className="w-full bg-gray-100 text-gray-700 py-2.5 px-6 rounded-lg font-medium hover:bg-gray-200"
              >
                返回首页
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

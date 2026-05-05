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

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              页面出现异常
            </h2>
            <p className="text-gray-600 mb-6">
              应用遇到了一个意外错误，请尝试刷新页面
            </p>
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
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all"
              >
                重试
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-100 text-gray-700 py-2.5 px-6 rounded-lg font-medium hover:bg-gray-200 transition-all"
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

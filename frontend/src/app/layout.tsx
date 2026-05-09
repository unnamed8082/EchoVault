import type { Metadata } from 'next';
import { ReactNode } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import './globals.css';

export const metadata: Metadata = {
  title: 'EchoVault - 隐私至上的 AI 数字陪伴',
  description: '保存情感记忆，创建专属数字分身',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}

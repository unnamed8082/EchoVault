export type PlatformType = 'web' | 'electron' | 'mobile';

interface PlatformInfo {
  type: PlatformType;
  isWeb: boolean;
  isElectron: boolean;
  isMobile: boolean;
}

function detectPlatform(): PlatformInfo {
  if (typeof window !== 'undefined' && (window as any).process?.versions?.electron) {
    return { type: 'electron', isWeb: false, isElectron: true, isMobile: false };
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return { type: isMobile ? 'mobile' : 'web', isWeb: !isMobile, isElectron: false, isMobile };
}

const platform = detectPlatform();

export function getPlatform(): PlatformInfo {
  return platform;
}

export function getAPIBaseURL(): string {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (platform.isElectron) {
    return 'http://localhost:9000';
  }
  if (platform.isMobile) {
    return typeof (window as any).__ECHOVAULT_API_URL === 'string'
      ? (window as any).__ECHOVAULT_API_URL
      : 'http://localhost:9000';
  }
  return 'http://localhost:9000';
}

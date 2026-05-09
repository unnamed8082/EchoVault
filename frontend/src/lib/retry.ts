interface RetryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOnStatus?: number[];
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryOnStatus: [408, 429, 500, 502, 503, 504],
};

function shouldRetry(status: number | undefined, retryOnStatus: number[], attempt: number, maxRetries: number): boolean {
  if (attempt >= maxRetries) return false;
  if (status === undefined) return true;
  return retryOnStatus.includes(status);
}

function getDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs, retryOnStatus } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const status = error?.response?.status || error?.status;

      if (!shouldRetry(status, retryOnStatus, attempt, maxRetries)) {
        throw error;
      }

      const delay = getDelay(attempt, baseDelayMs, maxDelayMs);
      console.warn(
        `[Retry] 第 ${attempt + 1}/${maxRetries} 次重试，等待 ${Math.round(delay)}ms，状态码: ${status || 'N/A'}`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return true;
  }
  const axiosError = error as any;
  return axiosError?.code === 'ECONNABORTED' || axiosError?.code === 'ERR_NETWORK';
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  const axiosError = error as any;
  if (axiosError?.response?.data?.detail) {
    return axiosError.response.data.detail;
  }
  if (axiosError?.message) {
    return axiosError.message;
  }
  return '未知错误';
}

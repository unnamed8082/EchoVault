export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

class WebStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    if (typeof localStorage === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('[Storage] setItem failed:', e);
    }
  }

  async removeItem(key: string): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[Storage] removeItem failed:', e);
    }
  }
}

let adapter: StorageAdapter = new WebStorageAdapter();

export function getStorage(): StorageAdapter {
  return adapter;
}

export function setStorage(custom: StorageAdapter): void {
  adapter = custom;
}

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await adapter.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setJSON<T>(key: string, value: T): Promise<void> {
  await adapter.setItem(key, JSON.stringify(value));
}

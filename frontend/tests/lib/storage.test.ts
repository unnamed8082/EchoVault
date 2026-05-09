import { getStorage, setStorage, getJSON, setJSON } from '../../src/lib/storage';

class MockStorageAdapter {
  store: Record<string, string> = {};

  async getItem(key: string): Promise<string | null> {
    return this.store[key] ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store[key] = value;
  }

  async removeItem(key: string): Promise<void> {
    delete this.store[key];
  }
}

describe('storage', () => {
  const originalAdapter = getStorage();
  let mockAdapter: MockStorageAdapter;

  beforeEach(() => {
    mockAdapter = new MockStorageAdapter();
    setStorage(mockAdapter);
  });

  afterAll(() => {
    setStorage(originalAdapter);
  });

  describe('setStorage / getStorage', () => {
    it('should return the default WebStorageAdapter initially', () => {
      const adapter = getStorage();
      expect(adapter).toBeDefined();
      expect(adapter.getItem).toBeInstanceOf(Function);
      expect(adapter.setItem).toBeInstanceOf(Function);
      expect(adapter.removeItem).toBeInstanceOf(Function);
    });

    it('should allow replacing the storage adapter', () => {
      const custom = new MockStorageAdapter();
      setStorage(custom);
      expect(getStorage()).toBe(custom);
    });
  });

  describe('getJSON', () => {
    it('should return fallback when key does not exist', async () => {
      const result = await getJSON('nonexistent', { foo: 'bar' });
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should parse valid JSON from storage', async () => {
      await mockAdapter.setItem('test-key', '{"provider":"deepseek","model":"test"}');
      const result = await getJSON('test-key', { provider: '', model: '' });
      expect(result).toEqual({ provider: 'deepseek', model: 'test' });
    });

    it('should return fallback when stored value is invalid JSON', async () => {
      await mockAdapter.setItem('bad-json', 'not-valid-json');
      const result = await getJSON('bad-json', { provider: 'default' });
      expect(result).toEqual({ provider: 'default' });
    });

    it('should return fallback when stored value is empty string', async () => {
      await mockAdapter.setItem('empty', '');
      const result = await getJSON('empty', { fallback: true });
      expect(result).toEqual({ fallback: true });
    });

    it('should handle null value correctly', async () => {
      const result = await getJSON<null>('missing', null);
      expect(result).toBeNull();
    });

    it('should handle numeric values', async () => {
      await mockAdapter.setItem('num', '42');
      const result = await getJSON('num', 0);
      expect(result).toBe(42);
    });

    it('should handle boolean values', async () => {
      await mockAdapter.setItem('bool', 'true');
      const result = await getJSON('bool', false);
      expect(result).toBe(true);
    });

    it('should handle array values', async () => {
      await mockAdapter.setItem('arr', '[1,2,3]');
      const result = await getJSON<number[]>('arr', []);
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('setJSON', () => {
    it('should serialize and store JSON value', async () => {
      await setJSON('config', { provider: 'glm', model: 'glm-4' });
      const raw = await mockAdapter.getItem('config');
      expect(raw).toBe('{"provider":"glm","model":"glm-4"}');
    });

    it('should overwrite existing value', async () => {
      await mockAdapter.setItem('key', '{"old":true}');
      await setJSON('key', { new: true });
      const result = await getJSON('key', {});
      expect(result).toEqual({ new: true });
    });

    it('should handle undefined values in object', async () => {
      await setJSON('data', { a: 1, b: undefined } as any);
      const raw = await mockAdapter.getItem('data');
      expect(raw).toBe('{"a":1}');
    });
  });
});

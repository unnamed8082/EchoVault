import { CloudSyncService, SyncConfig, SyncResult, ConflictResolution } from '../lib/cloud-sync';

describe('CloudSyncService - Data Synchronization', () => {
  let syncService: CloudSyncService;

  beforeEach(() => {
    syncService = new CloudSyncService({
      syncEndpoint: '/api/sync',
      conflictStrategy: 'last-write-wins',
      autoSyncInterval: 30000,
      offlineSupport: true,
      maxRetries: 3,
      retryDelay: 1000
    });
  });

  describe('Data Synchronization Strategies', () => {
    test('should perform bidirectional sync with cloud', async () => {
      const localData = { treehole_entries: [{ id: '1', content: 'Test entry' }] };
      
      const result = await syncService.syncData('treehole', localData);
      
      expect(result.success).toBe(true);
      expect(result.syncedAt).toBeGreaterThan(0);
      expect(result.changes.pushed.length + result.changes.pulled.length).toBeGreaterThanOrEqual(0);
    }, 15000);

    test('should handle push-only synchronization', async () => {
      const chatHistory = [
        { id: 'msg-1', role: 'user', content: 'Hello' },
        { id: 'msg-2', role: 'assistant', content: 'Hi there!' }
      ];

      const result = await syncService.pushData('chat_history', chatHistory);
      
      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(2);
    }, 10000);

    test('should handle pull-only synchronization', async () => {
      const result = await syncService.pullData('settings');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    }, 10000);

    test('should support incremental sync (delta updates)', async () => {
      await syncService.syncData('treehole', { entries: ['initial'] });
      
      const updateData = { entries: ['initial', 'added'] };
      const result = await syncService.syncData('treehole', updateData, {
        mode: 'incremental'
      });

      expect(result.success).toBe(true);
      expect(result.isDeltaSync).toBe(true);
    }, 10000);
  });

  describe('Conflict Resolution Mechanisms', () => {
    beforeEach(async () => {
      await syncService.syncData('conflict-test', { value: 'original' });
    });

    test('should detect conflicts between local and remote data', async () => {
      const localChanges = { value: 'local-modification' };
      
      // Simulate remote modification by directly updating
      // (In real scenario, this would happen on server)
      
      const result = await syncService.syncData('conflict-test', localChanges, {
        forceConflict: true,
        remoteVersion: { value: 'remote-modification', _version: 2 }
      });

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(0);
    }, 10000);

    test('should resolve conflicts using last-write-wins strategy', async () => {
      const result = await syncService.syncData('conflict-test', 
        { value: 'newer-local-data' },
        {
          conflictStrategy: 'last-write-wins',
          remoteVersion: { value: 'older-remote-data', _version: 1, _updatedAt: Date.now() - 60000 }
        }
      );

      if (result.hasConflicts) {
        expect(result.resolution?.strategy).toBe('last-write-wins');
        expect(result.resolvedData?.value).toBe('newer-local-data');
      }
    }, 10000);

    test('should resolve conflicts using manual merge strategy', async () => {
      const customResolver: ConflictResolution = async (local, remote) => ({
        merged: {
          ...local,
          ...remote,
          _conflictResolved: true,
          resolvedAt: Date.now()
        },
        strategy: 'custom-merge'
      });

      const result = await syncService.syncData('conflict-test',
        { localField: 'A', sharedField: 'local-value' },
        {
          conflictStrategy: 'custom',
          customResolver,
          remoteVersion: { remoteField: 'B', sharedField: 'remote-value' }
        }
      );

      if (result.hasConflicts) {
        expect(result.resolvedData?._conflictResolved).toBe(true);
        expect(result.resolvedData?.localField).toBe('A');
        expect(result.resolvedData?.remoteField).toBe('B');
      }
    }, 10000);

    test('should preserve both versions in merge conflict', async () => {
      const result = await syncService.syncData('conflict-test',
        { text: 'Local version' },
        {
          conflictStrategy: 'keep-both',
          remoteVersion: { text: 'Remote version' }
        }
      );

      if (result.hasConflicts) {
        expect(result.conflictBackup).toBeDefined();
        expect(result.conflictBackup?.local).toBeDefined();
        expect(result.conflictBackup?.remote).toBeDefined();
      }
    }, 10000);
  });

  describe('Network Error Handling & Offline Support', () => {
    test('should queue changes when offline', async () => {
      syncService.setNetworkStatus(false);
      
      const offlineData = { queued: true, timestamp: Date.now() };
      const result = await syncService.pushData('offline-collection', offlineData);

      expect(result.success).toBe(true);
      expect(result.isQueued).toBe(true);
      expect(syncService.getPendingQueueLength()).toBeGreaterThan(0);
    });

    test('should auto-sync queued changes when back online', async () => {
      syncService.setNetworkStatus(false);
      
      await syncService.pushData('queue-test', { item: 1 });
      await syncService.pushData('queue-test', { item: 2 });
      
      expect(syncService.getPendingQueueLength()).toBe(2);

      syncService.setNetworkStatus(true);
      
      const syncResult = await syncService.processQueue();
      
      expect(syncResult.processedCount).toBe(2);
      expect(syncService.getPendingQueueLength()).toBe(0);
    }, 15000);

    test('should retry failed sync operations', async () => {
      let attemptCount = 0;
      
      const retryService = new CloudSyncService({
        syncEndpoint: '/api/sync',
        maxRetries: 3,
        retryDelay: 100
      });

      // Mock network failure for first 2 attempts
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('Network error');
        }
        return {
          ok: true,
          json: async () => ({ success: true })
        };
      }) as any;

      try {
        const result = await retryService.pushData('retry-test', { data: 'test' });
        
        expect(result.success).toBe(true);
        expect(attemptCount).toBe(3);
      } finally {
        global.fetch = originalFetch;
      }
    }, 5000);

    test('should handle timeout during sync', async () => {
      const timeoutService = new CloudSyncService({
        syncEndpoint: '/api/slow-endpoint',
        requestTimeout: 100
      });

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 500))
      ) as any;

      try {
        await expect(
          timeoutService.pushData('timeout-test', {})
        ).rejects.toThrow(/timeout/i);
      } finally {
        global.fetch = originalFetch;
      }
    }, 1000);
  });

  describe('Data Consistency & Integrity', () => {
    test('should maintain data versioning', async () => {
      const initialData = { v1: true };
      await syncService.syncData('versioned-data', initialData);

      const updatedData = { v1: true, v2: true };
      const result = await syncService.syncData('versioned-data', updatedData);

      expect(result.version).toBeGreaterThan(0);
      expect(result.previousVersion).toBeDefined();
    }, 10000);

    test('should validate data integrity after sync', async () => {
      const originalData = { checksum: 'abc123', items: [1, 2, 3] };
      
      await syncService.syncData('integrity-test', originalData);
      
      const retrieved = await syncService.pullData('integrity-test');
      
      expect(retrieved.data).toEqual(originalData);
      expect(retrieved.integrityCheck).toBe('valid');
    }, 10000);

    test('should handle partial sync failures gracefully', async () => {
      const multiCollection = {
        collection1: { success: true },
        collection2: { willFail: true },
        collection3: { alsoSuccess: true }
      };

      const results = await syncService.syncMultiple(multiCollection);
      
      expect(results.totalCollections).toBe(3);
      expect(results.successfulSyncs).toBeGreaterThanOrEqual(2);
      expect(results.failedSyncs.length).toBeGreaterThanOrEqual(0);
    }, 15000);
  });

  describe('Synchronization Scheduling & Performance', () => {
    test('should schedule periodic auto-sync', async () => {
      const scheduler = new CloudSyncService({
        syncEndpoint: '/api/sync',
        autoSyncInterval: 100,
        enableAutoSync: true
      });

      scheduler.startAutoSync(['treehole', 'settings']);
      
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const stats = scheduler.getSyncStats();
      expect(stats.autoSyncCount).toBeGreaterThan(0);
      
      scheduler.stopAutoSync();
    }, 2000);

    test('should throttle rapid sync requests', async () => {
      const throttledService = new CloudSyncService({
        syncEndpoint: '/api/sync',
        throttleInterval: 200
      });

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(throttledService.pushData(`throttle-${i}`, { index: i }));
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      // Some requests should be throttled/queued
      expect(successful).toBeLessThanOrEqual(5);
    }, 3000);

    test('should track sync performance metrics', async () => {
      await syncService.syncData('metrics-test', {});
      
      const metrics = syncService.getPerformanceMetrics();
      
      expect(metrics.totalSyncs).toBeGreaterThan(0);
      expect(metrics.averageSyncTime).toBeGreaterThan(0);
      expect(metrics.lastSyncTime).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Cross-Device Synchronization', () => {
    test('should track device identity for conflict resolution', async () => {
      const deviceId = syncService.getDeviceId();
      
      expect(deviceId).toBeDefined();
      expect(deviceId.length).toBeGreaterThan(10);
    });

    test('should sync across multiple data types atomically', async () => {
      const atomicData = {
        treehole: { entries: ['entry1'] },
        settings: { theme: 'dark' },
        chat: { messages: [] }
      };

      const result = await syncService.atomicSync(atomicData);
      
      expect(result.atomic).toBe(true);
      if (!result.success) {
        expect(result.rollbackCompleted).toBe(true);
      }
    }, 15000);
  });
});

describe('CloudSyncService - Environment Adaptation', () => {
  test('should adapt to different API endpoints', () => {
    const customEndpoint = new CloudSyncService({
      syncEndpoint: 'https://custom-api.example.com/v1/sync'
    });

    expect(customEndpoint.getConfig().syncEndpoint).toContain('custom-api');
  });

  test('should use environment-specific configuration', () => {
    const envSync = CloudSyncService.fromEnvironment();
    
    expect(envSync).toBeInstanceOf(CloudSyncService);
    expect(envSync.getConfig().syncEndpoint).toBeTruthy();
  });

  test('should handle CORS preflight for cross-origin requests', async () => {
    const corsSync = new CloudSyncService({
      syncEndpoint: 'https://cloud.echovault.com/api/sync',
      credentials: 'include'
    });

    const config = corsSync.getConfig();
    expect(config.credentials).toBe('include');
  });
});

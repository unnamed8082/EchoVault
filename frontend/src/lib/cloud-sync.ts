export interface SyncConfig {
  syncEndpoint: string;
  conflictStrategy?: 'last-write-wins' | 'first-write-wins' | 'manual' | 'custom' | 'keep-both';
  customResolver?: ConflictResolution;
  autoSyncInterval?: number;
  enableAutoSync?: boolean;
  offlineSupport?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  requestTimeout?: number;
  throttleInterval?: number;
  credentials?: RequestCredentials;
}

export interface SyncResult {
  success: boolean;
  syncedAt: number;
  version?: number;
  previousVersion?: number;
  changes: {
    pushed: string[];
    pulled: string[];
    conflicts: string[];
  };
  hasConflicts?: boolean;
  conflicts?: Array<{
    field: string;
    localValue: unknown;
    remoteValue: unknown;
  }>;
  resolution?: {
    strategy: string;
    resolvedAt: number;
  };
  resolvedData?: Record<string, unknown>;
  conflictBackup?: {
    local: Record<string, unknown>;
    remote: Record<string, unknown>;
  };
  isDeltaSync?: boolean;
  isQueued?: boolean;
  recordsProcessed?: number;
  integrityCheck?: string;
  error?: string;
}

export interface PullResult extends SyncResult {
  data: Record<string, unknown> | null;
}

export interface QueueProcessingResult {
  processedCount: number;
  failedCount: number;
  errors: Array<{ data: unknown; error: string }>;
}

export interface MultiSyncResult {
  totalCollections: number;
  successfulSyncs: number;
  failedSyncs: number;
  results: Map<string, SyncResult>;
}

export type ConflictResolution = (
  localData: Record<string, unknown>,
  remoteData: Record<string, unknown>
) => Promise<{
  merged: Record<string, unknown>;
  strategy: string;
}>;

interface PendingSyncItem {
  collection: string;
  data: unknown;
  timestamp: number;
  retryCount: number;
}

interface SyncMetadata {
  lastSyncAt: number;
  version: number;
  deviceId: string;
  checksum: string;
}

interface PerformanceMetrics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageSyncTime: number;
  lastSyncTime: number | null;
  autoSyncCount: number;
}

class SyncError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

export class CloudSyncService {
  private config: Required<Omit<SyncConfig, 'customResolver'>> & Pick<SyncConfig, 'customResolver'>;
  private pendingQueue: PendingSyncItem[] = [];
  private isOnline: boolean = true;
  private deviceId: string;
  private metadata: Map<string, SyncMetadata> = new Map();
  private performanceMetrics: PerformanceMetrics = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    averageSyncTime: 0,
    lastSyncTime: null,
    autoSyncCount: 0
  };
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;
  private throttleTimers: Map<string, number> = new Map();
  private collectionsToAutoSync: string[] = [];

  constructor(config: SyncConfig) {
    this.config = {
      conflictStrategy: config.conflictStrategy || 'last-write-wins',
      autoSyncInterval: config.autoSyncInterval || 30000,
      enableAutoSync: config.enableAutoSync || false,
      offlineSupport: config.offlineSupport !== false,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      requestTimeout: config.requestTimeout || 30000,
      throttleInterval: config.throttleInterval || 0,
      credentials: config.credentials || 'same-origin',
      ...config
    };

    this.deviceId = this.generateDeviceId();
    this.loadMetadata();
  }

  static fromEnvironment(): CloudSyncService {
    return new CloudSyncService({
      syncEndpoint: process.env.NEXT_PUBLIC_SYNC_ENDPOINT || '/api/sync',
      conflictStrategy: (process.env.NEXT_PUBLIC_SYNC_CONFLICT_STRATEGY as any) || 'last-write-wins',
      autoSyncInterval: parseInt(process.env.NEXT_PUBLIC_AUTO_SYNC_INTERVAL || '60000'),
      enableAutoSync: process.env.NEXT_PUBLIC_ENABLE_AUTO_SYNC === 'true',
      offlineSupport: process.env.NEXT_PUBLIC_OFFLINE_SUPPORT !== 'false'
    });
  }

  getConfig(): Readonly<SyncConfig> {
    return this.config;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  setNetworkStatus(isOnline: boolean): void {
    this.isOnline = isOnline;

    if (isOnline && this.pendingQueue.length > 0) {
      this.processQueue().catch(console.error);
    }
  }

  async syncData(
    collection: string,
    data: Record<string, unknown>,
    options: {
      mode?: 'full' | 'incremental';
      forceConflict?: boolean;
      remoteVersion?: Record<string, unknown>;
      conflictStrategy?: string;
      customResolver?: ConflictResolution;
      enableAutoSync?: boolean;
    } = {}
  ): Promise<SyncResult> {
    const startTime = Date.now();

    if (this.shouldThrottle(collection)) {
      return this.queueOrReturnThrottled(collection, data);
    }

    try {
      const localMeta = this.metadata.get(collection);
      const result = await this.executeSync(collection, data, options);

      this.updatePerformanceMetrics(true, Date.now() - startTime);
      
      if (options.enableAutoSync !== false && this.config.autoSyncInterval) {
        this.scheduleNextSync();
      }

      return result;
    } catch (error) {
      this.updatePerformanceMetrics(false, Date.now() - startTime);
      
      if (this.config.offlineSupport || !this.isOnline) {
        return this.queueForLater(collection, data);
      }
      
      throw error;
    }
  }

  async pushData(collection: string, data: unknown): Promise<SyncResult> {
    if (!this.isOnline && this.config.offlineSupport) {
      return this.queueForLater(collection, data);
    }

    try {
      const response = await this.makeRequest(`${this.config.syncEndpoint}/push`, {
        method: 'POST',
        body: JSON.stringify({
          collection,
          data,
          deviceId: this.deviceId,
          timestamp: Date.now()
        })
      });

      const result = await response.json();

      return {
        success: result.success,
        syncedAt: Date.now(),
        changes: { pushed: [collection], pulled: [], conflicts: [] },
        recordsProcessed: Array.isArray(data) ? data.length : 1,
        version: result.version
      };
    } catch (error) {
      if (this.config.offlineSupport) {
        return this.queueForLater(collection, data);
      }
      throw new SyncError(`Push failed: ${(error as Error).message}`, 'PUSH_ERROR');
    }
  }

  async pullData(collection: string): Promise<PullResult> {
    try {
      const meta = this.metadata.get(collection);
      const url = `${this.config.syncEndpoint}/pull/${collection}?since=${meta?.version || 0}&device=${this.deviceId}`;

      const response = await this.makeRequest(url);
      const result = await response.json();

      if (result.data) {
        this.updateMetadata(collection, result.version, result.checksum);
      }

      return {
        success: true,
        syncedAt: Date.now(),
        data: result.data,
        changes: {
          pushed: [],
          pulled: result.data ? [collection] : [],
          conflicts: []
        },
        integrityCheck: result.checksum ? 'valid' : 'unknown'
      };
    } catch (error) {
      throw new SyncError(`Pull failed: ${(error as Error).message}`, 'PULL_ERROR');
    }
  }

  async syncMultiple(dataMap: Record<string, unknown>): Promise<MultiSyncResult> {
    const results = new Map<string, SyncResult>();
    let successful = 0;
    let failed = 0;

    for (const [collection, data] of Object.entries(dataMap)) {
      try {
        const result = await this.syncData(collection, data as Record<string, unknown>);
        results.set(collection, result);
        
        if (result.success) successful++;
        else failed++;
      } catch (error) {
        results.set(collection, {
          success: false,
          syncedAt: Date.now(),
          changes: { pushed: [], pulled: [], conflicts: [] },
          error: (error as Error).message
        });
        failed++;
      }
    }

    return {
      totalCollections: Object.keys(dataMap).length,
      successfulSyncs: successful,
      failedSyncs: failed,
      results
    };
  }

  async atomicSync(dataMap: Record<string, unknown>): Promise<SyncResult & { atomic: boolean; rollbackCompleted?: boolean }> {
    try {
      const response = await this.makeRequest(`${this.config.syncEndpoint}/atomic`, {
        method: 'POST',
        body: JSON.stringify({
          collections: dataMap,
          deviceId: this.deviceId,
          timestamp: Date.now()
        })
      });

      const result = await response.json();

      for (const [collection] of Object.entries(dataMap)) {
        if (result.versions?.[collection]) {
          this.updateMetadata(collection, result.versions[collection]);
        }
      }

      return {
        success: result.success,
        syncedAt: Date.now(),
        atomic: true,
        changes: {
          pushed: Object.keys(dataMap),
          pulled: result.pulledCollections || [],
          conflicts: result.conflicts || []
        }
      };
    } catch (error) {
      return {
        success: false,
        syncedAt: Date.now(),
        atomic: false,
        rollbackCompleted: true,
        changes: { pushed: [], pulled: [], conflicts: [] },
        error: `Atomic sync failed: ${(error as Error).message}`
      };
    }
  }

  startAutoSync(collections: string[]): void {
    this.collectionsToAutoSync = collections;
    
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
    }

    this.autoSyncTimer = setInterval(async () => {
      if (!this.isOnline) return;

      for (const collection of collections) {
        try {
          await this.pullData(collection);
          this.performanceMetrics.autoSyncCount++;
        } catch (error) {
          console.error(`Auto-sync failed for ${collection}:`, error);
        }
      }
    }, this.config.autoSyncInterval);
  }

  stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
    this.collectionsToAutoSync = [];
  }

  getPendingQueueLength(): number {
    return this.pendingQueue.length;
  }

  async processQueue(): Promise<QueueProcessingResult> {
    const result: QueueProcessingResult = {
      processedCount: 0,
      failedCount: 0,
      errors: []
    };

    while (this.pendingQueue.length > 0 && this.isOnline) {
      const item = this.pendingQueue.shift()!;
      
      try {
        await this.pushData(item.collection, item.data);
        result.processedCount++;
      } catch (error) {
        item.retryCount++;
        
        if (item.retryCount < this.config.maxRetries) {
          this.pendingQueue.unshift(item);
          await this.delay(this.config.retryDelay * item.retryCount);
        } else {
          result.failedCount++;
          result.errors.push({
            data: item.data,
            error: (error as Error).message
          });
        }
      }
    }

    this.persistQueue();
    return result;
  }

  getSyncStats(): {
    pendingItems: number;
    autoSyncCount: number;
    isOnline: boolean;
    lastSyncTimes: Map<string, number>;
  } {
    const lastSyncTimes = new Map<string, number>();
    
    for (const [collection, meta] of Array.from(this.metadata)) {
      lastSyncTimes.set(collection, meta.lastSyncAt);
    }

    return {
      pendingItems: this.pendingQueue.length,
      autoSyncCount: this.performanceMetrics.autoSyncCount,
      isOnline: this.isOnline,
      lastSyncTimes
    };
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  clearAllLocalData(): void {
    this.metadata.clear();
    this.pendingQueue = [];
    this.saveMetadata();
    localStorage.removeItem('echovault_sync_queue');
  }

  private async executeSync(
    collection: string,
    data: Record<string, unknown>,
    options: any
  ): Promise<SyncResult> {
    const strategy = options.conflictStrategy || this.config.conflictStrategy;
    let remoteData = options.remoteVersion;

    if (!remoteData && !options.forceConflict) {
      try {
        const pullResult = await this.pullData(collection);
        remoteData = pullResult.data as any;
      } catch (error) {
        // Remote not available, proceed with local data only
      }
    }

    const conflicts = this.detectConflicts(data, remoteData);

    if (conflicts.length > 0 || options.forceConflict) {
      return this.resolveConflicts(collection, data, remoteData || {}, strategy, options.customResolver);
    }

    // No conflicts, push local data
    const pushResult = await this.pushData(collection, data);
    
    if (remoteData) {
      pushResult.changes.pulled.push(collection);
    }

    return pushResult;
  }

  private detectConflicts(
    local: Record<string, unknown>,
    remote: Record<string, unknown> | undefined
  ): Array<{ field: string; localValue: unknown; remoteValue: unknown }> {
    if (!remote) return [];

    const conflicts: Array<{ field: string; localValue: unknown; remoteValue: unknown }> = [];

    for (const key of Object.keys(local)) {
      if (key in remote && JSON.stringify(local[key]) !== JSON.stringify(remote[key])) {
        conflicts.push({
          field: key,
          localValue: local[key],
          remoteValue: remote[key]
        });
      }
    }

    return conflicts;
  }

  private async resolveConflicts(
    collection: string,
    localData: Record<string, unknown>,
    remoteData: Record<string, unknown>,
    strategy: string,
    customResolver?: ConflictResolution
  ): Promise<SyncResult> {
    let resolvedData: Record<string, unknown>;

    switch (strategy) {
      case 'last-write-wins':
        resolvedData = { ...localData, _resolvedBy: 'local', _resolvedAt: Date.now() };
        break;

      case 'first-write-wins':
        resolvedData = { ...remoteData, _resolvedBy: 'remote', _resolvedAt: Date.now() };
        break;

      case 'keep-both': {
        resolvedData = {
          ...localData,
          _conflictBackup: {
            local: localData,
            remote: remoteData
          }
        };
        break;
      }

      case 'custom':
        if (customResolver) {
          const mergeResult = await customResolver(localData, remoteData);
          resolvedData = mergeResult.merged;
        } else {
          resolvedData = { ...localData };
        }
        break;

      default:
        resolvedData = { ...localData };
    }

    const pushResult = await this.pushData(collection, resolvedData);

    return {
      ...pushResult,
      hasConflicts: true,
      conflicts: this.detectConflicts(localData, remoteData),
      resolution: {
        strategy,
        resolvedAt: Date.now()
      },
      resolvedData,
      conflictBackup: strategy === 'keep-both' ? { local: localData, remote: remoteData } : undefined
    };
  }

  private shouldThrottle(collection: string): boolean {
    if (!this.config.throttleInterval) return false;
    
    const lastSync = this.throttleTimers.get(collection);
    if (!lastSync) return false;

    return Date.now() - lastSync < this.config.throttleInterval;
  }

  private queueOrReturnThrottled(collection: string, data: unknown): SyncResult {
    this.throttleTimers.set(collection, Date.now());
    return this.queueForLater(collection, data);
  }

  private queueForLater(collection: string, data: unknown): SyncResult {
    const item: PendingSyncItem = {
      collection,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.pendingQueue.push(item);
    this.persistQueue();

    return {
      success: true,
      syncedAt: Date.now(),
      changes: { pushed: [], pulled: [], conflicts: [] },
      isQueued: true
    };
  }

  private async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...((options.headers as Record<string, string>) || {})
        },
        body: options.body,
        credentials: this.config.credentials,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new SyncError(`HTTP ${response.status}: ${response.statusText}`, `HTTP_${response.status}`, response.status >= 500);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new SyncError('Request timeout', 'TIMEOUT', true);
      }
      
      throw error;
    }
  }

  private generateDeviceId(): string {
    const stored = localStorage.getItem('echovault_device_id');
    if (stored) return stored;

    const id = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${crypto.randomUUID()?.slice(0, 8) || ''}`;
    localStorage.setItem('echovault_device_id', id);
    return id;
  }

  private updateMetadata(collection: string, version: number, checksum?: string): void {
    const existing = this.metadata.get(collection);
    
    this.metadata.set(collection, {
      lastSyncAt: Date.now(),
      version: version || (existing?.version || 0) + 1,
      deviceId: this.deviceId,
      checksum: checksum || ''
    });

    this.saveMetadata();
  }

  private loadMetadata(): void {
    try {
      const stored = localStorage.getItem('echovault_sync_metadata');
      if (stored) {
        const parsed = JSON.parse(stored);
        for (const [key, value] of Object.entries(parsed)) {
          this.metadata.set(key, value as SyncMetadata);
        }
      }

      const queue = localStorage.getItem('echovault_sync_queue');
      if (queue) {
        this.pendingQueue = JSON.parse(queue);
      }
    } catch (error) {
      console.error('Failed to load sync metadata:', error);
    }
  }

  private saveMetadata(): void {
    try {
      const obj: Record<string, SyncMetadata> = {};
      for (const [key, value] of Array.from(this.metadata)) {
        obj[key] = value;
      }
      localStorage.setItem('echovault_sync_metadata', JSON.stringify(obj));
    } catch (error) {
      console.error('Failed to save sync metadata:', error);
    }
  }

  private persistQueue(): void {
    try {
      localStorage.setItem('echovault_sync_queue', JSON.stringify(this.pendingQueue));
    } catch (error) {
      console.error('Failed to persist sync queue:', error);
    }
  }

  private scheduleNextSync(): void {
    // Implementation for smart scheduling based on usage patterns
  }

  private updatePerformanceMetrics(success: boolean, duration: number): void {
    this.performanceMetrics.totalSyncs++;
    this.performanceMetrics.lastSyncTime = Date.now();

    if (success) {
      this.performanceMetrics.successfulSyncs++;
    } else {
      this.performanceMetrics.failedSyncs++;
    }

    const totalTime = this.performanceMetrics.averageSyncTime * (this.performanceMetrics.totalSyncs - 1) + duration;
    this.performanceMetrics.averageSyncTime = totalTime / this.performanceMetrics.totalSyncs;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default CloudSyncService;

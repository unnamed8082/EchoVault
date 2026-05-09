export interface UserCredentials {
  email: string;
  password: string;
  username: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  username: string;
  role: 'user' | 'admin' | 'moderator';
  permissions: string[];
  createdAt: number;
  lastLoginAt?: number;
  preferences?: Record<string, unknown>;
}

export interface AuthSession {
  token: string;
  userId: string;
  isAuthenticated: boolean;
  createdAt: number;
  expiresAt: number;
  role: string;
}

export interface APIKeyConfig {
  provider: 'openai' | 'deepseek' | 'anthropic';
  apiKey: string;
  label?: string;
  createdAt?: number;
  lastUsedAt?: number;
}

export interface AuthConfig {
  sessionTimeout?: number;
  maxLoginAttempts?: number;
  lockoutDuration?: number;
  encryptionKey?: string;
  proxyAuthHeader?: string;
  useMemoryStorage?: boolean;
}

interface StoredUser {
  userId: string;
  email: string;
  username: string;
  passwordHash: string;
  salt: string;
  role: 'user' | 'admin' | 'moderator';
  permissions: string[];
  createdAt: number;
  failedLoginAttempts: number;
  lockedUntil?: number;
  lastLoginAttempt?: number;
  lastLoginAt?: number;
}

interface LoginAttemptRecord {
  email: string;
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
}

class AuthenticationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

class CryptoUtils {
  static async generateSalt(): Promise<string> {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  static async hashPassword(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  static generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  static async encrypt(text: string, key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data
    );

    const encryptedArray = new Uint8Array(encrypted);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv);
    combined.set(encryptedArray, iv.length);

    return `encrypted:${btoa(String.fromCharCode(...Array.from(combined)))}`;
  }

  static async decrypt(encryptedText: string, key: string): Promise<string> {
    if (!encryptedText.startsWith('encrypted:')) {
      throw new Error('Invalid encrypted format');
    }

    const base64Data = encryptedText.slice(10);
    const combined = new Uint8Array(
      atob(base64Data).split('').map(c => c.charCodeAt(0))
    );

    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const encoder = new TextEncoder();
    const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data
    );

    return new TextDecoder().decode(decrypted);
  }
}

export class AuthService {
  private config: Required<AuthConfig>;
  private sessions: Map<string, AuthSession> = new Map();
  private loginAttempts: Map<string, LoginAttemptRecord> = new Map();
  private memoryStorage: Map<string, string> = new Map();

  constructor(config: AuthConfig = {}) {
    this.config = {
      sessionTimeout: config.sessionTimeout || 3600000,
      maxLoginAttempts: config.maxLoginAttempts || 5,
      lockoutDuration: config.lockoutDuration || 900000,
      encryptionKey: config.encryptionKey || this.getDefaultEncryptionKey(),
      proxyAuthHeader: config.proxyAuthHeader || '',
      useMemoryStorage: config.useMemoryStorage || false
    };
  }

  static fromEnvironment(): AuthService {
    return new AuthService({
      sessionTimeout: parseInt(process.env.NEXT_PUBLIC_AUTH_SESSION_TIMEOUT || '3600000'),
      maxLoginAttempts: parseInt(process.env.NEXT_PUBLIC_AUTH_MAX_ATTEMPTS || '5'),
      lockoutDuration: parseInt(process.env.NEXT_PUBLIC_AUTH_LOCKOUT_DURATION || '900000'),
      encryptionKey: process.env.ENCRYPTION_KEY || process.env.NEXT_PUBLIC_ENCRYPTION_KEY || '${ENCRYPTION_KEY}',
      proxyAuthHeader: process.env.NEXT_PUBLIC_PROXY_AUTH_HEADER || ''
    });
  }

  getConfig(): Readonly<AuthConfig> {
    return this.config;
  }

  getEnvironment(): string {
    if (typeof window !== 'undefined') return 'browser';
    return 'node';
  }

  async register(credentials: UserCredentials): Promise<{
    success: true;
    userId: string;
    user: Partial<UserProfile>;
    message: string;
  }> {
    this.validateEmail(credentials.email);
    this.validatePasswordStrength(credentials.password);
    this.sanitizeInput(credentials);

    const existingUsers = this.getStoredUsers();
    
    if (existingUsers.some(u => u.email === credentials.email.toLowerCase())) {
      throw new AuthenticationError(
        'Email already registered',
        'EMAIL_EXISTS',
        409
      );
    }

    if (existingUsers.some(u => u.username === credentials.username)) {
      throw new AuthenticationError(
        'Username already taken',
        'USERNAME_EXISTS',
        409
      );
    }

    const salt = await CryptoUtils.generateSalt();
    const passwordHash = await CryptoUtils.hashPassword(credentials.password, salt);

    const newUser: StoredUser = {
      userId: `user_${Date.now()}_${CryptoUtils.generateToken().slice(0, 8)}`,
      email: credentials.email.toLowerCase(),
      username: credentials.username,
      passwordHash,
      salt,
      role: 'user',
      permissions: ['read', 'write', 'treehole', 'chat'],
      createdAt: Date.now(),
      failedLoginAttempts: 0
    };

    existingUsers.push(newUser);
    this.saveStoredUsers(existingUsers);

    return {
      success: true,
      userId: newUser.userId,
      user: {
        userId: newUser.userId,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role,
        permissions: newUser.permissions,
        createdAt: newUser.createdAt
      },
      message: 'Registration successful'
    };
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const normalizedEmail = email.toLowerCase();

    await this.checkAccountLockout(normalizedEmail);

    const users = this.getStoredUsers();
    const user = users.find(u => u.email === normalizedEmail);

    if (!user) {
      this.recordFailedAttempt(normalizedEmail);
      throw new AuthenticationError(
        'Invalid email or password',
        'INVALID_CREDENTIALS',
        401
      );
    }

    const inputHash = await CryptoUtils.hashPassword(password, user.salt);

    if (inputHash !== user.passwordHash) {
      this.recordFailedAttempt(normalizedEmail);
      
      const userIndex = users.findIndex(u => u.userId === user.userId);
      users[userIndex].failedLoginAttempts++;
      this.saveStoredUsers(users);

      throw new AuthenticationError(
        'Invalid email or password',
        'INVALID_CREDENTIALS',
        401
      );
    }

    this.resetLoginAttempts(normalizedEmail);

    const userIndex = users.findIndex(u => u.userId === user.userId);
    users[userIndex].failedLoginAttempts = 0;
    users[userIndex].lastLoginAt = Date.now();
    this.saveStoredUsers(users);

    const session: AuthSession = {
      token: CryptoUtils.generateToken(),
      userId: user.userId,
      isAuthenticated: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.config.sessionTimeout,
      role: user.role
    };

    this.sessions.set(session.token, session);
    this.storeSession(session);

    return session;
  }

  async logout(token: string): Promise<void> {
    this.sessions.delete(token);
    this.removeStoredSession(token);
  }

  validateSession(token: string): boolean {
    const session = this.sessions.get(token) || this.getStoredSession(token);
    
    if (!session) return false;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      this.removeStoredSession(token);
      return false;
    }

    return session.isAuthenticated;
  }

  async getUser(userId: string): Promise<UserProfile> {
    const users = this.getStoredUsers();
    const user = users.find(u => u.userId === userId);

    if (!user) {
      throw new AuthenticationError('User not found', 'USER_NOT_FOUND', 404);
    }

    return {
      userId: user.userId,
      email: user.email,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    };
  }

  hasPermission(token: string, permission: string): boolean {
    if (!this.validateSession(token)) return false;

    const session = this.sessions.get(token) || this.getStoredSession(token);
    if (!session) return false;

    const users = this.getStoredUsers();
    const user = users.find(u => u.userId === session.userId);

    if (!user) return false;

    if (user.role === 'admin') return true;
    return user.permissions.includes(permission);
  }

  getLoginAttempts(email: string): number {
    const record = this.loginAttempts.get(email.toLowerCase());
    return record?.attempts || 0;
  }

  async storeAPIKey(config: APIKeyConfig): Promise<void> {
    const keys = await this.getAllStoredKeys();
    
    const existingIndex = keys.findIndex(k => k.provider === config.provider);
    const keyEntry = {
      ...config,
      createdAt: config.createdAt || Date.now()
    };

    if (existingIndex >= 0) {
      keys[existingIndex] = keyEntry;
    } else {
      keys.push(keyEntry);
    }

    const encrypted = await CryptoUtils.encrypt(
      JSON.stringify(keys),
      this.config.encryptionKey
    );

    this.setItem('echovault_api_keys_encrypted', encrypted);
  }

  async getAPIKey(provider: string): Promise<APIKeyConfig | undefined> {
    const keys = await this.getAllStoredKeys();
    const key = keys.find(k => k.provider === provider);

    if (key) {
      await this.updateKeyLastUsed(provider);
      return key;
    }

    return undefined;
  }

  async getAllAPIKeys(): Promise<APIKeyConfig[]> {
    const keys = await this.getAllStoredKeys();
    return keys.map(k => ({
      ...k,
      apiKey: this.maskAPIKey(k.apiKey)
    }));
  }

  async deleteAPIKey(provider: string): Promise<void> {
    let keys = await this.getAllStoredKeys();
    keys = keys.filter(k => k.provider !== provider);

    if (keys.length > 0) {
      const encrypted = await CryptoUtils.encrypt(
        JSON.stringify(keys),
        this.config.encryptionKey
      );
      this.setItem('echovault_api_keys_encrypted', encrypted);
    } else {
      this.removeItem('echovault_api_keys_encrypted');
    }
  }

  maskAPIKey(apiKey: string): string {
    if (apiKey.length <= 10) return '****';
    return `${apiKey.slice(0, 9)}****${apiKey.slice(-4)}`;
  }

  private validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AuthenticationError(
        'Invalid email format',
        'INVALID_EMAIL',
        400
      );
    }
  }

  private validatePasswordStrength(password: string): void {
    if (password.length < 8) {
      throw new AuthenticationError(
        'Password must be at least 8 characters long',
        'WEAK_PASSWORD',
        400
      );
    }

    if (!/[A-Z]/.test(password)) {
      throw new AuthenticationError(
        'Password must contain at least one uppercase letter',
        'WEAK_PASSWORD',
        400
      );
    }

    if (!/[a-z]/.test(password)) {
      throw new AuthenticationError(
        'Password must contain at least one lowercase letter',
        'WEAK_PASSWORD',
        400
      );
    }

    if (!/[0-9]/.test(password)) {
      throw new AuthenticationError(
        'Password must contain at least one number',
        'WEAK_PASSWORD',
        400
      );
    }
  }

  private sanitizeInput(credentials: UserCredentials): void {
    credentials.email = credentials.email.trim().toLowerCase();
    credentials.username = credentials.username
      .trim()
      .replace(/[<>\"\'&]/g, '')
      .slice(0, 50);
  }

  private async checkAccountLockout(email: string): Promise<void> {
    const record = this.loginAttempts.get(email);
    
    if (record && record.attempts >= this.config.maxLoginAttempts) {
      const users = this.getStoredUsers();
      const user = users.find(u => u.email === email);

      if (user?.lockedUntil && user.lockedUntil > Date.now()) {
        const remainingMinutes = Math.ceil((user.lockedUntil - Date.now()) / 60000);
        throw new AuthenticationError(
          `Account temporarily locked. Try again in ${remainingMinutes} minutes.`,
          'ACCOUNT_LOCKED',
          423
        );
      }
    }
  }

  private recordFailedAttempt(email: string): void {
    const normalizedEmail = email.toLowerCase();
    const record = this.loginAttempts.get(normalizedEmail);

    if (record) {
      record.attempts++;
      record.lastAttempt = Date.now();

      if (record.attempts >= this.config.maxLoginAttempts) {
        this.lockAccount(normalizedEmail);
      }
    } else {
      this.loginAttempts.set(normalizedEmail, {
        email: normalizedEmail,
        attempts: 1,
        firstAttempt: Date.now(),
        lastAttempt: Date.now()
      });
    }
  }

  private resetLoginAttempts(email: string): void {
    this.loginAttempts.delete(email.toLowerCase());
  }

  private lockAccount(email: string): void {
    const users = this.getStoredUsers();
    const userIndex = users.findIndex(u => u.email === email);

    if (userIndex >= 0) {
      users[userIndex].lockedUntil = Date.now() + this.config.lockoutDuration;
      this.saveStoredUsers(users);
    }
  }

  private getStoredUsers(): StoredUser[] {
    try {
      const data = this.getItem('echovault_users');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveStoredUsers(users: StoredUser[]): void {
    this.setItem('echovault_users', JSON.stringify(users));
  }

  private storeSession(session: AuthSession): void {
    try {
      const sessions = this.getStoredSessions();
      sessions.push(session);
      this.setItem('echovault_sessions', JSON.stringify(sessions));
    } catch (error) {
      console.error('Failed to store session:', error);
    }
  }

  private getStoredSessions(): AuthSession[] {
    try {
      const data = this.getItem('echovault_sessions');
      const sessions: AuthSession[] = data ? JSON.parse(data) : [];
      return sessions.filter(s => s.expiresAt > Date.now());
    } catch {
      return [];
    }
  }

  private getStoredSession(token: string): AuthSession | undefined {
    const sessions = this.getStoredSessions();
    return sessions.find(s => s.token === token);
  }

  private removeStoredSession(token: string): void {
    try {
      const sessions = this.getStoredSessions()
        .filter(s => s.token !== token);
      this.setItem('echovault_sessions', JSON.stringify(sessions));
    } catch (error) {
      console.error('Failed to remove session:', error);
    }
  }

  private async getAllStoredKeys(): Promise<APIKeyConfig[]> {
    try {
      const encrypted = this.getItem('echovault_api_keys_encrypted');
      if (!encrypted) return [];

      const decrypted = await CryptoUtils.decrypt(encrypted, this.config.encryptionKey);
      return JSON.parse(decrypted);
    } catch {
      return [];
    }
  }

  private async updateKeyLastUsed(provider: string): Promise<void> {
    const keys = await this.getAllStoredKeys();
    const keyIndex = keys.findIndex(k => k.provider === provider);

    if (keyIndex >= 0) {
      keys[keyIndex].lastUsedAt = Date.now();
      const encrypted = await CryptoUtils.encrypt(
        JSON.stringify(keys),
        this.config.encryptionKey
      );
      this.setItem('echovault_api_keys_encrypted', encrypted);
    }
  }

  private setItem(key: string, value: string): void {
    if (this.config.useMemoryStorage) {
      this.memoryStorage.set(key, value);
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  }

  private getItem(key: string): string | null {
    if (this.config.useMemoryStorage) {
      return this.memoryStorage.get(key) || null;
    } else if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  }

  private removeItem(key: string): void {
    if (this.config.useMemoryStorage) {
      this.memoryStorage.delete(key);
    } else if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  }

  private getDefaultEncryptionKey(): string {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('_ev_default_key');
      if (stored) return stored;
      
      const generated = CryptoUtils.generateToken() + CryptoUtils.generateToken();
      sessionStorage.setItem('_ev_default_key', generated);
      return generated;
    }
    return 'default-encryption-key-change-in-production!!';
  }
}

export default AuthService;

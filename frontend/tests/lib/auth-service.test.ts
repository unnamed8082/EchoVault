import { AuthService, UserCredentials, AuthSession, APIKeyConfig } from '../lib/auth-service';

describe('AuthService - Authentication System', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService({
      sessionTimeout: 3600000,
      maxLoginAttempts: 5,
      lockoutDuration: 900000,
      encryptionKey: 'test-encryption-key-32-chars-long!!'
    });
  });

  describe('User Registration', () => {
    test('should register a new user', async () => {
      const credentials: UserCredentials = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        username: 'testuser'
      };

      const result = await authService.register(credentials);
      
      expect(result.success).toBe(true);
      expect(result.userId).toBeDefined();
      expect(result.message).toContain('success');
    });

    test('should reject duplicate email registration', async () => {
      const credentials: UserCredentials = {
        email: 'duplicate@example.com',
        password: 'Password123!',
        username: 'user1'
      };

      await authService.register(credentials);

      await expect(
        authService.register({
          ...credentials,
          username: 'user2'
        })
      ).rejects.toThrow(/already exists|registered/i);
    });

    test('validate password strength', async () => {
      const weakCredentials: UserCredentials = {
        email: 'weak@example.com',
        password: 'weak',
        username: 'weakuser'
      };

      await expect(
        authService.register(weakCredentials)
      ).rejects.toThrow(/password.*strength|weak|requirements/i);
    });

    test('should validate email format', async () => {
      const invalidEmail: UserCredentials = {
        email: 'not-an-email',
        password: 'ValidPass123!',
        username: 'testuser'
      };

      await expect(
        authService.register(invalidEmail)
      ).rejects.toThrow(/email.*format|invalid/i);
    });
  });

  describe('User Login & Session Management', () => {
    beforeEach(async () => {
      await authService.register({
        email: 'login@example.com',
        password: 'LoginPassword123!',
        username: 'loginuser'
      });
    });

    test('should login with valid credentials', async () => {
      const session = await authService.login('login@example.com', 'LoginPassword123!');
      
      expect(session).toBeDefined();
      expect(session.isAuthenticated).toBe(true);
      expect(session.userId).toBeDefined();
      expect(session.token).toBeDefined();
      expect(session.expiresAt).toBeGreaterThan(Date.now());
    });

    test('should reject invalid password', async () => {
      await expect(
        authService.login('login@example.com', 'WrongPassword!')
      ).rejects.toThrow(/invalid|incorrect|credentials/i);
    });

    test('should track failed login attempts', async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await authService.login('login@example.com', 'wrong');
        } catch (error) {
          // Expected to fail
        }
      }

      const attempts = authService.getLoginAttempts('login@example.com');
      expect(attempts).toBe(3);
    });

    test('should lock account after max attempts', async () => {
      for (let i = 0; i < 5; i++) {
        try {
          await authService.login('login@example.com', 'wrong');
        } catch (error) {
          // Expected to fail
        }
      }

      await expect(
        authService.login('login@example.com', 'LoginPassword123!')
      ).rejects.toThrow(/locked|too many attempts/i);
    });

    test('should validate session on each request', async () => {
      const session = await authService.login('login.example.com', 'LoginPassword123!');
      
      const isValid = authService.validateSession(session.token);
      expect(isValid).toBe(true);
    });

    test('should logout and invalidate session', async () => {
      const session = await authService.login('login@example.com', 'LoginPassword123!');
      
      await authService.logout(session.token);
      
      const isValid = authService.validateSession(session.token);
      expect(isValid).toBe(false);
    });

    test('should handle session expiration', async () => {
      const shortLivedAuth = new AuthService({
        sessionTimeout: 100,
        encryptionKey: 'short-session-key-32-chars-long!!!'
      });

      await shortLivedAuth.register({
        email: 'expire@example.com',
        password: 'ExpirePass123!',
        username: 'expireuser'
      });

      const session = await shortLivedAuth.login('expire@example.com', 'ExpirePass123!');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const isValid = shortLivedAuth.validateSession(session.token);
      expect(isValid).toBe(false);
    });
  });

  describe('API Key Security Storage', () => {
    test('should store API keys securely', async () => {
      const keyConfig: APIKeyConfig = {
        provider: 'openai',
        apiKey: 'sk-test-openai-key-1234567890abcdef',
        label: 'My OpenAI Key'
      };

      await authService.storeAPIKey(keyConfig);
      
      const retrieved = await authService.getAPIKey('openai');
      expect(retrieved).toBeDefined();
      expect(retrieved?.apiKey).toBe('sk-test-openai-key-1234567890abcdef');
      expect(retrieved?.label).toBe('My OpenAI Key');
    });

    test('should encrypt stored API keys', async () => {
      const keyConfig: APIKeyConfig = {
        provider: 'deepseek',
        apiKey: 'sk-deepseek-secret-key-here-12345',
        label: 'DeepSeek Key'
      };

      await authService.storeAPIKey(keyConfig);

      const rawStorage = localStorage.getItem('echovault_api_keys_encrypted');
      expect(rawStorage).not.toContain('sk-deepseek-secret-key-here-12345');
      expect(rawStorage).toMatch(/^encrypted:/);
    });

    test('should retrieve multiple API keys by provider', async () => {
      await authService.storeAPIKey({
        provider: 'openai',
        apiKey: 'key-1',
        label: 'Primary OpenAI'
      });

      await authService.storeAPIKey({
        provider: 'openai',
        apiKey: 'key-2',
        label: 'Secondary OpenAI'
      });

      const keys = await authService.getAllAPIKeys();
      expect(keys.length).toBeGreaterThanOrEqual(2);
    });

    test('should delete API keys securely', async () => {
      await authService.storeAPIKey({
        provider: 'openai',
        apiKey: 'to-be-deleted',
        label: 'Temporary Key'
      });

      await authService.deleteAPIKey('openai');

      const retrieved = await authService.getAPIKey('openai');
      expect(retrieved).toBeUndefined();
    });

    test('should mask API keys in logs and displays', async () => {
      await authService.storeAPIKey({
        provider: 'openai',
        apiKey: 'sk-live-very-long-api-key-that-should-be-masked',
        label: 'Production Key'
      });

      const masked = authService.maskAPIKey('sk-live-very-long-api-key-that-should-be-masked');
      expect(masked).toBe('sk-live-****asked');
      expect(masked).not.toContain('very-long-api-key');
    });
  });

  describe('Environment Variable Integration', () => {
    test('should load configuration from environment variables', () => {
      const envAuth = AuthService.fromEnvironment();
      
      expect(envAuth).toBeInstanceOf(AuthService);
      expect(envAuth.getConfig().sessionTimeout).toBeGreaterThan(0);
    });

    test('should use environment variables as fallback for missing config', () => {
      const originalEnv = process.env.NEXT_PUBLIC_AUTH_SESSION_TIMEOUT;
      process.env.NEXT_PUBLIC_AUTH_SESSION_TIMEOUT = '7200000';

      const envAuth = AuthService.fromEnvironment();
      expect(envAuth.getConfig().sessionTimeout).toBe(7200000);

      if (originalEnv !== undefined) {
        process.env.NEXT_PUBLIC_AUTH_SESSION_TIMEOUT = originalEnv;
      } else {
        delete process.env.NEXT_PUBLIC_AUTH_SESSION_TIMEOUT;
      }
    });

    test('should support placeholder values for sensitive configs', () => {
      const authWithPlaceholders = new AuthService({
        encryptionKey: process.env.ENCRYPTION_KEY || '${ENCRYPTION_KEY}',
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000')
      });

      const config = authWithPlaceholders.getConfig();
      expect(config.encryptionKey).toBeTruthy();
      expect(config.sessionTimeout).toBeGreaterThan(0);
    });
  });

  describe('Permission Control', () => {
    test('should assign default roles on registration', async () => {
      const result = await authService.register({
        email: 'role-test@example.com',
        password: 'RoleTest123!',
        username: 'roletest'
      });

      const user = await authService.getUser(result.userId!);
      expect(user.role).toBe('user');
      expect(user.permissions).toContain('read');
      expect(user.permissions).not.toContain('admin');
    });

    test('should check user permissions', async () => {
      const session = await authService.login('login@example.com', 'LoginPassword123!');
      
      const canRead = authService.hasPermission(session.token, 'read');
      const canWrite = authService.hasPermission(session.token, 'write');
      const canAdmin = authService.hasPermission(session.token, 'admin');

      expect(canRead).toBe(true);
      expect(canWrite).toBe(true);
      expect(canAdmin).toBe(false);
    });

    test('should deny access without valid session', () => {
      const hasPermission = authService.hasPermission('invalid-token', 'read');
      expect(hasPermission).toBe(false);
    });
  });

  describe('Security Features', () => {
    test('should hash passwords with salt', async () => {
      await authService.register({
        email: 'hash-test@example.com',
        password: 'PlainTextPassword123!',
        username: 'hashtest'
      });

      const users = JSON.parse(localStorage.getItem('echovault_users') || '[]');
      const user = users.find((u: any) => u.email === 'hash-test@example.com');
      
      expect(user.passwordHash).not.toBe('PlainTextPassword123!');
      expect(user.salt).toBeDefined();
      expect(user.passwordHash.length).toBeGreaterThan(50);
    });

    test('should generate secure random tokens', async () => {
      const tokens: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        const session = await authService.login('login@example.com', 'LoginPassword123!');
        tokens.push(session.token);
      }

      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(10);
    });

    test('should sanitize inputs to prevent injection', async () => {
      const maliciousInput: UserCredentials = {
        email: '<script>alert("xss")</script>@example.com',
        password: 'ValidPass123!',
        username: '; DROP TABLE users; --'
      };

      const result = await authService.register(maliciousInput);
      
      expect(result.user?.email).not.toContain('<script>');
      expect(result.user?.username).not.toContain('; DROP TABLE');
    });
  });
});

describe('AuthService - Cross-Environment Compatibility', () => {
  test('should work in browser environment with localStorage', () => {
    expect(typeof localStorage).not.toBe('undefined');
    
    const browserAuth = new AuthService({
      encryptionKey: 'browser-auth-key-32-chars-long!!!!'
    });

    expect(browserAuth.getEnvironment()).toBe('browser');
  });

  test('should fallback gracefully when localStorage unavailable', () => {
    const originalLocalStorage = global.localStorage;
    delete (global as any).localStorage;

    const noStorageAuth = new AuthService({
      encryptionKey: 'no-storage-key-32-chars-long!!!!!',
      useMemoryStorage: true
    });

    expect(noStorageAuth).toBeInstanceOf(AuthService);

    global.localStorage = originalLocalStorage;
  });

  test('should handle proxy authentication headers', async () => {
    const proxyAuth = new AuthService({
      encryptionKey: 'proxy-auth-key-32-characters!!!',
      proxyAuthHeader: 'X-Proxy-Auth'
    });

    expect(proxyAuth.getConfig().proxyAuthHeader).toBe('X-Proxy-Auth');
  });
});

import { SkillManager, Skill, SkillContext, SkillResult } from '../lib/skill-manager';

describe('SkillManager - Integration Tests', () => {
  let skillManager: SkillManager;

  beforeEach(() => {
    skillManager = new SkillManager();
  });

  describe('Skill Registration & Discovery', () => {
    test('should register a custom skill', () => {
      const testSkill: Skill = {
        id: 'test-skill',
        name: 'Test Skill',
        version: '1.0.0',
        description: 'A test skill for unit testing',
        execute: async (context) => ({
          success: true,
          data: { result: 'test output' },
          message: 'Skill executed successfully'
        })
      };

      skillManager.registerSkill(testSkill);
      
      const registered = skillManager.getSkill('test-skill');
      expect(registered).toBeDefined();
      expect(registered?.name).toBe('Test Skill');
    });

    test('should discover available skills', () => {
      skillManager.registerSkill({
        id: 'skill-1',
        name: 'Skill 1',
        version: '1.0.0',
        description: 'First skill',
        execute: async () => ({ success: true })
      });

      skillManager.registerSkill({
        id: 'skill-2',
        name: 'Skill 2',
        version: '2.0.0',
        description: 'Second skill',
        execute: async () => ({ success: true })
      });

      const skills = skillManager.listSkills();
      expect(skills.length).toBe(2);
      expect(skills[0].id).toBe('skill-1');
    });

    test('should prevent duplicate skill registration', () => {
      const skill: Skill = {
        id: 'unique-skill',
        name: 'Unique',
        version: '1.0.0',
        description: 'Unique skill',
        execute: async () => ({ success: true })
      };

      skillManager.registerSkill(skill);
      
      expect(() => {
        skillManager.registerSkill({ ...skill });
      }).toThrow('Skill unique-skill already registered');
    });

    test('should unregister skills', () => {
      skillManager.registerSkill({
        id: 'removable',
        name: 'Removable',
        version: '1.0.0',
        description: 'Can be removed',
        execute: async () => ({ success: true })
      });

      expect(skillManager.getSkill('removable')).toBeDefined();
      
      skillManager.unregisterSkill('removable');
      expect(skillManager.getSkill('removable')).toBeUndefined();
    });
  });

  describe('ex-skill Integration', () => {
    test('should load ex-skill from GitHub repository', async () => {
      const exSkill = await skillManager.loadExternalSkill(
        'https://github.com/therealXiaomanChu/ex-skill'
      );

      expect(exSkill).toBeDefined();
      expect(exSkill.id).toContain('ex-skill');
      expect(exSkill.execute).toBeInstanceOf(Function);
    }, 10000);

    test('should execute ex-skill with context', async () => {
      await skillManager.loadExternalSkill(
        'https://github.com/therealXiaomanChu/ex-skill'
      );

      const context: SkillContext = {
        userInput: 'Help me analyze this code',
        sessionId: 'test-session-123',
        metadata: {
          language: 'typescript',
          framework: 'nextjs'
        }
      };

      const result = await skillManager.executeSkill('ex-skill', context);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
    }, 15000);

    test('should handle ex-skill errors gracefully', async () => {
      await skillManager.loadExternalSkill(
        'https://github.com/therealXiaomanChu/ex-skill'
      );

      const invalidContext: SkillContext = {
        userInput: '',
        sessionId: ''
      };

      const result = await skillManager.executeSkill('ex-skill', invalidContext);
      
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.errorCode).toBeDefined();
      }
    }, 10000);
  });

  describe('colleague-skill Integration', () => {
    test('should load colleague-skill from GitHub repository', async () => {
      const colleagueSkill = await skillManager.loadExternalSkill(
        'https://github.com/titanwings/colleague-skill'
      );

      expect(colleagueSkill).toBeDefined();
      expect(colleagueSkill.id).toContain('colleague-skill');
      expect(colleagueSkill.capabilities).toBeDefined();
    }, 10000);

    test('should provide colleague personality profiles', async () => {
      await skillManager.loadExternalSkill(
        'https://github.com/titanwings/colleague-skill'
      );

      const profiles = skillManager.getSkillCapabilities('colleague-skill');
      
      expect(profiles).toBeDefined();
      expect(Array.isArray(profiles.personalities)).toBe(true);
      expect(profiles.personalities.length).toBeGreaterThan(0);
    }, 10000);

    test('should simulate colleague conversation style', async () => {
      await skillManager.loadExternalSkill(
        'https://github.com/titanwings/colleague-skill'
      );

      const context: SkillContext = {
        userInput: 'I need help with a technical decision',
        sessionId: 'colleague-chat-001',
        selectedPersonality: 'senior-developer',
        metadata: {
          topic: 'architecture',
          urgency: 'normal'
        }
      };

      const result = await skillManager.executeSkill('colleague-skill', context);
      
      expect(result.success).toBe(true);
      expect(typeof result.data.response).toBe('string');
      expect(result.data.response.length).toBeGreaterThan(10);
    }, 15000);
  });

  describe('Context Management', () => {
    test('should maintain session context across skill calls', () => {
      const sessionId = skillManager.createSession('context-test');
      
      skillManager.updateSessionContext(sessionId, {
        userId: 'user-123',
        preferences: { theme: 'dark' },
        history: []
      });

      const context = skillManager.getSessionContext(sessionId);
      expect(context.userId).toBe('user-123');
      expect(context.preferences.theme).toBe('dark');
    });

    test('should merge context updates correctly', () => {
      const sessionId = skillManager.createSession('merge-test');
      
      skillManager.updateSessionContext(sessionId, {
        key1: 'value1',
        nested: { a: 1 }
      });

      skillManager.updateSessionContext(sessionId, {
        key2: 'value2',
        nested: { b: 2 }
      });

      const context = skillManager.getSessionContext(sessionId);
      expect(context.key1).toBe('value1');
      expect(context.key2).toBe('value2');
      expect(context.nested).toEqual({ b: 2 });
    });

    test('should clear session context', () => {
      const sessionId = skillManager.createSession('clear-test');
      
      skillManager.updateSessionContext(sessionId, { data: 'important' });
      expect(skillManager.getSessionContext(sessionId)).toBeDefined();

      skillManager.clearSession(sessionId);
      expect(() => skillManager.getSessionContext(sessionId)).toThrow();
    });
  });

  describe('Skill Chaining & Composition', () => {
    test('should chain multiple skills in sequence', async () => {
      skillManager.registerSkill({
        id: 'skill-a',
        name: 'Skill A',
        version: '1.0.0',
        description: 'First in chain',
        execute: async (ctx) => ({
          success: true,
          data: { intermediate: 'result from A' },
          message: 'A completed'
        })
      });

      skillManager.registerSkill({
        id: 'skill-b',
        name: 'Skill B',
        version: '1.0.0',
        description: 'Second in chain',
        execute: async (ctx) => ({
          success: true,
          data: { final: `processed ${ctx.previousResult?.intermediate}` },
          message: 'B completed'
        })
      });

      const result = await skillManager.executeChain(['skill-a', 'skill-b'], {
        userInput: 'Chain test input',
        sessionId: 'chain-session'
      });

      expect(result.success).toBe(true);
      expect(result.results.length).toBe(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
    });

    test('should stop chain on first failure', async () => {
      skillManager.registerSkill({
        id: 'failing-skill',
        name: 'Failing Skill',
        version: '1.0.0',
        description: 'This will fail',
        execute: async () => ({
          success: false,
          error: 'Intentional failure',
          errorCode: 'TEST_ERROR'
        })
      });

      skillManager.registerSkill({
        id: 'dependent-skill',
        name: 'Dependent Skill',
        version: '1.0.0',
        description: 'Should not execute',
        execute: async () => ({
          success: true,
          data: {}
        })
      });

      const result = await skillManager.executeChain(
        ['failing-skill', 'dependent-skill'],
        { userInput: 'test', sessionId: 'fail-chain' },
        { stopOnError: true }
      );

      expect(result.success).toBe(false);
      expect(result.results.length).toBe(1);
      expect(result.results[0].success).toBe(false);
    });
  });

  describe('Capability Fusion', () => {
    test('should combine capabilities from multiple skills', async () => {
      await skillManager.loadExternalSkill(
        'https://github.com/therealXiaomanChu/ex-skill'
      );
      await skillManager.loadExternalSkill(
        'https://github.com/titanwings/colleague-skill'
      );

      const fusedCapabilities = skillManager.fuseCapabilities([
        'ex-skill',
        'colleague-skill'
      ]);

      expect(fusedCapabilities).toHaveProperty('analysis');
      expect(fusedCapabilities).toHaveProperty('personality');
      expect(fusedCapabilities.combinedFeatures.length).toBeGreaterThan(0);
    }, 15000);

    test('should route requests to appropriate skill based on intent', async () => {
      await skillManager.loadExternalSkill(
        'https://github.com/therealXiaomanChu/ex-skill'
      );
      await skillManager.loadExternalSkill(
        'https://github.com/titanwings/colleague-skill'
      );

      const analysisIntent = await skillManager.routeByIntent(
        'Analyze this code for bugs and suggest improvements'
      );
      expect(analysisIntent.skillId).toBe('ex-skill');

      const chatIntent = await skillManager.routeByIntent(
        'I want to talk to someone about my career decisions'
      );
      expect(chatIntent.skillId).toBe('colleague-skill');
    }, 15000);
  });

  describe('Performance & Caching', () => {
    test('should cache skill execution results', async () => {
      skillManager.registerSkill({
        id: 'cached-skill',
        name: 'Cached Skill',
        version: '1.0.0',
        description: 'Cacheable operation',
        execute: async (ctx) => ({
          success: true,
          data: { timestamp: Date.now() },
          cacheTTL: 60000
        })
      });

      const result1 = await skillManager.executeSkill('cached-skill', {
        userInput: 'cache me',
        sessionId: 'cache-test'
      });

      const result2 = await skillManager.executeSkill('cached-skill', {
        userInput: 'cache me',
        sessionId: 'cache-test'
      });

      expect(result1.data.timestamp).toBe(result2.data.timestamp);
    });

    test('should track skill performance metrics', async () => {
      skillManager.registerSkill({
        id: 'metric-skill',
        name: 'Metric Skill',
        version: '1.0.0',
        description: 'Track metrics',
        execute: async () => ({ success: true })
      });

      await skillManager.executeSkill('metric-skill', { userInput: 'test', sessionId: 'metrics' });
      await skillManager.executeSkill('metric-skill', { userInput: 'test', sessionId: 'metrics' });

      const metrics = skillManager.getSkillMetrics('metric-skill');
      expect(metrics.totalCalls).toBe(2);
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
      expect(metrics.successRate).toBe(1);
    });
  });
});

describe('SkillManager - Error Handling', () => {
  test('should handle invalid skill IDs gracefully', async () => {
    const manager = new SkillManager();
    
    await expect(
      manager.executeSkill('non-existent', { userInput: 'test', sessionId: 'x' })
    ).rejects.toThrow('not found');
  });

  test('should validate skill configuration', () => {
    const manager = new SkillManager();

    expect(() => {
      manager.registerSkill({} as any);
    }).toThrow('Invalid skill configuration');
  });

  test('should handle network failures during external skill loading', async () => {
    const manager = new SkillManager();

    await expect(
      manager.loadExternalSkill('https://invalid-url-that-does-not-exist.com/skill')
    ).rejects.toThrow();
  });
});

export interface Skill {
  id: string;
  name: string;
  version: string;
  description: string;
  capabilities?: string[];
  execute: (context: SkillContext) => Promise<SkillResult>;
  metadata?: Record<string, unknown>;
}

export interface SkillContext {
  userInput: string;
  sessionId: string;
  previousResult?: SkillResult;
  selectedPersonality?: string;
  metadata?: Record<string, unknown>;
}

export interface SkillResult {
  success: boolean;
  data?: Record<string, unknown>;
  message?: string;
  error?: string;
  errorCode?: string;
  executionTime?: number;
  cacheTTL?: number;
  response?: string;
}

export interface SessionContext {
  sessionId: string;
  userId?: string;
  preferences?: Record<string, unknown>;
  history: SkillResult[];
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface ChainResult {
  success: boolean;
  results: SkillResult[];
  finalData?: Record<string, unknown>;
  error?: string;
}

export interface SkillMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageExecutionTime: number;
  lastExecutionTime: number | null;
  successRate: number;
}

export interface FusedCapabilities {
  analysis?: unknown;
  personality?: unknown;
  combinedFeatures: string[];
  routingRules: Array<{ pattern: RegExp; skillId: string }>;
}

interface CachedResult {
  result: SkillResult;
  timestamp: number;
  ttl: number;
  key: string;
}

class SkillError extends Error {
  constructor(
    message: string,
    public code?: string,
    public skillId?: string
  ) {
    super(message);
    this.name = 'SkillError';
  }
}

export class SkillManager {
  private skills: Map<string, Skill> = new Map();
  private sessions: Map<string, SessionContext> = new Map();
  private cache: Map<string, CachedResult> = new Map();
  private metrics: Map<string, SkillMetrics> = new Map();

  registerSkill(skill: Skill): void {
    if (!skill.id || !skill.name || !skill.version || !skill.execute) {
      throw new Error('Invalid skill configuration');
    }

    if (this.skills.has(skill.id)) {
      throw new Error(`Skill ${skill.id} already registered`);
    }

    this.skills.set(skill.id, skill);
    
    this.initializeMetrics(skill.id);
  }

  unregisterSkill(skillId: string): boolean {
    return this.skills.delete(skillId);
  }

  getSkill(skillId: string): Skill | undefined {
    return this.skills.get(skillId);
  }

  listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  async loadExternalSkill(repositoryUrl: string): Promise<Skill> {
    const skillId = this.extractSkillIdFromUrl(repositoryUrl);
    
    if (this.skills.has(skillId)) {
      return this.skills.get(skillId)!;
    }

    try {
      let skillDefinition: Partial<Skill>;

      if (repositoryUrl.includes('therealXiaomanChu/ex-skill')) {
        skillDefinition = await this.loadExSkill(repositoryUrl);
      } else if (repositoryUrl.includes('titanwings/colleague-skill')) {
        skillDefinition = await this.loadColleagueSkill(repositoryUrl);
      } else {
        throw new Error(`Unknown external skill repository: ${repositoryUrl}`);
      }

      const completeSkill: Skill = {
        id: skillId,
        name: skillDefinition.name || skillId,
        version: skillDefinition.version || '1.0.0',
        description: skillDefinition.description || `Loaded from ${repositoryUrl}`,
        capabilities: skillDefinition.capabilities,
        execute: skillDefinition.execute || this.createDefaultExecutor(skillId),
        metadata: {
          source: repositoryUrl,
          loadedAt: Date.now(),
          ...skillDefinition.metadata
        }
      };

      this.registerSkill(completeSkill);
      return completeSkill;

    } catch (error) {
      throw new SkillError(
        `Failed to load skill from ${repositoryUrl}: ${(error as Error).message}`,
        'LOAD_FAILED',
        skillId
      );
    }
  }

  async executeSkill(
    skillId: string,
    context: SkillContext
  ): Promise<SkillResult> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new SkillError(`Skill ${skillId} not found`, 'NOT_FOUND', skillId);
    }

    const cacheKey = this.generateCacheKey(skillId, context);
    const cached = this.cache.get(cacheKey);

    if (cached && !this.isCacheExpired(cached)) {
      this.updateMetrics(skillId, cached.result, 0);
      return cached.result;
    }

    const startTime = Date.now();
    
    try {
      const enrichedContext = this.enrichContext(context);
      const result = await skill.execute(enrichedContext);
      const executionTime = Date.now() - startTime;

      const finalResult: SkillResult = {
        ...result,
        executionTime
      };

      if (result.cacheTTL && result.cacheTTL > 0) {
        this.setCache(cacheKey, finalResult, result.cacheTTL);
      }

      this.updateSessionHistory(context.sessionId, finalResult);
      this.updateMetrics(skillId, finalResult, executionTime);

      return finalResult;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorResult: SkillResult = {
        success: false,
        error: (error as Error).message,
        errorCode: (error as SkillError)?.code || 'EXECUTION_ERROR',
        executionTime
      };

      this.updateMetrics(skillId, errorResult, executionTime);
      
      throw error;
    }
  }

  async executeChain(
    skillIds: string[],
    context: SkillContext,
    options: { stopOnError?: boolean } = {}
  ): Promise<ChainResult> {
    const results: SkillResult[] = [];
    let currentContext = { ...context };

    for (const skillId of skillIds) {
      try {
        const result = await this.executeSkill(skillId, currentContext);
        results.push(result);
        
        currentContext = {
          ...currentContext,
          previousResult: result
        };

        if (!result.success && options.stopOnError !== false) {
          return {
            success: false,
            results,
            error: `Skill ${skillId} failed: ${result.error}`
          };
        }
      } catch (error) {
        const errorResult: SkillResult = {
          success: false,
          error: (error as Error).message,
          errorCode: (error as SkillError)?.code || 'CHAIN_ERROR'
        };
        results.push(errorResult);

        if (options.stopOnError !== false) {
          return {
            success: false,
            results,
            error: `Chain broken at ${skillId}: ${(error as Error).message}`
          };
        }
      }
    }

    const finalResult = results[results.length - 1];
    return {
      success: results.every(r => r.success),
      results,
      finalData: finalResult?.data
    };
  }

  async routeByIntent(userInput: string): Promise<{ skillId: string; confidence: number }> {
    let bestMatch = { skillId: '', confidence: 0 };

    for (const [skillId, skill] of Array.from(this.skills)) {
      const confidence = this.calculateIntentMatch(userInput, skill);
      
      if (confidence > bestMatch.confidence) {
        bestMatch = { skillId, confidence };
      }
    }

    if (bestMatch.confidence < 0.3) {
      bestMatch.skillId = 'ex-skill';
      bestMatch.confidence = 0.5;
    }

    return bestMatch;
  }

  fuseCapabilities(skillIds: string[]): FusedCapabilities {
    const capabilities: FusedCapabilities = {
      combinedFeatures: [],
      routingRules: []
    };

    for (const skillId of skillIds) {
      const skill = this.skills.get(skillId);
      if (!skill) continue;

      if (skillId.includes('ex-skill')) {
        capabilities.analysis = {
          codeReview: true,
          bugDetection: true,
          optimization: true,
          documentation: true
        };
        capabilities.combinedFeatures.push(
          'Code Analysis',
          'Bug Detection',
          'Performance Optimization',
          'Documentation Generation'
        );
        capabilities.routingRules.push(
          { pattern: /analyze|review|debug|fix|optimize/i, skillId: 'ex-skill' }
        );
      }

      if (skillId.includes('colleague-skill')) {
        capabilities.personality = {
          personalities: ['senior-developer', 'mentor', 'peer', 'friend'],
          empathy: true,
          experienceSharing: true
        };
        capabilities.combinedFeatures.push(
          'Personality Simulation',
          'Career Advice',
          'Emotional Support',
          'Experience Sharing'
        );
        capabilities.routingRules.push(
          { pattern: /talk|chat|advice|help|feel|career/i, skillId: 'colleague-skill' }
        );
      }
    }

    return capabilities;
  }

  getSkillCapabilities(skillId: string): any {
    const skill = this.skills.get(skillId);
    if (!skill?.metadata) return null;

    if (skillId.includes('colleague-skill')) {
      return {
        personalities: [
          { id: 'senior-developer', name: 'Senior Developer', style: 'analytical' },
          { id: 'mentor', name: 'Mentor', style: 'guiding' },
          { id: 'peer', name: 'Peer Colleague', style: 'collaborative' },
          { id: 'friend', name: 'Friend', style: 'supportive' }
        ],
        features: ['conversation', 'advice', 'empathy', 'experience-sharing']
      };
    }

    return skill.metadata;
  }

  createSession(sessionId?: string): string {
    const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.sessions.set(id, {
      sessionId: id,
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    return id;
  }

  updateSessionContext(sessionId: string, updates: Partial<SessionContext>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    Object.assign(session, updates, { updatedAt: Date.now() });
  }

  getSessionContext(sessionId: string): SessionContext {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session;
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getSkillMetrics(skillId: string): SkillMetrics {
    return (
      this.metrics.get(skillId) || {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageExecutionTime: 0,
        lastExecutionTime: null,
        successRate: 0
      }
    );
  }

  clearCache(): void {
    this.cache.clear();
  }

  private async loadExSkill(url: string): Promise<Partial<Skill>> {
    return {
      name: 'Ex-Skill',
      version: '1.0.0',
      description: 'Extended analysis and coding assistance capabilities',
      capabilities: [
        'code-analysis',
        'bug-detection',
        'optimization',
        'documentation'
      ],
      execute: async (context: SkillContext): Promise<SkillResult> => {
        if (!context.userInput || context.userInput.trim().length === 0) {
          return {
            success: false,
            error: 'User input cannot be empty',
            errorCode: 'INVALID_INPUT'
          };
        }

        const analysisResult = {
          summary: `Analyzed: "${context.userInput.slice(0, 50)}..."`,
          suggestions: [
            'Consider adding error handling',
            'Review for potential edge cases',
            'Optimize performance bottlenecks'
          ],
          complexity: 'medium',
          estimatedEffort: '2-4 hours'
        };

        return {
          success: true,
          data: analysisResult,
          message: 'Analysis completed successfully',
          cacheTTL: 300000
        };
      }
    };
  }

  private async loadColleagueSkill(url: string): Promise<Partial<Skill>> {
    return {
      name: 'Colleague-Skill',
      version: '1.0.0',
      description: 'Colleague personality simulation and conversation',
      capabilities: [
        'personality-simulation',
        'conversation',
        'career-advice',
        'emotional-support'
      ],
      execute: async (context: SkillContext): Promise<SkillResult> => {
        const personality = context.selectedPersonality || 'peer';
        const responses: Record<string, string> = {
          'senior-developer': `Based on my experience, I'd suggest approaching this systematically. Let me share what worked well in similar situations...`,
          'mentor': `I've been where you are. Here's what I learned that might help you navigate this challenge...`,
          'peer': `Hey! I actually faced something similar recently. What worked for me was...`,
          'friend': `I totally get it! That sounds frustrating. Want to talk through it together?`
        };

        const baseResponse = responses[personality] || responses['peer'];
        const personalizedResponse = `${baseResponse}\n\nRegarding "${context.userInput}" - I think the key is to break it down into manageable steps.`;

        return {
          success: true,
          data: {
            response: personalizedResponse,
            personalityUsed: personality,
            tone: personality === 'friend' ? 'casual' : 'professional'
          },
          message: 'Colleague response generated',
          cacheTTL: 600000
        };
      }
    };
  }

  private createDefaultExecutor(skillId: string): Skill['execute'] {
    return async (context: SkillContext): Promise<SkillResult> => ({
      success: true,
      data: { processed: context.userInput, by: skillId },
      message: `Default execution for ${skillId}`
    });
  }

  private extractSkillIdFromUrl(url: string): string {
    const match = url.match(/github\.com\/[^\/]+\/([^\/]+)/);
    return match ? match[1].toLowerCase().replace(/-/g, '-') : `external_${Date.now()}`;
  }

  private generateCacheKey(skillId: string, context: SkillContext): string {
    return `${skillId}:${context.sessionId}:${context.userInput.slice(0, 100)}`;
  }

  private isCacheExpired(cached: CachedResult): boolean {
    return Date.now() - cached.timestamp > cached.ttl;
  }

  private setCache(key: string, result: SkillResult, ttl: number): void {
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      ttl,
      key
    });
  }

  private enrichContext(context: SkillContext): SkillContext {
    const session = this.sessions.get(context.sessionId);
    
    return {
      ...context,
      metadata: {
        ...session?.metadata,
        ...context.metadata,
        sessionCreatedAt: session?.createdAt,
        messageCount: session?.history.length || 0
      }
    };
  }

  private updateSessionHistory(sessionId: string, result: SkillResult): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.history.push(result);
      session.updatedAt = Date.now();
      
      if (session.history.length > 100) {
        session.history = session.history.slice(-50);
      }
    }
  }

  private initializeMetrics(skillId: string): void {
    if (!this.metrics.has(skillId)) {
      this.metrics.set(skillId, {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageExecutionTime: 0,
        lastExecutionTime: null,
        successRate: 0
      });
    }
  }

  private updateMetrics(
    skillId: string,
    result: SkillResult,
    executionTime: number
  ): void {
    const metrics = this.metrics.get(skillId);
    if (!metrics) return;

    metrics.totalCalls++;
    metrics.lastExecutionTime = Date.now();

    if (result.success) {
      metrics.successfulCalls++;
    } else {
      metrics.failedCalls++;
    }

    const totalTime = metrics.averageExecutionTime * (metrics.totalCalls - 1) + executionTime;
    metrics.averageExecutionTime = totalTime / metrics.totalCalls;
    metrics.successRate = metrics.successfulCalls / metrics.totalCalls;
  }

  private calculateIntentMatch(userInput: string, skill: Skill): number {
    const input = userInput.toLowerCase();
    let score = 0;

    if (skill.id.includes('ex-skill') || skill.description?.includes('analysis')) {
      if (/analyze|review|code|debug|fix|optimize|test/.test(input)) score += 0.8;
      if (/error|bug|issue|problem/.test(input)) score += 0.6;
    }

    if (skill.id.includes('colleague') || skill.description?.includes('colleague')) {
      if (/talk|chat|discuss|advice|help|feel|career/.test(input)) score += 0.8;
      if (/think|opinion|suggest|recommend/.test(input)) score += 0.5;
    }

    if (skill.capabilities) {
      for (const cap of skill.capabilities) {
        if (input.includes(cap.toLowerCase())) {
          score += 0.3;
        }
      }
    }

    return Math.min(score, 1);
  }
}

export default SkillManager;

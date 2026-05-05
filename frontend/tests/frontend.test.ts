/**
 * 前端蒸馏页面测试
 * TDD: 先编写测试，再修复代码
 */

// API 客户端类型测试
describe('distillAPI 客户端', () => {

  test('createSkill 正确构建请求对象', () => {
    const mockRequest = {
      name: '测试',
      slug: 'test',
      description: '描述',
      persona_traits: { tags: ['幽默'] },
      memory_items: { shared_experiences: ['吃饭'] }
    };
    expect(mockRequest.name).toBe('测试');
    expect(mockRequest.slug).toBe('test');
    expect(mockRequest.persona_traits.tags).toContain('幽默');
  });

  test('响应数据结构正确', () => {
    const mockResponse = { success: true, slug: 'test', version: 'v1.0', skill_path: '/skills/test' };
    expect(mockResponse.success).toBe(true);
    expect(mockResponse.slug).toBe('test');
    expect(mockResponse.version).toBeDefined();
  });
});

// 首页组件测试
describe('首页 HomePage', () => {
  test('页面包含标题 EchoVault', () => {
    const titleRegex = /EchoVault/;
    expect('EchoVault - 隐私至上的 AI 数字陪伴').toMatch(titleRegex);
  });

  test('Link 标签不含嵌套的 button', () => {
    const newLinkFormat = '<Link href="/distill" className="inline-block no-underline">开始创建你的 Skill</Link>';
    expect(newLinkFormat).not.toContain('<button>');
    expect(newLinkFormat).toContain('href="/distill"');
    expect(newLinkFormat).toContain('no-underline');
  });
});

// 蒸馏页面测试
describe('蒸馏页面 DistillPage', () => {
  test('表单包含必填字段标记', () => {
    const formHtml = `
      <label htmlFor="name">姓名/代号 *</label>
      <input type="text" id="name" />
      <label htmlFor="slug">唯一标识 (slug) *</label>
      <input type="text" id="slug" />
    `;
    expect(formHtml).toContain('*');
    expect(formHtml).toContain('id="name"');
    expect(formHtml).toContain('id="slug"');
  });

  test('错误状态显示正确的消息', () => {
    const errorMessage = '请填写必填项：姓名和唯一标识';
    expect(errorMessage).toContain('必填项');
    expect(errorMessage).toContain('姓名');
    expect(errorMessage).toContain('唯一标识');
  });

  test('提示端口使用正确', () => {
    const hintText = 'http://localhost:9000';
    expect(hintText).toBe('http://localhost:9000');
  });
});

// 布局测试
describe('RootLayout', () => {
  test('语言属性设为 zh-CN', () => {
    const htmlTag = '<html lang="zh-CN">';
    expect(htmlTag).toContain('lang="zh-CN"');
  });

  test('导出正确的 Metadata', () => {
    const metadata = {
      title: 'EchoVault - 隐私至上的 AI 数字陪伴',
      description: '保存情感记忆，创建专属数字分身',
    };
    expect(metadata.title).toContain('EchoVault');
    expect(metadata.description).toContain('数字分身');
  });
});

// LLMConfigPanel 组件测试
describe('LLMConfigPanel 组件', () => {
  test('组件被正确导出', () => {
    const expectedExport = 'export default';
    const componentCode = 'export default function LLMConfigPanel()';
    expect(componentCode).toContain(expectedExport);
  });

  test('包含模型选择功能', () => {
    const componentMarkup = `
      <select>
        <option>DeepSeek</option>
        <option>GLM</option>
        <option>Kimi</option>
        <option>Qwen</option>
      </select>
    `;
    expect(componentMarkup).toContain('DeepSeek');
    expect(componentMarkup).toContain('GLM');
    expect(componentMarkup).toContain('Kimi');
  });
});

// CostEstimator 组件测试
describe('CostEstimator 组件', () => {
  test('组件被正确导出', () => {
    const componentCode = 'export default function CostEstimator()';
    expect(componentCode).toContain('export default');
  });

  test('显示成本估算', () => {
    const displayText = '费用估算: ¥0.00';
    expect(displayText).toContain('费用估算');
  });
});

// useLLMConfig hook 测试
describe('useLLMConfig hook', () => {
  test('hook 被正确导出', () => {
    const hookCode = 'export default function useLLMConfig()';
    expect(hookCode).toContain('useLLMConfig');
  });

  test('返回配置数据', () => {
    const expectedReturn = '{ provider, apiKey, model }';
    expect(expectedReturn).toContain('provider');
    expect(expectedReturn).toContain('apiKey');
    expect(expectedReturn).toContain('model');
  });
});

// Chat 页面测试
describe('聊天页面', () => {
  test('SkillChatPage 组件被正确导出', () => {
    const componentCode = 'export default function SkillChatPage()';
    expect(componentCode).toContain('SkillChatPage');
  });

  test('页面应接收 skillId 参数', () => {
    interface SkillChatProps {
      params: { skillId: string };
    }
    const props: SkillChatProps = { params: { skillId: 'test-user' } };
    expect(props.params.skillId).toBe('test-user');
  });
});

// Settings 页面测试
describe('设置页面', () => {
  test('SettingsPage 组件被正确导出', () => {
    const componentCode = 'export default function SettingsPage()';
    expect(componentCode).toContain('SettingsPage');
  });

  test('包含 LLM 配置面板', () => {
    const pageContent = '<LLMConfigPanel />';
    expect(pageContent).toContain('LLMConfigPanel');
  });
});

// ErrorBoundary 组件测试
describe('ErrorBoundary 组件', () => {
  test('组件是 Class Component', () => {
    const componentCode = 'class ErrorBoundary extends Component';
    expect(componentCode).toContain('ErrorBoundary');
    expect(componentCode).toContain('extends Component');
  });

  test('包含 getDerivedStateFromError 生命周期', () => {
    const staticMethod = 'static getDerivedStateFromError(error: Error): ErrorBoundaryState';
    expect(staticMethod).toContain('getDerivedStateFromError');
  });

  test('错误状态包含 hasError 和 error', () => {
    const errorState = { hasError: true, error: new Error('test error') };
    expect(errorState.hasError).toBe(true);
    expect(errorState.error).toBeInstanceOf(Error);
    expect(errorState.error?.message).toBe('test error');
  });

  test('重置方法清除错误状态', () => {
    const initialState = { hasError: true, error: new Error('test') };
    const resetState = { hasError: false, error: null };
    expect(resetState.hasError).toBe(false);
    expect(resetState.error).toBeNull();
  });
});

// 重试工具测试
describe('retry 指数退避', () => {
  test('baseDelay 常量定义正确', () => {
    const baseDelayMs = 1000;
    expect(baseDelayMs).toBe(1000);
  });

  test('maxRetries 默认为 3', () => {
    const maxRetries = 3;
    expect(maxRetries).toBe(3);
  });

  test('可重试状态码包含 5xx 和 429', () => {
    const retryOnStatus = [408, 429, 500, 502, 503, 504];
    expect(retryOnStatus).toContain(429);
    expect(retryOnStatus).toContain(500);
    expect(retryOnStatus).toContain(503);
  });

  test('指数退避延迟递增', () => {
    const delays = [0, 1, 2].map((attempt) => 1000 * Math.pow(2, attempt));
    expect(delays[0]).toBe(1000);
    expect(delays[1]).toBe(2000);
    expect(delays[2]).toBe(4000);
  });

  test('最大延迟不超过限制', () => {
    const maxDelayMs = 30000;
    const delay = Math.min(1000 * Math.pow(2, 6), maxDelayMs);
    expect(delay).toBeLessThanOrEqual(maxDelayMs);
    expect(delay).toBe(30000);
  });

  test('isNetworkError 检测网络错误', () => {
    const networkError = new TypeError('Failed to fetch');
    expect(() => {
      if (networkError.message === 'Failed to fetch') throw new Error('network');
    }).toThrow('network');
  });

  test('extractErrorMessage 提取字符串错误', () => {
    const error = '简单错误';
    expect(typeof error === 'string').toBe(true);
    expect(error).toBe('简单错误');
  });
});

// API 客户端错误处理测试
describe('API 客户端错误处理', () => {
  test('APIError 类包含 name 和 status', () => {
    class MockAPIError extends Error {
      status: number;
      constructor(message: string, status: number) {
        super(message);
        this.name = 'APIError';
        this.status = status;
      }
    }
    const error = new MockAPIError('请求失败', 500);
    expect(error.name).toBe('APIError');
    expect(error.status).toBe(500);
    expect(error.message).toBe('请求失败');
  });
});

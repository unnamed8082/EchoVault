import axios from 'axios';
import { withRetry, isNetworkError, extractErrorMessage } from './retry';
import { getAPIBaseURL } from './platform';
import { getToken } from './auth-context';

const api = axios.create({
  baseURL: getAPIBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface DistillRequest {
  name: string;
  slug: string;
  persona_traits?: Record<string, unknown>;
  memory_items?: Record<string, unknown>;
}

export interface DistillResponse {
  success: boolean;
  message: string;
  slug?: string;
}

export interface SkillListResponse {
  skills: string[];
}

export interface SkillResponse {
  slug: string;
  name: string;
  persona_traits: Record<string, unknown>;
  memory_items: Record<string, unknown>;
  lessons_content?: string;
}

export class APIError extends Error {
  status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}

function handleAPIError(error: unknown): never {
  const message = extractErrorMessage(error);
  const axiosError = error as Record<string, unknown>;
  const response = axiosError?.response as Record<string, unknown> | undefined;
  const status = response?.status as number | undefined;
  throw new APIError(message, status);
}

export const distillAPI = {
  async createSkill(request: DistillRequest): Promise<DistillResponse> {
    return withRetry(async () => {
      try {
        const response = await api.post('/api/distill/', request);
        return response.data;
      } catch (error) {
        handleAPIError(error);
      }
    }).catch((error) => {
      if (error instanceof APIError) throw error;
      throw new APIError('创建 Skill 失败，请检查后端服务是否已启动');
    });
  },

  async listSkills(): Promise<SkillListResponse> {
    return withRetry(async () => {
      try {
        const response = await api.get('/api/distill/skills');
        return response.data;
      } catch (error) {
        handleAPIError(error);
      }
    }).catch((error) => {
      if (error instanceof APIError) throw error;
      throw new APIError('获取 Skill 列表失败');
    });
  },

  async getSkill(slug: string): Promise<SkillResponse> {
    return withRetry(async () => {
      try {
        const response = await api.get(`/api/distill/skills/${slug}`);
        return response.data;
      } catch (error) {
        handleAPIError(error);
      }
    }).catch((error) => {
      if (error instanceof APIError) throw error;
      throw new APIError('获取 Skill 详情失败');
    });
  },

  async deleteSkill(slug: string): Promise<{ success: boolean }> {
    return withRetry(async () => {
      try {
        const response = await api.delete(`/api/distill/skills/${slug}`);
        return response.data;
      } catch (error) {
        handleAPIError(error);
      }
    }).catch((error) => {
      if (error instanceof APIError) throw error;
      throw new APIError('删除 Skill 失败');
    });
  },
};

export { isNetworkError, extractErrorMessage };
export default api;

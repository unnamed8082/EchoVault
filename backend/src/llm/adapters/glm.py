from openai import OpenAI
from ..base import BaseLLMClient, LLMResponse, LLMUsage

class GLMClient(BaseLLMClient):
    def __init__(self, api_key: str, model: str = "glm-4-flash", base_url: str = None):
        self.client = OpenAI(
            api_key=api_key,
            base_url=base_url or "https://open.bigmodel.cn/api/paas/v4"
        )
        self._model = model

    @property
    def model_name(self): return self._model

    def chat(self, messages, temperature=0.7, max_tokens=2048):
        resp = self.client.chat.completions.create(
            model=self._model, messages=messages,
            temperature=temperature, max_tokens=max_tokens
        )
        usage = LLMUsage(
            input_tokens=resp.usage.prompt_tokens,
            output_tokens=resp.usage.completion_tokens,
            total_tokens=resp.usage.total_tokens
        )
        return LLMResponse(content=resp.choices[0].message.content, usage=usage, model=self._model)

    def distillation_analyze(self, chat_summary, target_name):
        return self.chat(...)  # 同构
from openai import OpenAI
from ..base import BaseLLMClient, LLMResponse, LLMUsage
from ..cost import estimate_cost

class DeepSeekClient(BaseLLMClient):
    def __init__(self, api_key: str, model: str = "deepseek-chat", base_url: str = None):
        super().__init__()  # 调用父类 init
        self.client = OpenAI(
            api_key=api_key,
            base_url=base_url or "https://api.deepseek.com/v1"
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
            total_tokens=resp.usage.total_tokens,
            estimated_cost=estimate_cost(
                self._model, 
                resp.usage.prompt_tokens, 
                resp.usage.completion_tokens
            )
        )
        return LLMResponse(content=resp.choices[0].message.content, usage=usage, model=self._model)
from openai import OpenAI
from ..base import BaseLLMClient, LLMResponse, LLMUsage

class OllamaClient(BaseLLMClient):
    def __init__(self, api_key: str = "ollama", model: str = "qwen2.5:7b", base_url: str = None):
        self.client = OpenAI(
            api_key="ollama",
            base_url=base_url or "http://localhost:11434/v1"
        )
        self._model = model

    @property
    def model_name(self): return self._model

    def chat(self, messages, temperature=0.7, max_tokens=2048):
        resp = self.client.chat.completions.create(
            model=self._model, messages=messages,
            temperature=temperature, max_tokens=max_tokens
        )
        return LLMResponse(content=resp.choices[0].message.content,
                           usage=LLMUsage(), model=self._model)

    def distillation_analyze(self, chat_summary, target_name):
        return self.chat(...)
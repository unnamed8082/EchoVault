from .adapters.kimi import KimiClient
from .adapters.deepseek import DeepSeekClient
from .adapters.glm import GLMClient
from .adapters.qwen import QwenClient
from .adapters.mimo import MiMoClient
from .adapters.ollama import OllamaClient
from .base import BaseLLMClient

_CLASS_MAP = {
    "kimi": KimiClient,
    "deepseek": DeepSeekClient,
    "glm": GLMClient,
    "qwen": QwenClient,
    "mimo": MiMoClient,
    "ollama": OllamaClient,
}

def create_llm_client(provider: str, api_key: str, model: str, base_url: str = None) -> BaseLLMClient:
    provider = provider.lower()
    if provider not in _CLASS_MAP:
        raise ValueError(f"Unsupported provider: {provider}")
    kwargs = {"api_key": api_key, "model": model}
    if base_url:
        kwargs["base_url"] = base_url
    return _CLASS_MAP[provider](**kwargs)
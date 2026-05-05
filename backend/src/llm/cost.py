# 定价： (input_price, output_price) per 1K tokens
PRICING = {
    "moonshot-v1-8k": (0.012, 0.012),
    "moonshot-v1-32k": (0.024, 0.024),
    "moonshot-v1-128k": (0.06, 0.06),
    "deepseek-chat": (0.001, 0.002),
    "deepseek-reasoner": (0.004, 0.016),
    "glm-4-flash": (0.001, 0.001),
    "qwen-turbo": (0.008, 0.008),
    "qwen-plus": (0.02, 0.06),
    "mimo-v2.5": (0, 0),
    "mimo-v2.5-pro": (0, 0),
    "ollama": (0, 0),
}

def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    inp_price, out_price = PRICING.get(model, (0, 0))
    return (input_tokens / 1000) * inp_price + (output_tokens / 1000) * out_price
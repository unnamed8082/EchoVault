from typing import List, Dict, Optional


def estimate_tokens(text: Optional[str]) -> int:
    if not text:
        return 0
    chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
    other_chars = len(text) - chinese_chars
    return chinese_chars * 2 + (other_chars + 3) // 4


def estimate_cost(
    input_tokens: int,
    output_tokens: int,
    input_price_per_1k: float,
    output_price_per_1k: float,
) -> float:
    return (input_tokens / 1000.0) * input_price_per_1k + (output_tokens / 1000.0) * output_price_per_1k


def truncate_messages(messages: List[Dict[str, str]], max_tokens: int) -> List[Dict[str, str]]:
    if not messages:
        return []
    result = [messages[-1]]
    current_tokens = estimate_tokens(messages[-1].get("content", ""))
    for msg in reversed(messages[:-1]):
        msg_tokens = estimate_tokens(msg.get("content", ""))
        if current_tokens + msg_tokens > max_tokens:
            break
        result.insert(0, msg)
        current_tokens += msg_tokens
    return result

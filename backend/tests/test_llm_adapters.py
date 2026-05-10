import sys
from pathlib import Path
from unittest.mock import Mock, patch
import pytest
import asyncio

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from llm.base import LLMResponse, LLMUsage, BaseLLMClient


class MockLLMClient(BaseLLMClient):
    def __init__(self, responses):
        super().__init__()
        self.responses = responses
        self.call_count = 0
    
    @property
    def model_name(self):
        return "mock-model"
    
    async def chat(self, messages, temperature=0.7, max_tokens=2048):
        response = self.responses[self.call_count] if self.call_count < len(self.responses) else self.responses[-1]
        self.call_count += 1
        return response

    async def chat_stream(self, messages, temperature=0.7, max_tokens=2048):
        response = self.responses[self.call_count] if self.call_count < len(self.responses) else self.responses[-1]
        self.call_count += 1
        for char in response.content:
            yield char


def run_async(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


class TestLLMResponseJSONExtraction:
    
    def test_extract_pure_json_success(self):
        json_str = '{"hard_rules": ["不说脏话"], "identity": {"职业": "测试"}}'
        response = LLMResponse(
            content=json_str,
            usage=LLMUsage(),
            model="test"
        )
        result = response.extract_json()
        assert result is not None
        assert result["hard_rules"] == ["不说脏话"]
    
    def test_extract_json_with_text_before(self):
        content = """好的，这是 JSON：
{"hard_rules": ["不说脏话"], "identity": {"职业": "测试"}}
"""
        response = LLMResponse(content=content, usage=LLMUsage(), model="test")
        result = response.extract_json()
        assert result is not None
        assert result["hard_rules"] == ["不说脏话"]
    
    def test_extract_json_with_text_after(self):
        content = '{"hard_rules": ["不说脏话"], "identity": {"职业": "测试"}}\n希望这个结果对你有帮助！'
        response = LLMResponse(content=content, usage=LLMUsage(), model="test")
        result = response.extract_json()
        assert result is not None
    
    def test_extract_json_markdown_code_block(self):
        content = '''```json
{"hard_rules": ["不说脏话"], "identity": {"职业": "测试"}}
```'''
        response = LLMResponse(content=content, usage=LLMUsage(), model="test")
        result = response.extract_json()
        assert result is not None
    
    def test_extract_nonexistent_json_returns_none(self):
        response = LLMResponse(content="只是普通文本，没有 JSON", usage=LLMUsage(), model="test")
        result = response.extract_json()
        assert result is None


class TestDistillationAnalyze:
    
    def test_normal_json_response(self):
        mock_response = LLMResponse(
            content='{"hard_rules": ["不说脏话"], "identity": {"职业": "测试"}}',
            usage=LLMUsage(input_tokens=100, output_tokens=50),
            model="test"
        )
        client = MockLLMClient([mock_response])
        
        result = run_async(client.distillation_analyze("测试聊天摘要", "测试用户"))
        
        assert client.call_count == 1
        parsed = result.extract_json()
        assert parsed is not None
        assert parsed["hard_rules"] == ["不说脏话"]
    
    def test_non_json_first_then_retry_success(self):
        non_json_response = LLMResponse(
            content="我来分析一下... 这个用户很有趣",
            usage=LLMUsage(input_tokens=100, output_tokens=30),
            model="test"
        )
        json_response = LLMResponse(
            content='{"hard_rules": ["不说脏话"], "identity": {"职业": "测试"}}',
            usage=LLMUsage(input_tokens=150, output_tokens=60),
            model="test"
        )
        
        client = MockLLMClient([non_json_response, json_response])
        
        result = run_async(client.distillation_analyze("测试聊天摘要", "测试用户", enable_retry=True))
        
        assert client.call_count == 2
        assert result.usage.input_tokens == 250
        assert result.usage.output_tokens == 90
    
    def test_disable_retry_does_not_retry(self):
        non_json_response = LLMResponse(
            content="只是文本",
            usage=LLMUsage(),
            model="test"
        )
        json_response = LLMResponse(
            content='{"hard_rules": ["不说脏话"]}',
            usage=LLMUsage(),
            model="test"
        )
        
        client = MockLLMClient([non_json_response, json_response])
        
        result = run_async(client.distillation_analyze("测试聊天摘要", "测试用户", enable_retry=False))
        
        assert client.call_count == 1
        assert result.content == "只是文本"
    
    def test_total_usage_accumulation(self):
        response1 = LLMResponse(
            content='{"hard_rules": ["A"]}',
            usage=LLMUsage(input_tokens=100, output_tokens=50, total_tokens=150, estimated_cost=0.01),
            model="test"
        )
        response2 = LLMResponse(
            content='{"hard_rules": ["B"]}',
            usage=LLMUsage(input_tokens=200, output_tokens=100, total_tokens=300, estimated_cost=0.02),
            model="test"
        )
        
        client = MockLLMClient([response1, response2])
        
        run_async(client.distillation_analyze("聊天1", "用户1"))
        run_async(client.distillation_analyze("聊天2", "用户2"))
        
        assert client.total_usage.input_tokens == 300
        assert client.total_usage.estimated_cost == 0.03


class TestCostEstimation:
    
    def test_usage_has_estimated_cost(self):
        from llm.cost import estimate_cost
        
        cost = estimate_cost("deepseek-chat", 1000, 500)
        assert cost > 0
        assert cost == (1000 / 1000 * 0.001) + (500 / 1000 * 0.002)
    
    def test_free_model_costs_zero(self):
        from llm.cost import estimate_cost
        
        cost = estimate_cost("ollama", 10000, 5000)
        assert cost == 0.0
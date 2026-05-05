'use client';

interface CostEstimatorProps {
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  estimatedCost?: number;
}

const MODEL_RATES: Record<string, { input: number; output: number }> = {
  'deepseek-chat': { input: 0.001, output: 0.002 },
  'glm-4-flash': { input: 0.001, output: 0.001 },
  'qwen-turbo': { input: 0.008, output: 0.008 },
  'moonshot-v1-8k': { input: 0.012, output: 0.012 },
  'ollama': { input: 0, output: 0 },
};

export default function CostEstimator({
  inputTokens = 0,
  outputTokens = 0,
  model = 'deepseek-chat',
  estimatedCost,
}: CostEstimatorProps) {
  const rates = MODEL_RATES[model] || { input: 0, output: 0 };
  const calculatedCost = estimatedCost ?? (
    (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output
  );

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm">
      <h3 className="font-medium text-gray-700 mb-2">费用估算</h3>
      <div className="space-y-1 text-gray-600">
        <div className="flex justify-between">
          <span>输入 Tokens</span>
          <span className="font-mono">{inputTokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>输出 Tokens</span>
          <span className="font-mono">{outputTokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gray-900 font-medium pt-1 border-t">
          <span>估算费用</span>
          <span className="font-mono">¥{calculatedCost.toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
}

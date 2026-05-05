import { test, expect } from '@playwright/test';

test.describe('设置页面 (SettingsPage)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('页面标题显示设置', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('设置');
  });

  test('LLM 配置面板存在', async ({ page }) => {
    await expect(page.locator('text=LLM 模型配置')).toBeVisible();
  });

  test('供应商下拉框包含所有选项', async ({ page }) => {
    const select = page.locator('select').first();
    const options = await select.locator('option').allTextContents();
    expect(options).toContain('DeepSeek');
    expect(options).toContain('智谱 GLM');
    expect(options).toContain('Kimi');
    expect(options).toContain('通义千问');
  });

  test('切换供应商后模型列表更新', async ({ page }) => {
    const providerSelect = page.locator('select').first();
    const modelSelect = page.locator('select').nth(1);

    await providerSelect.selectOption({ label: 'Kimi' });
    const options = await modelSelect.locator('option').allTextContents();
    expect(options).toContain('moonshot-v1-8k');
  });

  test('API Key 输入框类型为 password', async ({ page }) => {
    const apiKeyInput = page.locator('input[type="password"]');
    await expect(apiKeyInput).toBeVisible();
    await expect(apiKeyInput).toHaveAttribute('placeholder', '输入 API Key');
  });

  test('显示 API Key 隐私说明', async ({ page }) => {
    await expect(page.locator('text=API Key 保存在本地，不会上传到服务器')).toBeVisible();
  });
});

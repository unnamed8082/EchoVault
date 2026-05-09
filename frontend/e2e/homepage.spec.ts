import { test, expect } from '@playwright/test';

test.describe('首页 (HomePage)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('页面标题包含 EchoVault', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('EchoVault');
  });

  test('显示三个功能卡片', async ({ page }) => {
    const cards = page.locator('.grid > div');
    await expect(cards).toHaveCount(3);
  });

  test('卡片内容包含情感树洞', async ({ page }) => {
    await expect(page.locator('text=情感树洞')).toBeVisible();
  });

  test('导航链接指向 distill 页面', async ({ page }) => {
    const link = page.locator('a[href="/distill"]');
    await expect(link).toBeVisible();
    await expect(link).toContainText('开始创建你的 Skill');
  });

  test('页面底部显示提示信息', async ({ page }) => {
    await expect(page.locator('text=访问 /distill 进入人格蒸馏功能')).toBeVisible();
  });
});

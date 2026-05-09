import { test, expect } from '@playwright/test';

test.describe('应用导航', () => {
  test('从首页导航到蒸馏页面', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('a[href="/distill"]').click();
    await page.waitForURL('**/distill');

    await expect(page.locator('h1')).toContainText('人格蒸馏');
  });

  test('从蒸馏页面通过浏览器后退返回首页', async ({ page }) => {
    await page.goto('/distill');
    await page.waitForLoadState('networkidle');

    await page.goBack();
    await page.waitForURL('**/');

    await expect(page.locator('h1')).toContainText('EchoVault');
  });

  test('页面不存在时 Next.js 显示 404', async ({ page }) => {
    const response = await page.goto('/non-existent-page');
    expect(response?.status()).toBe(404);
  });
});

test.describe('响应式布局', () => {
  test('移动端视口下页面可读', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toBeVisible();
    const cards = page.locator('.grid > div');
    await expect(cards).toHaveCount(3);
  });
});

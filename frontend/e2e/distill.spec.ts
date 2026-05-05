import { test, expect } from '@playwright/test';

test.describe('蒸馏页面 (DistillPage)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/distill');
    await page.waitForLoadState('networkidle');
  });

  test('页面标题显示人格蒸馏', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('人格蒸馏');
  });

  test('表单包含必填字段标记', async ({ page }) => {
    const labels = page.locator('label');
    await expect(labels.filter({ hasText: '*' })).toHaveCount(2);
  });

  test('姓名输入框可见且可交互', async ({ page }) => {
    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('测试用户');
    await expect(nameInput).toHaveValue('测试用户');
  });

  test('slug 输入框可见且可交互', async ({ page }) => {
    const slugInput = page.locator('#slug');
    await expect(slugInput).toBeVisible();
    await slugInput.fill('test-user-slug');
    await expect(slugInput).toHaveValue('test-user-slug');
  });

  test('提交按钮初始正常显示', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).not.toBeDisabled();
    await expect(submitBtn).toContainText('创建 Skill');
  });

  test('未填写必填项时显示错误提示', async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=请填写必填项：姓名和唯一标识')).toBeVisible();
  });

  test('描述输入框可见且可交互', async ({ page }) => {
    const descInput = page.locator('#description');
    await expect(descInput).toBeVisible();
    await descInput.fill('这是一个测试描述');
    await expect(descInput).toHaveValue('这是一个测试描述');
  });

  test('页面底部显示后端地址提示', async ({ page }) => {
    await expect(page.locator('text=http://localhost:9000')).toBeVisible();
  });
});

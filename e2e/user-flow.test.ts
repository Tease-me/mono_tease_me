import { test, expect } from '@playwright/test';

test.describe('User Authentication and Messaging', () => {
  test('user can login and access chat interface', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL || 'admin@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'admin123';

    await page.goto('/login');

    const enterButton = page.getByText('I am over 18 - Enter');
    try {
      await enterButton.waitFor({ state: 'visible', timeout: 5000 });
      await enterButton.click();
      await page.waitForTimeout(500);
    } catch (error) {
      console.log('Disclaimer modal not shown (already accepted)');
    }

    await expect(page.getByText('Login to your Account')).toBeVisible();

    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByText('Sign In').click();

    await page.waitForURL('/home', { timeout: 60000 });
    await page.waitForLoadState('networkidle');

    const chatButton = page.getByText('Chat').first();
    await chatButton.waitFor({ state: 'visible', timeout: 10000 });
    await chatButton.click();
    await page.waitForTimeout(3000);

    const textareaCount = await page.locator('textarea').count();

    if (textareaCount > 0) {
      const chatInput = page.locator('textarea').last();
      await chatInput.waitFor({ state: 'visible', timeout: 5000 });
      const message = `Test message at ${new Date().toLocaleTimeString()}`;
      await chatInput.fill(message);
      await chatInput.press('Enter');
      await page.waitForTimeout(2000);
    } else {
      const callButton = page.locator('button').filter({ hasText: /call|start/i }).first();
      if (await callButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await callButton.click();
        await page.waitForTimeout(2000);
      }
    }

    await page.pause();
  });
});

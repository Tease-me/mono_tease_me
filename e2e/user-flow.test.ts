import { test, expect } from '@playwright/test';

test.describe('User Authentication and Messaging', () => {
  test('user can login and send a message', async ({ page }) => {
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
    await page.waitForTimeout(1000);

    const chatInput = page.locator('textarea').last();
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    const message = `Test message at ${new Date().toLocaleTimeString()}`;
    await chatInput.fill(message);
    await page.waitForTimeout(500);

    const sendButton = page.locator('button').filter({ hasText: /send/i }).first();
    if (await sendButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sendButton.click();
    } else {
      await chatInput.press('Enter');
    }

    await expect(chatInput).toHaveValue('');
    await expect(page.getByText(message)).toBeVisible({ timeout: 5000 });

    await expect(async () => {
      const messageCount = await page.locator('[class*="message"]').count();
      expect(messageCount).toBeGreaterThan(1);
    }).toPass({ timeout: 30000 });
  });
});

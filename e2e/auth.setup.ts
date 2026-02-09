import { test as setup } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
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

  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByText('Sign In').click();

  await page.waitForURL('/home', { timeout: 60000 });
  await page.context().storageState({ path: authFile });
});

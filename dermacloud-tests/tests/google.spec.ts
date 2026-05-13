import {test, expect} from '@playwright/test';

test('Google page should have correct title', async ({ page })=>{
    await page.goto('https://www.google.com');
    await expect(page).toHaveTitle('Google');
    const searchBox = page.locator('textarea[name="q"]');
    await searchBox.fill('Playwrightt testing');
    await searchBox.press('Enter');
    await expect(page).toHaveURL(/search/);
})
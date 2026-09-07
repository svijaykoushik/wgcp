import { test, expect } from '@playwright/test';

test.describe('Portal Services UI & Dashboards E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and log in
    await page.goto('http://localhost');
    await page.waitForSelector('#username, [data-focusable="nav-library"]', { timeout: 15000 });

    const usernameInput = page.locator('#username');
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('testuser');
      await page.click('button[data-focusable="login-btn"]');
    }

    await expect(page.locator('[data-focusable="nav-library"]')).toBeVisible({ timeout: 15000 });
  });

  test('NavBar Navigation & Bumper Shortcut Cycling across all 5 views', async ({ page }) => {
    // 1. Verify all 5 navigation tabs are visible in the top navbar
    await expect(page.locator('[data-focusable="nav-library"]')).toBeVisible();
    await expect(page.locator('[data-focusable="nav-catalogue"]')).toBeVisible();
    await expect(page.locator('[data-focusable="nav-achievements"]')).toBeVisible();
    await expect(page.locator('[data-focusable="nav-leaderboards"]')).toBeVisible();
    await expect(page.locator('[data-focusable="nav-profile"]')).toBeVisible();

    // 2. Test manual clicking across views
    await page.locator('[data-focusable="nav-achievements"]').click();
    await expect(page.locator('h2:has-text("Achievements Showcase")')).toBeVisible({ timeout: 10000 });

    await page.locator('[data-focusable="nav-leaderboards"]').click();
    await expect(page.locator('h2:has-text("Global Leaderboards")')).toBeVisible({ timeout: 10000 });

    await page.locator('[data-focusable="nav-profile"]').click();
    await expect(page.locator('h2:has-text("@testuser")')).toBeVisible({ timeout: 10000 });

    // 3. Test Keyboard Bumper Cycling (PageUp / PageDown)
    // Currently on Profile (index 4). Pressing PageUp should move to Leaderboards (index 3)
    await page.keyboard.press('PageUp');
    await expect(page.locator('h2:has-text("Global Leaderboards")')).toBeVisible({ timeout: 10000 });

    // Pressing PageUp should move to Achievements (index 2)
    await page.keyboard.press('PageUp');
    await expect(page.locator('h2:has-text("Achievements Showcase")')).toBeVisible({ timeout: 10000 });

    // Pressing PageUp should move to Catalogue (index 1)
    await page.keyboard.press('PageUp');
    await expect(page.locator('h2:has-text("Game Catalogue")')).toBeVisible({ timeout: 10000 });

    // Pressing PageUp should move to Library (index 0)
    await page.keyboard.press('PageUp');
    await expect(page.locator('h2:has-text("My Game Library")')).toBeVisible({ timeout: 10000 });

    // Pressing PageDown should move to Catalogue
    await page.keyboard.press('PageDown');
    await expect(page.locator('h2:has-text("Game Catalogue")')).toBeVisible({ timeout: 10000 });
  });

  test('Achievements Showcase - Filtering, Unlocking, and Game Selection', async ({ page }) => {
    // Unlock an achievement via backend API for testing
    await page.evaluate(async () => {
      const txId = '550e8400-e29b-41d4-a716-446655440000';
      await fetch('/api/v1/games/2048/achievements/tile_256/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txId }),
      });
    });

    // Navigate to Achievements view
    await page.locator('[data-focusable="nav-achievements"]').click();
    await expect(page.locator('h2:has-text("Achievements Showcase")')).toBeVisible({ timeout: 10000 });

    // 1. Verify aggregate trophies card
    await expect(page.locator('text=Trophies Unlocked')).toBeVisible();

    // 2. Select 2048 game filter tab
    const tab2048 = page.locator('[data-focusable="achieve-game-2048"]');
    await expect(tab2048).toBeVisible();
    await tab2048.click();

    // Verify 2048 achievement card is present and unlocked
    const card256 = page.locator('[data-focusable="achieve-card-2048-tile_256"]');
    await expect(card256).toBeVisible();
    await expect(card256.locator('text=Quarter Grand')).toBeVisible();
    await expect(card256.locator('text=✓ Unlocked')).toBeVisible();

    // 3. Test Filter toggle: Unlocked
    await page.locator('[data-focusable="achieve-filter-unlocked"]').click();
    await expect(card256).toBeVisible();

    // Test Filter toggle: Locked
    await page.locator('[data-focusable="achieve-filter-locked"]').click();
    await expect(card256).not.toBeVisible();

    // Switch back to All filter
    await page.locator('[data-focusable="achieve-filter-all"]').click();
    await expect(card256).toBeVisible();
  });

  test('Global Leaderboards - Scores ingestion, Personal Best, and Podium display', async ({ page }) => {
    // Seed a leaderboard score via backend API
    await page.evaluate(async () => {
      // 1. Get single-use token
      const tokenRes = await fetch('/api/v1/games/2048/leaderboards/highScore/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionLengthMs: 15000, gameActivityScore: 100 }),
      });
      const { token } = await tokenRes.json();

      // 2. Submit score
      await fetch('/api/v1/games/2048/leaderboards/highScore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, score: 8192 }),
      });
    });

    // Navigate to Leaderboards view
    await page.locator('[data-focusable="nav-leaderboards"]').click();
    await expect(page.locator('h2:has-text("Global Leaderboards")')).toBeVisible({ timeout: 10000 });

    // Select 2048 game tab
    const tab2048 = page.locator('[data-focusable="leaderboard-game-2048"]');
    await expect(tab2048).toBeVisible();
    await tab2048.click();

    // 1. Verify Personal Best callout box
    await expect(page.locator('text=Your Best Score')).toBeVisible();
    const bestCallout = page.locator('text=Your Best Score').locator('xpath=..');
    await expect(bestCallout).toContainText('8,192');

    // 2. Verify Score table entry with Gold 🥇 and YOU badge
    const firstRow = page.locator('[data-focusable="leaderboard-row-1"]');
    await expect(firstRow).toBeVisible();
    await expect(firstRow.locator('text=@testuser')).toBeVisible();
    await expect(firstRow.locator('text=YOU')).toBeVisible();
    await expect(firstRow.locator('text=8,192')).toBeVisible();
  });

  test('Player Profile & Progression - XP leveling curve and Per-Game cards', async ({ page }) => {
    // Add XP to player via backend API
    await page.evaluate(async () => {
      await fetch('/api/v1/games/2048/progression/addXP', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 350 }),
      });
    });

    // Navigate to Profile view
    await page.locator('[data-focusable="nav-profile"]').click();
    await expect(page.locator('h2:has-text("@testuser")')).toBeVisible({ timeout: 10000 });

    // 1. Verify Player Card & Level Badge
    await expect(page.locator('text=Console Champion')).toBeVisible();
    await expect(page.locator('text=Player ID:')).toBeVisible();

    // 2. Verify Metrics Grid
    await expect(page.locator('[data-focusable="profile-metric-xp"]')).toBeVisible();
    await expect(page.locator('[data-focusable="profile-metric-trophies"]')).toBeVisible();
    await expect(page.locator('[data-focusable="profile-metric-library"]')).toBeVisible();
    await expect(page.locator('[data-focusable="profile-metric-scores"]')).toBeVisible();

    // 3. Verify Per-Game Progression & Cloud Sync Badge
    await expect(page.locator('text=Game Progression & Cloud Saves')).toBeVisible();
    const gameCard2048 = page.locator('[data-focusable="profile-game-2048"]');
    await expect(gameCard2048).toBeVisible();
    await expect(gameCard2048.locator('text=Synced')).toBeVisible();
    await expect(gameCard2048.locator('[data-focusable="profile-play-2048"]')).toBeVisible();
  });

  test('Spatial Navigation on Dashboards', async ({ page }) => {
    // Navigate to Profile
    await page.locator('[data-focusable="nav-profile"]').click();
    await expect(page.locator('h2:has-text("@testuser")')).toBeVisible({ timeout: 10000 });

    // 1. Test top navbar spatial navigation
    const navLibrary = page.locator('[data-focusable="nav-library"]');
    await navLibrary.focus();
    await expect(navLibrary).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-focusable="nav-catalogue"]')).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-focusable="nav-achievements"]')).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-focusable="nav-leaderboards"]')).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-focusable="nav-profile"]')).toBeFocused();

    // 2. Test metrics card spatial navigation
    const firstMetric = page.locator('[data-focusable="profile-metric-xp"]');
    await firstMetric.focus();
    await expect(firstMetric).toBeFocused();

    // Press ArrowRight to move to next metric card
    await page.keyboard.press('ArrowRight');
    const trophiesMetric = page.locator('[data-focusable="profile-metric-trophies"]');
    await expect(trophiesMetric).toBeFocused();

    // Press ArrowLeft to move back to first metric card
    await page.keyboard.press('ArrowLeft');
    await expect(firstMetric).toBeFocused();

    // Press ArrowDown from first metric card to move down to first game card
    await page.keyboard.press('ArrowDown');
    const firstGameCard = page.locator('[data-focusable^="profile-game-"]').first();
    await expect(firstGameCard).toBeFocused();
  });
});

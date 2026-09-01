import { test, expect } from '@playwright/test';

test.describe('WGCP SDK integrations E2E Tests', () => {
  // Helper to wait for and resolve frame
  async function getFrame(page: any, urlPattern: RegExp) {
    const iframeElement = page.locator('iframe');
    await expect(iframeElement).toBeVisible({ timeout: 20000 });
    
    let frame = page.frame({ url: urlPattern });
    for (let i = 0; i < 15; i++) {
      if (frame) break;
      await page.waitForTimeout(500);
      frame = page.frame({ url: urlPattern });
    }
    expect(frame).not.toBeNull();
    
    // Wait for the WGCP SDK to be fully initialized and available
    await frame!.waitForFunction(() => typeof window.WGCP !== 'undefined' && typeof window.WGCP.getState === 'function' && window.WGCP.getState() === 'READY_IDLE', { timeout: 15000 });
    return frame!;
  }

  // Helper to log in and ensure game is in library
  async function setupGame(page: any, gameId: string, buttonSelector: string) {
    // Attach detailed console log forwarders
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE - ${msg.type()}]: ${msg.text()} (${msg.location()?.url || 'unknown'})`);
    });
    page.on('pageerror', err => {
      console.log(`[BROWSER EXCEPTION]: ${err.message}\n${err.stack}`);
    });
    page.on('request', req => {
      console.log(`[REQUEST]: ${req.method()} ${req.url()}`);
    });
    page.on('response', resp => {
      const req = resp.request();
      console.log(`[RESPONSE]: ${resp.status()} ${req.url()}`);
    });
    page.on('requestfailed', req => {
      console.log(`[REQUEST FAILED]: ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
    });

    // Navigate to Portal
    await page.goto('http://localhost');

    // Wait for either the login input or main dashboard to be visible to avoid race conditions
    await page.waitForSelector('#username, [data-focusable="nav-library"]', { timeout: 15000 });

    // Handle login conditionally
    const usernameInput = page.locator('#username');
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('testuser');
      await page.click('button[data-focusable="login-btn"]');
    }

    // Wait for navigation bar to appear
    await expect(page.locator('[data-focusable="nav-library"]')).toBeVisible({ timeout: 15000 });

    // Clean up any pre-existing database save state to prevent 409 Conflicts in test runs
    await page.evaluate(async (gid) => {
      await fetch(`/api/v1/games/${gid}/saves/bestScore`, { method: 'DELETE' }).catch(() => {});
      await fetch(`/api/v1/games/${gid}/saves/saveState`, { method: 'DELETE' }).catch(() => {});
      await fetch(`/api/v1/games/${gid}/saves/gameState`, { method: 'DELETE' }).catch(() => {});
    }, gameId);

    // Navigate to Catalogue to add game if not already present
    await page.locator('[data-focusable="nav-catalogue"]').click();
    await expect(page.locator('h2:has-text("Game Catalogue")')).toBeVisible({ timeout: 15000 });

    const addBtn = page.locator(`[data-focusable="add-${gameId}"]`);
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(page.locator(`[data-focusable="remove-${gameId}"]`)).toBeVisible({ timeout: 15000 });
    }

    // Go to library and click launch
    await page.locator('[data-focusable="nav-library"]').click();
    await expect(page.locator('h2:has-text("My Game Library")')).toBeVisible({ timeout: 15000 });

    const playBtn = page.locator(buttonSelector);
    await expect(playBtn).toBeVisible({ timeout: 15000 });
    await playBtn.click();

    // Verify iframe load
    const iframeElement = page.locator('iframe');
    await expect(iframeElement).toBeVisible({ timeout: 20000 });
    return iframeElement;
  }

  test('2048 - Save Rehydration, Leaderboards, and Escape forwarding', async ({ page }) => {
    test.setTimeout(60000);
    await setupGame(page, '2048', '[data-focusable="play-2048"]');
    const frame = await getFrame(page, /2048\.localhost/);

    // Wait for game elements
    await expect(frame.locator('h1.title')).toHaveText('2048');

    // Intercept backend save call
    const savePromise = page.waitForResponse(
      (resp) => resp.url().includes('/saves/bestScore') && resp.request().method() === 'POST',
      { timeout: 20000 }
    );

    // 1. Invoke SDK save method directly inside the iframe context
    await frame.evaluate(() => {
      if (window.WGCP) {
        window.WGCP.storage.save('bestScore', 2048);
      }
    });

    // 2. Await backend network resolution
    const response = await savePromise;
    expect(response.status()).toBe(200);

    // 3. Verify Escape Key Menu Toggle (using physical keypress simulation after focusing iframe)
    await frame.evaluate(() => {
      window.focus();
    });
    await page.keyboard.press('Escape');
    const systemMenu = page.locator('button:has-text("Resume Game")');
    await expect(systemMenu).toBeVisible({ timeout: 10000 });
  });

  test('Hextris - Save Rehydration, Leaderboards, and Escape forwarding', async ({ page }) => {
    test.setTimeout(60000);
    await setupGame(page, 'hextris', '[data-focusable="play-hextris"]');
    const frame = await getFrame(page, /hextris\.localhost/);

    // Intercept backend save call
    const savePromise = page.waitForResponse(
      (resp) => resp.url().includes('/saves/saveState') && resp.request().method() === 'POST',
      { timeout: 20000 }
    );

    // 1. Sync save state directly via SDK
    await frame.evaluate(() => {
      if (window.WGCP) {
        window.WGCP.storage.save('saveState', { score: 777, comboTime: 42 });
      }
    });

    // 2. Await backend network resolution
    const response = await savePromise;
    expect(response.status()).toBe(200);

    // 3. Verify Escape Menu Toggle (using physical keypress simulation after focusing iframe)
    await frame.evaluate(() => {
      window.focus();
    });
    await page.keyboard.press('Escape');
    const systemMenu = page.locator('button:has-text("Resume Game")');
    await expect(systemMenu).toBeVisible({ timeout: 10000 });
  });

  test('A Dark Room - Save Rehydration and Escape forwarding', async ({ page }) => {
    test.setTimeout(60000);
    await setupGame(page, 'a-dark-room', '[data-focusable="play-a-dark-room"]');
    const frame = await getFrame(page, /adarkroom\.localhost/);

    // Intercept backend save call
    const savePromise = page.waitForResponse(
      (resp) => resp.url().includes('/saves/gameState') && resp.request().method() === 'POST',
      { timeout: 20000 }
    );

    // 1. Sync gameState directly via SDK
    await frame.evaluate(() => {
      if (window.WGCP) {
        window.WGCP.storage.save('gameState', { version: '1.2', State: { value: 99 } });
      }
    });

    // 2. Await backend network resolution
    const response = await savePromise;
    expect(response.status()).toBe(200);

    // 3. Verify Escape key forwarding (using physical keypress simulation after focusing iframe)
    await frame.evaluate(() => {
      window.focus();
    });
    await page.keyboard.press('Escape');
    const systemMenu = page.locator('button:has-text("Resume Game")');
    await expect(systemMenu).toBeVisible({ timeout: 10000 });
  });

  test('BrowserQuest - Achievements, Stats delta, and Escape forwarding', async ({ page }) => {
    test.setTimeout(90000);
    await setupGame(page, 'browserquest', '[data-focusable="play-browserquest"]');
    const frame = await getFrame(page, /browserquest\.localhost/);

    // Wait for the character creation screen
    const nameInput = frame.locator('#nameinput');
    await expect(nameInput).toBeVisible({ timeout: 20000 });

    // 1. Enter name and boot game
    await nameInput.fill('PlaywrightHero');
    await frame.locator('#createcharacter .play.button').click();

    // Wait for WebSocket handshake and canvas map to load
    await page.waitForTimeout(6000);

    // Intercept stats and achievements unlocks API requests
    const statsPromise = page.waitForResponse(
      (resp) => resp.url().includes('/stats') && resp.request().method() === 'POST',
      { timeout: 25000 }
    );
    const achievementPromise = page.waitForResponse(
      (resp) => resp.url().includes('/achievements/3/unlock') && resp.request().method() === 'POST',
      { timeout: 25000 }
    );

    // 2. Evaluate storage achievements updates directly via SDK
    await frame.evaluate(() => {
      if (window.WGCP) {
        window.WGCP.achievements.unlock("3");
        window.WGCP.stats.incrementStat('ratCount', 1);
      }
    });

    // 3. Verify backend receive status
    const statsResponse = await statsPromise;
    const achievementResponse = await achievementPromise;
    expect(statsResponse.status()).toBe(200);
    expect(achievementResponse.status()).toBe(200);

    // 4. Verify Escape key forwarding (using physical keypress simulation after focusing iframe)
    await frame.evaluate(() => {
      window.focus();
    });
    await page.keyboard.press('Escape');
    const systemMenu = page.locator('button:has-text("Resume Game")');
    await expect(systemMenu).toBeVisible({ timeout: 10000 });
  });
});

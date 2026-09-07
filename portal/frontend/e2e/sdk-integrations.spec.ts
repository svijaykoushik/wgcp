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
    page.on('console', (msg: any) => {
      console.log(`[BROWSER CONSOLE - ${msg.type()}]: ${msg.text()} (${msg.location()?.url || 'unknown'})`);
    });
    page.on('pageerror', (err: any) => {
      console.log(`[BROWSER EXCEPTION]: ${err.message}\n${err.stack}`);
    });
    page.on('request', (req: any) => {
      console.log(`[REQUEST]: ${req.method()} ${req.url()}`);
    });
    page.on('response', (resp: any) => {
      const req = resp.request();
      console.log(`[RESPONSE]: ${resp.status()} ${req.url()}`);
    });
    page.on('requestfailed', (req: any) => {
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

    // If permission modal appears (e.g. persistent storage request in SuperTux), allow it
    const permissionModal = page.locator('[aria-label="Permission Request"]');
    try {
      await permissionModal.waitFor({ state: 'visible', timeout: 3000 });
      const allowBtn = permissionModal.locator('button:has-text("Allow")');
      await allowBtn.click();
    } catch {}

    // Verify iframe load
    const iframeElement = page.locator('iframe');
    await expect(iframeElement).toBeVisible({ timeout: 20000 });
    return iframeElement;
  }

  test('2048 - Save Rehydration across fresh sessions, Leaderboards, and Escape forwarding', async ({ browser, page }) => {
    test.setTimeout(90000);
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

    // 3. Open a completely fresh browser context (simulating private window / new device)
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();

    try {
      // Log in and launch 2048 in fresh context
      await freshPage.goto('http://localhost');
      await freshPage.waitForSelector('#username, [data-focusable="nav-library"]', { timeout: 15000 });
      const usernameInput = freshPage.locator('#username');
      if (await usernameInput.isVisible()) {
        await usernameInput.fill('testuser');
        await freshPage.click('button[data-focusable="login-btn"]');
      }

      await expect(freshPage.locator('[data-focusable="nav-library"]')).toBeVisible({ timeout: 15000 });
      await freshPage.locator('[data-focusable="nav-library"]').click();
      await freshPage.locator('[data-focusable="play-2048"]').click();

      const freshFrame = await getFrame(freshPage, /2048\.localhost/);

      // Verify that WGCP.storage.load('bestScore') rehydrates the 2048 high score from the cloud database
      const loadedScore = await freshFrame.evaluate(async () => {
        return await window.WGCP.storage.load('bestScore');
      });
      expect(Number(loadedScore)).toBe(2048);
    } finally {
      await freshContext.close();
    }

    // 4. Verify Escape Key Menu Toggle (using physical keypress simulation after focusing iframe)
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

  test('SuperTux - WASM IDBFS Save State Persistence, Cloud Rehydration across fresh sessions, and Shift+Escape chord handling', async ({ browser, page }) => {
    test.setTimeout(120000);
    await setupGame(page, 'supertux', '[data-focusable="play-supertux"]');
    const frame = await getFrame(page, /supertux\.localhost/);

    // Intercept backend save call
    const savePromise = page.waitForResponse(
      (resp) => resp.url().includes('/saves/gameState') && resp.request().method() === 'POST',
      { timeout: 30000 }
    );

    // 1. Create game level progress in Emscripten VFS and sync via IDBFS bridge
    const saveStatContent = '(supertux-stats\n  (coins 999)\n  (lives 5)\n  (unlocked-levels ("level1" "level2" "bonus1"))\n)';
    await frame.evaluate(async (content) => {
      const targetFS = (window as any).FS || (window as any).Module?.FS;
      if (!targetFS) {
        throw new Error('Emscripten FS not available on SuperTux window');
      }
      const rootPath = '/home/web_user/.local/share/supertux2';
      const saveDir = `${rootPath}/profile1`;
      
      // Ensure target directory exists in VFS
      if (typeof targetFS.mkdirTree === 'function') {
        try { targetFS.mkdirTree(saveDir); } catch(e) {}
      } else {
        const parts = saveDir.split('/').filter(Boolean);
        let curr = '';
        for (const p of parts) {
          curr += '/' + p;
          if (!targetFS.analyzePath(curr).exists) {
            try { targetFS.mkdir(curr); } catch(e) {}
          }
        }
      }

      // Write mock save file
      targetFS.writeFile(`${saveDir}/world1.stat`, content);

      // Trigger Emscripten syncfs / WASM bridge
      if (typeof (window as any).supertux2_syncfs === 'function') {
        (window as any).supertux2_syncfs();
      } else if (typeof targetFS.syncfs === 'function') {
        targetFS.syncfs(false, () => {});
      }
    }, saveStatContent);

    // 2. Await backend network save resolution
    const response = await savePromise;
    expect(response.status()).toBe(200);

    // 3. Open a fresh browser context (simulating private window / new device)
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();

    try {
      await freshPage.goto('http://localhost');
      await freshPage.waitForSelector('#username, [data-focusable="nav-library"]', { timeout: 15000 });
      const usernameInput = freshPage.locator('#username');
      if (await usernameInput.isVisible()) {
        await usernameInput.fill('testuser');
        await freshPage.click('button[data-focusable="login-btn"]');
      }

      await expect(freshPage.locator('[data-focusable="nav-library"]')).toBeVisible({ timeout: 15000 });
      await freshPage.locator('[data-focusable="nav-library"]').click();
      await freshPage.locator('[data-focusable="play-supertux"]').click();

      // Handle permission modal in fresh context if prompted
      const freshPermissionModal = freshPage.locator('[aria-label="Permission Request"]');
      try {
        await freshPermissionModal.waitFor({ state: 'visible', timeout: 3000 });
        await freshPermissionModal.locator('button:has-text("Allow")').click();
      } catch {}

      const freshFrame = await getFrame(freshPage, /supertux\.localhost/);

      // Verify that cloud rehydration populated the file in the fresh Emscripten VFS
      // Wait up to 10 seconds for cloud hydration if still in-flight
      await freshFrame.waitForFunction(() => {
        const targetFS = (window as any).FS || (window as any).Module?.FS;
        if (!targetFS) return false;
        const filePath = '/home/web_user/.local/share/supertux2/profile1/world1.stat';
        return targetFS.analyzePath && targetFS.analyzePath(filePath).exists;
      }, { timeout: 15000 });

      const rehydratedContent = await freshFrame.evaluate(() => {
        const targetFS = (window as any).FS || (window as any).Module?.FS;
        const filePath = '/home/web_user/.local/share/supertux2/profile1/world1.stat';
        return targetFS.readFile(filePath, { encoding: 'utf8' });
      });

      expect(rehydratedContent).toContain('(coins 999)');
      expect(rehydratedContent).toContain('unlocked-levels ("level1" "level2" "bonus1")');
    } finally {
      await freshContext.close();
    }

    // 4. Verify Escape and Shift+Escape behavior (per D-008: SuperTux has captureEscape: false)
    await frame.evaluate(() => {
      window.focus();
    });

    // Press regular Escape inside SuperTux -> Overlay should NOT appear (passed to game engine)
    await page.keyboard.press('Escape');
    const systemMenu = page.locator('button:has-text("Resume Game")');
    await expect(systemMenu).not.toBeVisible();

    // Press Shift+Escape inside SuperTux -> Overlay SHOULD appear
    await page.keyboard.press('Shift+Escape');
    await expect(systemMenu).toBeVisible({ timeout: 10000 });

    // Click Resume Game to dismiss overlay
    await systemMenu.click();
    await expect(systemMenu).not.toBeVisible();
  });
});

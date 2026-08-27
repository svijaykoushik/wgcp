import { test, expect } from '@playwright/test';

test.describe('Portal Game Launch Viewport and Overflow E2E Test', () => {
  test('Launches SuperTux and verifies it occupies the full viewport without overflow', async ({ page }) => {
    // 1. Go to Portal login page
    await page.goto('http://localhost');
    await expect(page.locator('h1')).toHaveText('Arcade Portal');

    // 2. Fill username and click Log In
    await page.fill('#username', 'testuser');
    await page.click('button[data-focusable="login-btn"]');

    // 3. Navigate to Catalogue to ensure SuperTux is in library
    const navCatalogue = page.locator('[data-focusable="nav-catalogue"]');
    await navCatalogue.click();
    await expect(page.locator('h2')).toHaveText('Game Catalogue');

    const addSupertuxBtn = page.locator('[data-focusable="add-supertux"]');
    const inLibraryText = page.locator('text=✓ In Library').first();
    
    if (await addSupertuxBtn.isVisible()) {
      await addSupertuxBtn.click();
      await expect(inLibraryText).toBeVisible();
    } else {
      await expect(inLibraryText).toBeVisible();
    }

    // 4. Go to My Library view
    await page.locator('[data-focusable="nav-library"]').click();
    await expect(page.locator('h2')).toHaveText('My Game Library');

    // 5. Click "Play Game" on SuperTux
    const playSupertuxBtn = page.locator('[data-focusable="play-supertux"]');
    await playSupertuxBtn.click();

    // 6. Wait for the game launcher iframe to be rendered
    const iframeElement = page.locator('iframe');
    await expect(iframeElement).toBeVisible();

    // 7. Verify the iframe occupies the exact size of the viewport (no bounds overflow)
    const viewportSize = page.viewportSize();
    expect(viewportSize).not.toBeNull();
    const { width: viewWidth, height: viewHeight } = viewportSize!;

    const box = await iframeElement.boundingBox();
    expect(box).not.toBeNull();
    const { x, y, width, height } = box!;

    expect(x).toBe(0);
    expect(y).toBe(0);
    expect(width).toBe(viewWidth);
    expect(height).toBe(viewHeight);

    // 8. Verify the page layout has no vertical or horizontal scroll overflow
    const overflow = await page.evaluate(() => {
      const docEl = document.documentElement;
      return {
        scrollHeight: docEl.scrollHeight,
        clientHeight: docEl.clientHeight,
        scrollWidth: docEl.scrollWidth,
        clientWidth: docEl.clientWidth,
        hasVerticalScroll: docEl.scrollHeight > window.innerHeight,
        hasHorizontalScroll: docEl.scrollWidth > window.innerWidth,
        bodyOverflow: window.getComputedStyle(document.body).overflow,
        htmlOverflow: window.getComputedStyle(docEl).overflow,
      };
    });

    expect(overflow.hasVerticalScroll).toBe(false);
    expect(overflow.hasHorizontalScroll).toBe(false);
    expect(overflow.scrollHeight).toBe(overflow.clientHeight);
    expect(overflow.scrollWidth).toBe(overflow.clientWidth);

    // 9. Verify the iframe parent container also has no layout overflow
    const parentContainer = page.locator('div.fixed.inset-0');
    const parentOverflow = await parentContainer.evaluate((el) => {
      return {
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    });

    expect(parentOverflow.scrollHeight).toBe(parentOverflow.clientHeight);
    expect(parentOverflow.scrollWidth).toBe(parentOverflow.clientWidth);
  });
});

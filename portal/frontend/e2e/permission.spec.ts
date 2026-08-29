import { test, expect } from '@playwright/test';

test.describe('Portal Web API Permission Delegation E2E Test', () => {
  test('Launches SuperTux, delegates persistent storage request to portal, and verifies no denied warning', async ({ page, context }) => {
    // 1. Mock navigator.storage.persist on the parent portal page to return true
    await page.addInitScript(() => {
      if (window.location.origin === 'http://localhost') {
        Object.defineProperty(navigator, 'storage', {
          value: {
            persist: async () => true,
          },
          configurable: true,
          writable: true,
        });
      }
    });

    // 2. Intercept the SuperTux iframe load and override its navigator.storage.persist
    // to simulate the WGCP SDK behavior (delegating permission requests to the portal parent via postMessage)
    await context.addInitScript(() => {
      // Apply only to the supertux game iframe
      if (window.location.hostname === 'supertux.localhost') {
        const correlationId = 'c2b489a2-97b7-4a41-b844-3d077d71be21';
        
        Object.defineProperty(navigator, 'storage', {
          value: {
            persist: async () => {
              return new Promise((resolve) => {
                // Set up the listener for the portal's ACK reply
                const messageHandler = (event: MessageEvent) => {
                  if (
                    event.origin === 'http://localhost' &&
                    event.data &&
                    event.data.type === 'WGCP_REQUEST_PERMISSION_ACK' &&
                    event.data.id === correlationId
                  ) {
                    window.removeEventListener('message', messageHandler);
                    resolve(event.data.payload.granted);
                  }
                };
                
                window.addEventListener('message', messageHandler);
                
                // Dispatch permission request to the parent portal
                window.parent.postMessage(
                  {
                    id: correlationId,
                    type: 'WGCP_REQUEST_PERMISSION',
                    source: 'WGCP_SDK',
                    version: '2.0.0',
                    payload: { permission: 'persistent-storage' },
                  },
                  'http://localhost'
                );
              });
            },
          },
          configurable: true,
          writable: true,
        });
      }
    });

    // 3. Go to Portal login page
    await page.goto('http://localhost');
    await expect(page.locator('h1')).toHaveText('Arcade Portal');

    // 4. Fill username and click Log In
    await page.fill('#username', 'testuser');
    await page.click('button[data-focusable="login-btn"]');

    // 5. Navigate to Catalogue to add SuperTux to library
    // Click "All Games" in the navbar to go to the catalogue view
    const navCatalogue = page.locator('[data-focusable="nav-catalogue"]');
    await navCatalogue.click();

    // Wait for the catalogue view to render
    await expect(page.locator('h2')).toHaveText('Game Catalogue');

    // Click "Add to Library" for SuperTux if not already in library
    const addSupertuxBtn = page.locator('[data-focusable="add-supertux"]');
    const inLibraryText = page.locator('text=✓ In Library').first();
    
    if (await addSupertuxBtn.isVisible()) {
      await addSupertuxBtn.click();
      await expect(inLibraryText).toBeVisible();
    } else {
      await expect(inLibraryText).toBeVisible();
    }

    // 6. Go to My Library view
    await page.locator('[data-focusable="nav-library"]').click();
    await expect(page.locator('h2')).toHaveText('My Game Library');

    // 7. Click "Play Game" on SuperTux
    const playSupertuxBtn = page.locator('[data-focusable="play-supertux"]');
    await playSupertuxBtn.click();

    // 8. Expect the game to be loaded in iframe
    // Wait for the iframe to load
    const iframeElement = page.locator('iframe');
    await expect(iframeElement).toBeVisible();

    // Verify it has the correct allow attributes and matching src
    await expect(iframeElement).toHaveAttribute('src', /supertux\.localhost/);
    await expect(iframeElement).toHaveAttribute('allow', /persistent-storage/);

    // Verify the permission request modal is displayed in the parent portal
    const permissionModal = page.locator('[aria-label="Permission Request"]');
    await expect(permissionModal).toBeVisible();

    // Click "Allow" on the portal's permission modal
    const allowBtn = permissionModal.locator('button:has-text("Allow")');
    await allowBtn.click();

    // Verify the permission modal is closed
    await expect(permissionModal).not.toBeVisible();

    // Wait for the iframe to load its content
    const frame = page.frame({ url: /supertux\.localhost/ });
    expect(frame).not.toBeNull();

    // Wait for the game's downloading spinner or overlay status
    const spinner = frame!.locator('#spinner');
    await expect(spinner).toBeVisible();

    // 9. Verify the warning text "Your browser denied persistent data." is NOT shown
    // In SuperTux, if granted is false, #data_warning is filled with the warning text.
    // If granted is true, it remains empty or shows nothing.
    const dataWarning = frame!.locator('#data_warning');
    await expect(dataWarning).not.toContainText('Your browser denied persistent data');
  });
});

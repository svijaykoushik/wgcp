---
type: Proposal
proposal_id: P-004
title: Viewport-First Game Launch Refactoring
description: Refactor the game launch process to use full viewport by default rather than the Fullscreen API, pushing fullscreen options to the platform menu.
status: accepted
generated: { by: antigravity/3.5, at: 2026-08-27T23:45:00+05:30 }
sources:
  - id: launcherview-src
    resource: /portal/frontend/src/views/LauncherView.tsx
    title: Portal LauncherView Component
  - id: systemmenuoverlay-src
    resource: /portal/frontend/src/components/SystemMenuOverlay.tsx
    title: Portal SystemMenuOverlay Component
---

# Viewport-First Game Launch Refactoring (P-004)

This proposal refactors the game launch process in the Web Game Console Platform (WGCP) arcade portal. Currently, launching a game automatically requests browser fullscreen mode via the Fullscreen API, which can feel intrusive or fail on browsers requiring explicit user activation. 

We propose using a **viewport-first** approach: launching games in full-viewport mode by default (leveraging the existing layout structure) and delegating Fullscreen API requests to a dedicated menu action within the system overlay.

---

## 1. Background & Rationale

When a user launches a game, `LauncherView.tsx` automatically invokes `document.documentElement.requestFullscreen()`[^launcherview-src]. 

### Drawbacks of Current Implementation:
1. **Intrusiveness**: Forcing browser-level fullscreen immediately on launch removes standard browser navigation controls, which can disrupt the user experience.
2. **Browser Permissions & Constraints**: Many modern web browsers block unsolicited `requestFullscreen()` calls unless they are triggered directly inside an ephemeral user event (like clicking a play button). By separating launch transitions from fullscreen activation, we improve platform compatibility.
3. **Consistency**: Moving fullscreen management to the central Platform / System Menu provides a clean, console-like setting structure.

---

## 2. Proposed Changes

### 2.1. LauncherView Refactoring (`LauncherView.tsx`)
1. **Remove Autostart Fullscreen**: Remove the Fullscreen API calls from the post-launch handler (`handleLaunchComplete`) and the game resume handler (`resumeGame`).
2. **Fullscreen State Tracking**: Introduce a React state variable `isFullscreen` to reflect whether the browser is currently in fullscreen mode.
3. **Event Subscriptions**: Use the existing `fullscreenchange` / `webkitfullscreenchange` listeners to synchronise the `isFullscreen` state dynamically.
4. **Fullscreen Toggle Handler**: Add a function `toggleFullscreen` to encapsulate entering and exiting browser fullscreen.
5. **Prop Delegation**: Pass `isFullscreen` and the `toggleFullscreen` callback down into `<SystemMenuOverlay />`.

### 2.2. Platform Menu Additions (`SystemMenuOverlay.tsx`)
1. **New Button Option**: Add an extra button in the `SystemMenuOverlay` list of options to toggle fullscreen status:
   * Label: `⛶ Enter Fullscreen` (when windowed/full-viewport)
   * Label: `⛶ Exit Fullscreen` (when browser is fullscreen)
2. **Prop Bindings**: Connect the button `onClick` event to the delegated toggle callback from `LauncherView`.

---

## 3. Implementation Blueprint

### 3.1. LauncherView State and Handlers
We will adjust the component to track the current fullscreen element and toggle it when invoked:

```typescript
const [isFullscreen, setIsFullscreen] = useState(
  () => typeof document !== 'undefined' && !!(
    document.fullscreenElement || (document as any).webkitFullscreenElement
  )
);

const toggleFullscreen = async () => {
  const isFs = !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement
  );
  if (isFs) {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      await (document as any).webkitExitFullscreen();
    }
  } else {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    } else if ((el as any).webkitRequestFullscreen) {
      await (el as any).webkitRequestFullscreen();
    }
  }
};
```

### 3.2. System Menu Button Design
In `SystemMenuOverlay.tsx`[^systemmenuoverlay-src], we will render the fullscreen button between `Resume Game` and `Exit to Library`:

```tsx
<button
  type="button"
  onClick={onToggleFullscreen}
  className="w-full py-3 px-4 bg-bg-primary hover:bg-bg-primary/80 border border-white/12 text-text-muted hover:text-white font-semibold rounded-xl transition-all active:scale-95 console-focusable cursor-pointer"
>
  {isFullscreen ? '⛶ Exit Fullscreen' : '⛶ Enter Fullscreen'}
</button>
```

---

## 4. Verification and Retrofitting

1. **Verify Sandbox Attributes**: Ensure the `allow="fullscreen"` attribute remains active on the game iframe to permit permission delegation if a game itself decides to request fullscreen internally.
2. **Test Assertions**: Update or introduce tests checking that LauncherView mounts and focuses the iframe without triggering automatic fullscreen requests.

[^launcherview-src]: View original launch logic in `/portal/frontend/src/views/LauncherView.tsx`.
[^systemmenuoverlay-src]: View menu structure in `/portal/frontend/src/components/SystemMenuOverlay.tsx`.

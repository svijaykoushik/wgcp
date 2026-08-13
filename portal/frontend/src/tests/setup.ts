import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock the global fetch
(globalThis as any).fetch = vi.fn();

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Fullscreen API
Object.defineProperty(document.documentElement, 'requestFullscreen', {
  writable: true,
  value: vi.fn().mockResolvedValue(undefined),
});

Object.defineProperty(document, 'exitFullscreen', {
  writable: true,
  value: vi.fn().mockResolvedValue(undefined),
});

// Mock Gamepad API
Object.defineProperty(navigator, 'getGamepads', {
  writable: true,
  value: vi.fn().mockReturnValue([null, null, null, null]),
});

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

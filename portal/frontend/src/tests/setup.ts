import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock the global fetch
(globalThis as any).fetch = vi.fn();

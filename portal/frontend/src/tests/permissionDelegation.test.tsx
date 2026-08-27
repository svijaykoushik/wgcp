import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import LauncherView from '../views/LauncherView';
import { Game } from '../types';

// Mock LaunchSequence to render instantly to avoid timeouts in tests
vi.mock('../components/LaunchSequence', () => {
  return {
    default: ({ game, onComplete }: any) => {
      React.useEffect(() => {
        onComplete();
      }, [onComplete]);
      return <div>Mocked Launch Sequence for {game.name}</div>;
    },
    LaunchSequence: ({ game, onComplete }: any) => {
      React.useEffect(() => {
        onComplete();
      }, [onComplete]);
      return <div>Mocked Launch Sequence for {game.name}</div>;
    }
  };
});

describe('Web API Permission Delegation Test Suite', () => {
  const mockGame: Game = {
    id: 'hextris',
    name: 'Hextris',
    url: 'http://hextris.localhost',
    hosting: {
      hostname: 'hextris.localhost',
      capabilities: ['gamepad', 'fullscreen']
    },
    runtime: {
      service: 'game-hextris',
      port: 80
    },
    metadata: {
      description: 'Hexagonal puzzle',
      developer: 'Developer Name',
      genre: 'Puzzle',
      icon: '⬡'
    }
  };

  const mockExit = vi.fn();
  let originalStorage: any;

  beforeEach(() => {
    vi.clearAllMocks();
    originalStorage = (navigator as any).storage;
  });

  afterEach(() => {
    if (originalStorage) {
      Object.defineProperty(navigator, 'storage', {
        value: originalStorage,
        configurable: true,
        writable: true,
      });
    } else {
      // @ts-ignore
      delete navigator.storage;
    }
  });

  test('Successfully requests and grants persistent storage permission', async () => {
    // 1. Mock browser navigator.storage.persist to return true
    const mockPersist = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'storage', {
      value: {
        persist: mockPersist,
      },
      configurable: true,
      writable: true,
    });

    // 2. Render LauncherView
    render(<LauncherView game={mockGame} onExit={mockExit} />);

    // Wait for the iframe to be rendered
    await waitFor(() => {
      expect(document.querySelector('iframe')).toBeInTheDocument();
    });

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (!iframe || !iframe.contentWindow) {
      throw new Error('Iframe contentWindow not found');
    }

    // Spy on iframe contentWindow's postMessage
    const postMessageSpy = vi.spyOn(iframe.contentWindow, 'postMessage');

    // 3. Dispatch a mock WGCP_REQUEST_PERMISSION message event to the window
    const correlationId = 'c2b489a2-97b7-4a41-b844-3d077d71be21'; // Valid UUIDv4
    const messageEvent = new MessageEvent('message', {
      data: {
        id: correlationId,
        type: 'WGCP_REQUEST_PERMISSION',
        source: 'WGCP_SDK',
        version: '2.0.0',
        payload: { permission: 'persistent-storage' }
      },
      origin: 'http://hextris.localhost',
    });

    // Enforce conjunctive sender window check in JSDOM
    Object.defineProperty(messageEvent, 'source', { value: iframe.contentWindow });

    await new Promise((resolve) => setTimeout(resolve, 20));
    window.dispatchEvent(messageEvent);

    // 4. Expect portal to request the browser for permission and reply back with granted = true
    await waitFor(() => {
      expect(mockPersist).toHaveBeenCalledTimes(1);
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          id: correlationId,
          type: 'WGCP_REQUEST_PERMISSION_ACK',
          source: 'WGCP_PORTAL',
          version: '2.0.0',
          payload: { permission: 'persistent-storage', granted: true }
        },
        'http://hextris.localhost'
      );
    });
  });

  test('Returns granted = false when browser persistent storage request is denied', async () => {
    // 1. Mock browser navigator.storage.persist to return false (denied)
    const mockPersist = vi.fn().mockResolvedValue(false);
    Object.defineProperty(navigator, 'storage', {
      value: {
        persist: mockPersist,
      },
      configurable: true,
      writable: true,
    });

    render(<LauncherView game={mockGame} onExit={mockExit} />);

    await waitFor(() => {
      expect(document.querySelector('iframe')).toBeInTheDocument();
    });

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (!iframe || !iframe.contentWindow) {
      throw new Error('Iframe contentWindow not found');
    }

    const postMessageSpy = vi.spyOn(iframe.contentWindow, 'postMessage');

    const correlationId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'; // Valid UUIDv4
    const messageEvent = new MessageEvent('message', {
      data: {
        id: correlationId,
        type: 'WGCP_REQUEST_PERMISSION',
        source: 'WGCP_SDK',
        version: '2.0.0',
        payload: { permission: 'persistent-storage' }
      },
      origin: 'http://hextris.localhost',
    });

    Object.defineProperty(messageEvent, 'source', { value: iframe.contentWindow });

    await new Promise((resolve) => setTimeout(resolve, 20));
    window.dispatchEvent(messageEvent);

    await waitFor(() => {
      expect(mockPersist).toHaveBeenCalledTimes(1);
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          id: correlationId,
          type: 'WGCP_REQUEST_PERMISSION_ACK',
          source: 'WGCP_PORTAL',
          version: '2.0.0',
          payload: { permission: 'persistent-storage', granted: false }
        },
        'http://hextris.localhost'
      );
    });
  });

  test('Rejects request if message origin is invalid / spoofed', async () => {
    const mockPersist = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'storage', {
      value: {
        persist: mockPersist,
      },
      configurable: true,
      writable: true,
    });

    render(<LauncherView game={mockGame} onExit={mockExit} />);

    await waitFor(() => {
      expect(document.querySelector('iframe')).toBeInTheDocument();
    });

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (!iframe || !iframe.contentWindow) {
      throw new Error('Iframe contentWindow not found');
    }

    const postMessageSpy = vi.spyOn(iframe.contentWindow, 'postMessage');

    const correlationId = '12345678-1234-4234-8234-123456789012'; // Valid UUIDv4
    const messageEvent = new MessageEvent('message', {
      data: {
        id: correlationId,
        type: 'WGCP_REQUEST_PERMISSION',
        source: 'WGCP_SDK',
        version: '2.0.0',
        payload: { permission: 'persistent-storage' }
      },
      origin: 'http://malicious-origin.com', // Wrong origin
    });

    Object.defineProperty(messageEvent, 'source', { value: iframe.contentWindow });

    window.dispatchEvent(messageEvent);

    // Give some time to confirm nothing was called
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockPersist).not.toHaveBeenCalled();
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  test('Rejects request if source window is invalid / spoofed', async () => {
    const mockPersist = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'storage', {
      value: {
        persist: mockPersist,
      },
      configurable: true,
      writable: true,
    });

    render(<LauncherView game={mockGame} onExit={mockExit} />);

    await waitFor(() => {
      expect(document.querySelector('iframe')).toBeInTheDocument();
    });

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (!iframe || !iframe.contentWindow) {
      throw new Error('Iframe contentWindow not found');
    }

    const postMessageSpy = vi.spyOn(iframe.contentWindow, 'postMessage');

    const correlationId = '12345678-1234-4234-8234-123456789012'; // Valid UUIDv4
    const messageEvent = new MessageEvent('message', {
      data: {
        id: correlationId,
        type: 'WGCP_REQUEST_PERMISSION',
        source: 'WGCP_SDK',
        version: '2.0.0',
        payload: { permission: 'persistent-storage' }
      },
      origin: 'http://hextris.localhost',
    });

    // spoof source as another window (or window parent itself)
    Object.defineProperty(messageEvent, 'source', { value: window });

    window.dispatchEvent(messageEvent);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockPersist).not.toHaveBeenCalled();
    expect(postMessageSpy).not.toHaveBeenCalled();
  });
});

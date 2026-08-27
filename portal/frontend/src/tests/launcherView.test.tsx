import React from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import LauncherView from '../views/LauncherView';
import { Game } from '../types';

// Mock LaunchSequence to render instantly to avoid timeouts
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

describe('LauncherView Fullscreen Characterization', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // PHASE 4: Flipped Pins (Viewport-First Verification)
  // ==========================================
  test('[FLIPPED PIN] does not request fullscreen automatically on launch completion', async () => {
    const requestFullscreenSpy = vi.spyOn(document.documentElement, 'requestFullscreen');
    
    render(<LauncherView game={mockGame} onExit={mockExit} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /⚙ System Menu/i })).toBeInTheDocument();
    });

    expect(requestFullscreenSpy).not.toHaveBeenCalled();
  });

  test('[FLIPPED PIN] does not request fullscreen automatically on resume', async () => {
    const requestFullscreenSpy = vi.spyOn(document.documentElement, 'requestFullscreen');
    
    render(<LauncherView game={mockGame} onExit={mockExit} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /⚙ System Menu/i })).toBeInTheDocument();
    });

    requestFullscreenSpy.mockClear();

    // Trigger ESC to open the overlay
    fireEvent.keyDown(window, { key: 'Escape' });

    const resumeBtn = await screen.findByRole('button', { name: /Resume Game/i });
    fireEvent.click(resumeBtn);

    expect(requestFullscreenSpy).not.toHaveBeenCalled();
  });

  // ==========================================
  // PHASE 2: New & Upcoming Behavior
  // ==========================================
  test('[NEW] toggles fullscreen manually from the platform menu', async () => {
    const requestFullscreenSpy = vi.spyOn(document.documentElement, 'requestFullscreen');
    const exitFullscreenSpy = vi.spyOn(document, 'exitFullscreen');

    render(<LauncherView game={mockGame} onExit={mockExit} />);

    // Open system menu overlay
    const menuBtn = await screen.findByRole('button', { name: /⚙ System Menu/i });
    fireEvent.click(menuBtn);

    // Verify system menu is open and contains the Fullscreen button
    const fullscreenToggleBtn = await screen.findByRole('button', { name: /Enter Fullscreen/i });
    expect(fullscreenToggleBtn).toBeInTheDocument();

    // Click Enter Fullscreen
    fireEvent.click(fullscreenToggleBtn);
    expect(requestFullscreenSpy).toHaveBeenCalledTimes(1);

    // Mock document.fullscreenElement to simulate browser entering fullscreen
    Object.defineProperty(document, 'fullscreenElement', {
      value: document.documentElement,
      configurable: true,
    });

    // Dispatch fullscreenchange event to update the state
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });

    // Wait for the button text to change to Exit Fullscreen
    const exitFullscreenBtn = await screen.findByRole('button', { name: /Exit Fullscreen/i });
    expect(exitFullscreenBtn).toBeInTheDocument();

    // Click Exit Fullscreen
    fireEvent.click(exitFullscreenBtn);
    expect(exitFullscreenSpy).toHaveBeenCalledTimes(1);

    // Reset document.fullscreenElement
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
    });
  });
});

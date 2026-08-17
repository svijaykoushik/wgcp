import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import App from '../App';

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

describe('Frontend App flow tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Shows login page when unauthorized', async () => {
    // Mock unauthorized session check
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    render(<App />);

    // Expect loading state first
    expect(screen.getByText(/LOADING PLATFORM WORKSPACE/i)).toBeInTheDocument();

    // Expect transitions to login
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Log In/i })).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Username/i)).toHaveValue('testuser');
  });

  test('Succeeds login and renders empty library state with Browse CTA', async () => {
    // 1. Session check: unauthorized
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    // 2. Login call: success
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1, username: 'testuser' }),
    });

    // 3. Registry call
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ games: [] }),
    });

    // 4. Library call
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ([]),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Log In/i })).toBeInTheDocument();
    });

    // Perform Login
    fireEvent.click(screen.getByRole('button', { name: /Log In/i }));

    // Wait for empty library state
    await waitFor(() => {
      expect(screen.getByText(/Your library is currently empty/i)).toBeInTheDocument();
    });

    const browseBtn = screen.getByRole('button', { name: /Browse Catalogue/i });
    expect(browseBtn).toBeInTheDocument();
  });

  test('Browses catalogue and adds a game to the library', async () => {
    // 1. Session check: authorized
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1, username: 'testuser' }),
    });

    // 2. Registry call
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        games: [
          {
            id: 'hextris',
            name: 'Hextris',
            metadata: { description: 'Hexagonal puzzle', icon: '⬡', genre: 'Puzzle' },
          },
        ],
      }),
    });

    // 3. Library call (empty initially)
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ([]),
    });

    render(<App />);

    // Should load the empty library
    await waitFor(() => {
      expect(screen.getByText(/Your library is currently empty/i)).toBeInTheDocument();
    });

    // Click Browse Catalogue
    fireEvent.click(screen.getByRole('button', { name: /Browse Catalogue/i }));

    // Verify catalogue is shown with Hextris
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Hextris' })).toBeInTheDocument();
    });

    // Mock the POST call to add to library
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => (['hextris']),
    });

    // Click Add to Library
    fireEvent.click(screen.getByRole('button', { name: /Add to Library/i }));

    // Verify button changes or shows "In Library"
    await waitFor(() => {
      expect(screen.getByText(/✓ In Library/i)).toBeInTheDocument();
    });
  });

  test('Launches game from library with fallback capabilities', async () => {
    // 1. Session check: authorized
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1, username: 'testuser' }),
    });

    // 2. Registry call
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        games: [
          {
            id: 'hextris',
            name: 'Hextris',
            metadata: { description: 'Hexagonal puzzle', icon: '⬡', genre: 'Puzzle' },
          },
        ],
      }),
    });

    // 3. Library call (contains Hextris)
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => (['hextris']),
    });

    render(<App />);

    // Wait for Hextris card in library
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Hextris' })).toBeInTheDocument();
    });

    // Click Play Game
    const playBtn = screen.getByRole('button', { name: /Play Game/i });
    fireEvent.click(playBtn);

    // Verify system menu trigger button is rendered (meaning the launcher is active)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /⚙ System Menu/i })).toBeInTheDocument();
    });

    const iframe = document.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute('allow')).toBe('autoplay; fullscreen; gamepad; focus-without-user-activation; accelerometer; gyroscope; clipboard-read; clipboard-write');
  });

  test('Launches game from library with custom capabilities', async () => {
    // 1. Session check: authorized
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1, username: 'testuser' }),
    });

    // 2. Registry call (V2 format)
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        games: {
          hextris: {
            metadata: {
              name: { 'en-US': 'Hextris' },
              description: { 'en-US': 'Hexagonal puzzle' },
              graphics: { icon: { 'en-US': '⬡' } },
              categories: ['Puzzle']
            },
            releases: {
              'stable-v1': {
                version: '1.0.0',
                releaseChannels: ['stable'],
                whatsNew: { 'en-US': 'Updated' },
                runtime: { service: 'game-hextris', port: 80 },
                hosting: { hostname: 'hextris.localhost', capabilities: ['gamepad', 'fullscreen'] }
              }
            }
          }
        }
      }),
    });

    // 3. Library call (contains Hextris)
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => (['hextris']),
    });

    render(<App />);

    // Wait for Hextris card in library
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Hextris' })).toBeInTheDocument();
    });

    // Click Play Game
    const playBtn = screen.getByRole('button', { name: /Play Game/i });
    fireEvent.click(playBtn);

    // Verify system menu trigger button is rendered (meaning the launcher is active)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /⚙ System Menu/i })).toBeInTheDocument();
    });

    const iframe = document.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute('allow')).toBe('gamepad; fullscreen');
  });
});

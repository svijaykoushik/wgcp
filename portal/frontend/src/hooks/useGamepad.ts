import { useEffect, useRef } from 'react';
import { GamepadPoller } from '../engine/GamepadPoller';

export function useGamepad(enabled: boolean = true) {
  const pollerRef = useRef<GamepadPoller | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Track axis state to prevent rapid repeating
    let lastAxisX = 0;
    let lastAxisY = 0;

    const poller = new GamepadPoller((state, pressed) => {
      // Map D-pad to arrow keys
      if (pressed.dpadUp) dispatchKey('ArrowUp');
      if (pressed.dpadDown) dispatchKey('ArrowDown');
      if (pressed.dpadLeft) dispatchKey('ArrowLeft');
      if (pressed.dpadRight) dispatchKey('ArrowRight');

      // Map Left stick with deadzone threshold triggering once per push
      const axisThreshold = 0.5;
      
      if (state.axes.y < -axisThreshold && lastAxisY >= -axisThreshold) dispatchKey('ArrowUp');
      if (state.axes.y > axisThreshold && lastAxisY <= axisThreshold) dispatchKey('ArrowDown');
      if (state.axes.x < -axisThreshold && lastAxisX >= -axisThreshold) dispatchKey('ArrowLeft');
      if (state.axes.x > axisThreshold && lastAxisX <= axisThreshold) dispatchKey('ArrowRight');

      lastAxisX = state.axes.x;
      lastAxisY = state.axes.y;

      // Map A → Enter, B → Escape, Start → Escape (System menu)
      if (pressed.a) dispatchKey('Enter');
      if (pressed.b) dispatchKey('Escape');
      if (pressed.start) dispatchKey('Escape');

      // Map Bumpers → PageUp/PageDown for switching views
      if (pressed.leftBumper) dispatchKey('PageUp');
      if (pressed.rightBumper) dispatchKey('PageDown');
    });

    poller.start();
    pollerRef.current = poller;

    return () => {
      poller.stop();
    };
  }, [enabled]);
}

function dispatchKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  }));
}

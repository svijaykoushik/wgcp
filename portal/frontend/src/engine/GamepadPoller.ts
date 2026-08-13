export interface GamepadState {
  connected: boolean;
  axes: { x: number; y: number };  // Left stick
  buttons: {
    a: boolean;       // Confirm (Button 0)
    b: boolean;       // Back (Button 1)
    x: boolean;       // Secondary action (Button 2)
    y: boolean;       // Info/Details (Button 3)
    dpadUp: boolean;
    dpadDown: boolean;
    dpadLeft: boolean;
    dpadRight: boolean;
    start: boolean;   // System Menu
    select: boolean;  // Toggle view
    leftBumper: boolean;
    rightBumper: boolean;
  };
}

// Standard Gamepad Button Indices (W3C Standard Gamepad)
const BUTTON_MAP = {
  a: 0, b: 1, x: 2, y: 3,
  leftBumper: 4, rightBumper: 5,
  select: 8, start: 9,
  dpadUp: 12, dpadDown: 13, dpadLeft: 14, dpadRight: 15,
} as const;

const DEADZONE = 0.3;

export class GamepadPoller {
  private animFrameId: number | null = null;
  private lastState: GamepadState | null = null;
  private onInput: (state: GamepadState, pressed: Partial<GamepadState['buttons']>) => void;

  constructor(onInput: GamepadPoller['onInput']) {
    this.onInput = onInput;
  }

  start() {
    this.poll();
  }

  stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  private poll = () => {
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3]; // Any active gamepad

    if (gp) {
      const state = this.readState(gp);
      const pressed = this.detectNewPresses(state);
      if (Object.keys(pressed).length > 0 || Math.abs(state.axes.x) > DEADZONE || Math.abs(state.axes.y) > DEADZONE) {
        this.onInput(state, pressed);
      }
      this.lastState = state;
    }

    this.animFrameId = requestAnimationFrame(this.poll);
  };

  private readState(gp: Gamepad): GamepadState {
    const btn = (index: number) => gp.buttons[index]?.pressed ?? false;
    return {
      connected: true,
      axes: {
        x: Math.abs(gp.axes[0]) > DEADZONE ? gp.axes[0] : 0,
        y: Math.abs(gp.axes[1]) > DEADZONE ? gp.axes[1] : 0,
      },
      buttons: {
        a: btn(BUTTON_MAP.a),
        b: btn(BUTTON_MAP.b),
        x: btn(BUTTON_MAP.x),
        y: btn(BUTTON_MAP.y),
        dpadUp: btn(BUTTON_MAP.dpadUp),
        dpadDown: btn(BUTTON_MAP.dpadDown),
        dpadLeft: btn(BUTTON_MAP.dpadLeft),
        dpadRight: btn(BUTTON_MAP.dpadRight),
        start: btn(BUTTON_MAP.start),
        select: btn(BUTTON_MAP.select),
        leftBumper: btn(BUTTON_MAP.leftBumper),
        rightBumper: btn(BUTTON_MAP.rightBumper),
      },
    };
  }

  private detectNewPresses(current: GamepadState): Partial<GamepadState['buttons']> {
    if (!this.lastState) return current.buttons;
    const pressed: Partial<GamepadState['buttons']> = {};
    for (const [key, val] of Object.entries(current.buttons)) {
      const k = key as keyof GamepadState['buttons'];
      if (val && !this.lastState.buttons[k]) {
        pressed[k] = true;
      }
    }
    return pressed;
  }
}

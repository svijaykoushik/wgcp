export interface GameMetadata {
  description?: string;
  developer?: string;
  genre?: string;
  license?: string;
  multiplayer?: boolean;
  icon?: string;
}

export interface GameHosting {
  hostname?: string;
  capabilities?: string[];
}

export interface GameRuntime {
  service?: string;
  port?: number;
}

export interface Game {
  id: string;
  name?: string;
  metadata?: GameMetadata;
  hosting?: GameHosting;
  runtime?: GameRuntime;
  url?: string;
}

export interface User {
  id: number;
  username: string;
}

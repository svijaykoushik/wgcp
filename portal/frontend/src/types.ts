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

export interface AchievementItem {
  id: string;
  gameId: string;
  title: string;
  description: string;
  icon?: string;
  unlocked: boolean;
  percentComplete: number;
  updatedAt?: number;
}

export interface LeaderboardScore {
  rank: number;
  displayName: string;
  score: number;
  metadata?: string;
  timestamp: number;
  isMe: boolean;
}

export interface GameProgression {
  gameId: string;
  level: number;
  currentXp: number;
  totalXp: number;
  xpRequiredForNext: number;
}

export interface UserStat {
  gameId: string;
  statId: string;
  value: number;
  updatedAt: number;
}

export interface UserProfileOverview {
  level: number;
  currentXp: number;
  nextLevelXp: number;
  totalXp: number;
  unlockedAchievementsCount: number;
}

export interface UserProfileResponse {
  user: User;
  library: string[];
  overall: UserProfileOverview;
  progression: Array<{
    userId: number;
    gameId: string;
    level: number;
    currentXp: number;
    totalXp: number;
    updatedAt: number;
  }>;
  achievements: Array<{
    userId: number;
    gameId: string;
    achievementId: string;
    unlocked: boolean;
    percentComplete: number;
    updatedAt: number;
  }>;
  stats: Array<{
    userId: number;
    gameId: string;
    statId: string;
    value: number;
    updatedAt: number;
  }>;
  leaderboards: Array<{
    userId: number;
    gameId: string;
    leaderboardId: string;
    score: number;
    metadata?: string | null;
    updatedAt: number;
  }>;
}

export interface GameAchievementCatalogItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  maxProgress?: number;
}

export interface GameLeaderboardCatalogItem {
  id: string;
  title: string;
  description: string;
  unit: string;
}

export const KNOWN_GAME_ACHIEVEMENTS: Record<string, GameAchievementCatalogItem[]> = {
  browserquest: [
    { id: '1', title: 'Local Hero', description: 'Visit the friendly village town.', icon: '🏘️' },
    { id: '2', title: 'Small Talker', description: 'Chat with curious village residents.', icon: '💬' },
    { id: '3', title: 'Fat Cat', description: 'Seek out and converse with the elusive Octocat.', icon: '🐙' },
    { id: '4', title: 'Rat Catcher', description: 'Clear the dangerous sewer rats.', icon: '🐀', maxProgress: 10 },
    { id: '5', title: 'Skeleton Slayer', description: 'Defeat the skeleton sentinels lurking in the crypts.', icon: '💀', maxProgress: 5 },
    { id: '6', title: 'Dressed to Kill', description: 'Equip red armor and red sword.', icon: '🛡️' },
    { id: '7', title: 'Hero of the Realm', description: 'Slay the mighty dragon boss at the world volcano.', icon: '🐉' },
  ],
  '2048': [
    { id: 'tile_256', title: 'Quarter Grand', description: 'Merge numerical tiles to reach the 256 tile.', icon: '🔢' },
    { id: 'tile_512', title: 'Halfway There', description: 'Merge numerical tiles to reach the 512 tile.', icon: '⚡' },
    { id: 'tile_1024', title: 'Grand Master', description: 'Merge numerical tiles to reach the 1024 tile.', icon: '👑' },
    { id: 'tile_2048', title: 'The Legend 2048', description: 'Reach the ultimate 2048 victory tile!', icon: '🏆' },
    { id: 'score_5000', title: 'Score Virtuoso', description: 'Score over 5,000 points in a single session.', icon: '🌟' },
  ],
  hextris: [
    { id: 'combo_3', title: 'Triple Threat', description: 'Clear a 3x multi-color hexagon combo.', icon: '🔺' },
    { id: 'score_1000', title: 'Hex Novice', description: 'Score 1,000 points in the hexagonal vortex.', icon: '💠' },
    { id: 'score_5000', title: 'Hex Master', description: 'Score 5,000 points without letting blocks reach the gray boundary.', icon: '🌀' },
    { id: 'speed_demon', title: 'Speed Demon', description: 'Survive for more than 2 minutes at max rotation speed.', icon: '⏱️' },
  ],
  'a-dark-room': [
    { id: 'fire_stoked', title: 'Stoke the Fire', description: 'Keep the room warm and survive the frosty night.', icon: '🔥' },
    { id: 'builder', title: 'Village Architect', description: 'Construct huts, a lodge, and trade posts.', icon: '🛖' },
    { id: 'compass', title: 'Pathfinder', description: 'Craft a brass compass and venture into the silent forest.', icon: '🧭' },
    { id: 'starship', title: 'To the Stars', description: 'Repair the ancient alien hull and escape.', icon: '🚀' },
  ],
  supertux: [
    { id: 'level1_cleared', title: 'First Steps', description: 'Clear Welcome to Antarctica in Icy Island.', icon: '🐧' },
    { id: 'coins_100', title: 'Coin Collector', description: 'Gather 100 sparkling coins in a single world.', icon: '🪙', maxProgress: 100 },
    { id: 'castle_infiltrator', title: 'Castle Raider', description: 'Infiltrate Nolok\'s freezing icy fortress.', icon: '🏰' },
    { id: 'speedrunner', title: 'Icy Glide', description: 'Complete any level in under 45 seconds.', icon: '⚡' },
  ],
};

export const KNOWN_GAME_LEADERBOARDS: Record<string, GameLeaderboardCatalogItem[]> = {
  '2048': [
    { id: 'highScore', title: 'High Score', description: 'Highest points accumulated in a single game', unit: 'pts' },
    { id: 'bestTile', title: 'Highest Tile', description: 'Highest number tile achieved', unit: 'tile' },
  ],
  hextris: [
    { id: 'highScore', title: 'Hex Score', description: 'Top hexagonal survival score', unit: 'pts' },
    { id: 'maxCombo', title: 'Max Combo', description: 'Highest consecutive color match multiplier', unit: 'x' },
  ],
  browserquest: [
    { id: 'highScore', title: 'Mob Kills', description: 'Total monster eliminations recorded', unit: 'kills' },
    { id: 'ratCount', title: 'Rats Exterminated', description: 'Sewer rats cleared from the kingdom', unit: 'rats' },
  ],
  'a-dark-room': [
    { id: 'highScore', title: 'Exploration Days', description: 'Survival endurance in the wilderness', unit: 'days' },
  ],
  supertux: [
    { id: 'highScore', title: 'Total Coins', description: 'Coins collected across all unlocked worlds', unit: 'coins' },
  ],
};

export function getAchievementsForGame(gameId: string, backendAchievements: Array<{ achievementId: string; unlocked: boolean; percentComplete: number; updatedAt?: number }>) {
  const catalog = KNOWN_GAME_ACHIEVEMENTS[gameId] || [];
  const backendMap = new Map(backendAchievements.map(a => [a.achievementId, a]));

  const list = catalog.map(item => {
    const recorded = backendMap.get(item.id);
    return {
      id: item.id,
      gameId,
      title: item.title,
      description: item.description,
      icon: item.icon,
      unlocked: recorded ? recorded.unlocked : false,
      percentComplete: recorded ? recorded.percentComplete : 0,
      updatedAt: recorded?.updatedAt,
    };
  });

  for (const a of backendAchievements) {
    if (!catalog.some(c => c.id === a.achievementId)) {
      list.push({
        id: a.achievementId,
        gameId,
        title: a.achievementId.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: 'In-game platform achievement',
        icon: '🏆',
        unlocked: a.unlocked,
        percentComplete: a.percentComplete,
        updatedAt: a.updatedAt,
      });
    }
  }

  return list;
}

export function getLeaderboardsForGame(gameId: string): GameLeaderboardCatalogItem[] {
  return KNOWN_GAME_LEADERBOARDS[gameId] || [
    { id: 'highScore', title: 'High Score', description: 'Overall high score', unit: 'pts' }
  ];
}

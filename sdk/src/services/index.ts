import { sendRPCMessage, getState, getPortalOrigin, generateUUID } from "../index.js";

const sessionStartTime = Date.now();
let activityCount = 0;
let activePlayerId = "";

export function recordActivity() {
  activityCount++;
}

export function handleIdentityMigrationACK(playerId: string) {
  activePlayerId = playerId;
}

export const servicesAPI = {
  achievements: {
    unlock: function(achievementId: string): Promise<boolean> {
      if (getState() === 'UNINITIALIZED') {
        return Promise.reject({ code: "ERROR_NOT_INITIALIZED", message: "SDK not initialized" });
      }
      recordActivity();

      // Generate UUID transaction ID (P-002 §5.2)
      const txId = generateUUID();

      return sendRPCMessage<any>('WGCP_ACHIEVEMENT_UNLOCK', { achievementId, txId })
        .then(res => !!res.unlocked);
    },

    increment: function(achievementId: string, step: number): Promise<any> {
      if (getState() === 'UNINITIALIZED') {
        return Promise.reject({ code: "ERROR_NOT_INITIALIZED", message: "SDK not initialized" });
      }
      if (typeof step !== 'number' || step <= 0) {
        return Promise.reject({ code: "ERROR_INVALID_PARAMETER", message: "Step must be a positive number" });
      }
      recordActivity();

      const txId = generateUUID();

      return sendRPCMessage('WGCP_ACHIEVEMENT_INCREMENT', { achievementId, step, txId });
    },

    getProgress: function(): Promise<any[]> {
      if (getState() === 'UNINITIALIZED') {
        return Promise.reject({ code: "ERROR_NOT_INITIALIZED", message: "SDK not initialized" });
      }
      return sendRPCMessage('WGCP_ACHIEVEMENT_PROGRESS', {});
    }
  },

  leaderboards: {
    // Two-Phase Score Submission Flow (P-003 §3.3)
    submitScore: function(leaderboardId: string, score: number, metadata?: string): Promise<void> {
      if (getState() === 'UNINITIALIZED') {
        return Promise.reject({ code: "ERROR_NOT_INITIALIZED", message: "SDK not initialized" });
      }
      recordActivity();

      const sessionLengthMs = Date.now() - sessionStartTime;

      // Phase 1: Request telemetry-bound validation token
      return sendRPCMessage<{ token: string }>('WGCP_LEADERBOARD_TOKEN', {
        leaderboardId,
        sessionLengthMs,
        gameActivityScore: activityCount
      })
      .then((tokenPayload) => {
        const token = tokenPayload.token;
        // Phase 2: Submit score using the verification token
        return sendRPCMessage<void>('WGCP_LEADERBOARD_SUBMIT', {
          leaderboardId,
          score,
          token,
          metadata
        });
      });
    },

    getScores: function(leaderboardId: string, query?: any): Promise<any[]> {
      if (getState() === 'UNINITIALIZED') {
        return Promise.reject({ code: "ERROR_NOT_INITIALIZED", message: "SDK not initialized" });
      }
      return sendRPCMessage('WGCP_LEADERBOARD_GET_SCORES', { leaderboardId, query });
    }
  },

  progression: {
    addXP: function(amount: number): Promise<any> {
      if (getState() === 'UNINITIALIZED') {
        return Promise.reject({ code: "ERROR_NOT_INITIALIZED", message: "SDK not initialized" });
      }
      if (typeof amount !== 'number' || amount <= 0) {
        return Promise.reject({ code: "ERROR_INVALID_PARAMETER", message: "Amount must be a positive number" });
      }
      recordActivity();

      return sendRPCMessage('WGCP_PROGRESSION_ADD_XP', { amount });
    },

    getProgression: function(): Promise<any> {
      if (getState() === 'UNINITIALIZED') {
        return Promise.reject({ code: "ERROR_NOT_INITIALIZED", message: "SDK not initialized" });
      }
      return sendRPCMessage('WGCP_PROGRESSION_GET', {});
    }
  }
};

/**
 * Hardened Origin & Window Verification Contract specified in P-002 & PROJECT.md
 */
export function verifyPostMessageOrigin(
  event: { origin: unknown; source: unknown },
  expectedOrigin: string,
  expectedSourceWindow: unknown
): boolean {
  // Guard 1: Type and Opaque Origin Defense
  if (typeof event.origin !== 'string' || !event.origin || event.origin === 'null') {
    return false;
  }

  // Guard 2: Strict Window Reference Binding (Prevent multi-window spoofing)
  if (event.source !== expectedSourceWindow) {
    return false;
  }

  // Guard 3: RFC 6454 Canonical Origin Comparison
  try {
    const incomingUrl = new URL(event.origin);
    const expectedUrl = new URL(expectedOrigin);

    // Canonical origin match
    if (incomingUrl.origin !== expectedUrl.origin) {
      return false;
    }

    // Guard 4: Serialization Strictness (event.origin must be pure canonical origin with no path/query/whitespace/wrapper)
    if (event.origin !== incomingUrl.origin) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * RPC Message Envelope Validator specified in P-002 & P-003
 */
const UUIDV4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_RPC_TYPES = new Set([
  'WGCP_INIT',
  'WGCP_INIT_ACK',
  'WGCP_SAVE',
  'WGCP_SAVE_ACK',
  'WGCP_LOAD',
  'WGCP_LOAD_ACK',
  'WGCP_DELETE',
  'WGCP_DELETE_ACK',
  'WGCP_PAUSE',
  'WGCP_RESUME',
  'WGCP_STATS_FLUSH',
  'WGCP_STATS_ACK',
  'WGCP_ACHIEVEMENT_UNLOCK',
  'WGCP_ACHIEVEMENT_ACK',
  'WGCP_SCORE_SUBMIT',
  'WGCP_SCORE_ACK',
  'WGCP_MIGRATE',
  'WGCP_MIGRATION_ACK',
  'WGCP_REQUEST_PERMISSION',
  'WGCP_REQUEST_PERMISSION_ACK'
]);

export function validateRPCMessageEnvelope(data: unknown, expectedSource: 'WGCP_SDK' | 'WGCP_PORTAL'): boolean {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false;
  }
  const msg = data as Record<string, any>;

  if (msg.source !== expectedSource) {
    return false;
  }

  if (typeof msg.id !== 'string' || !UUIDV4_REGEX.test(msg.id)) {
    return false;
  }

  if (typeof msg.type !== 'string' || !ALLOWED_RPC_TYPES.has(msg.type)) {
    return false;
  }

  return true;
}

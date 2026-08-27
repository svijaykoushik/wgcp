import { describe, it, expect } from 'vitest';

/**
 * Hardened Origin & Window Verification Contract specified in P-002 & PROJECT.md
 */
import { verifyPostMessageOrigin, validateRPCMessageEnvelope } from '../utils/security';


describe('Origin Verification & Security Protocol Empirical Verification', () => {
  const expectedGameOrigin = 'http://2048.localhost';
  const mockGameWindow = { name: 'gameContentWindow' };
  const mockAttackerWindow = { name: 'attackerWindow' };

  describe('1. Malicious & Crafted Origin Probing', () => {
    it('approves exact valid canonical game origin', () => {
      const event = { origin: 'http://2048.localhost', source: mockGameWindow };
      expect(verifyPostMessageOrigin(event, expectedGameOrigin, mockGameWindow)).toBe(true);
    });

    it('rejects opaque origin "null" without throwing unhandled exceptions', () => {
      const event = { origin: 'null', source: mockGameWindow };
      expect(verifyPostMessageOrigin(event, expectedGameOrigin, mockGameWindow)).toBe(false);
    });

    it('rejects non-string or empty origin values', () => {
      expect(verifyPostMessageOrigin({ origin: '', source: mockGameWindow }, expectedGameOrigin, mockGameWindow)).toBe(false);
      expect(verifyPostMessageOrigin({ origin: null, source: mockGameWindow }, expectedGameOrigin, mockGameWindow)).toBe(false);
      expect(verifyPostMessageOrigin({ origin: undefined, source: mockGameWindow }, expectedGameOrigin, mockGameWindow)).toBe(false);
      expect(verifyPostMessageOrigin({ origin: 12345, source: mockGameWindow }, expectedGameOrigin, mockGameWindow)).toBe(false);
    });

    it('rejects subdomain suffix masquerading attacks (attacker.com)', () => {
      const event = { origin: 'http://2048.localhost.attacker.com', source: mockGameWindow };
      expect(verifyPostMessageOrigin(event, expectedGameOrigin, mockGameWindow)).toBe(false);
    });

    it('rejects subdomain prefix collision attacks (attacker-2048)', () => {
      const event = { origin: 'http://attacker-2048.localhost', source: mockGameWindow };
      expect(verifyPostMessageOrigin(event, expectedGameOrigin, mockGameWindow)).toBe(false);
    });

    it('rejects non-standard port tampering (port 8080)', () => {
      const event = { origin: 'http://2048.localhost:8080', source: mockGameWindow };
      expect(verifyPostMessageOrigin(event, expectedGameOrigin, mockGameWindow)).toBe(false);
    });

    it('rejects protocol scheme tampering (https vs http)', () => {
      const event = { origin: 'https://2048.localhost', source: mockGameWindow };
      expect(verifyPostMessageOrigin(event, expectedGameOrigin, mockGameWindow)).toBe(false);
    });

    it('handles default port 80/443 normalization on expected origins', () => {
      // If expectedOrigin was constructed as http://2048.localhost:80, browser event.origin is http://2048.localhost
      const event = { origin: 'http://2048.localhost', source: mockGameWindow };
      expect(verifyPostMessageOrigin(event, 'http://2048.localhost:80', mockGameWindow)).toBe(true);
    });

    it('rejects origins with embedded paths or query parameters', () => {
      expect(verifyPostMessageOrigin({ origin: 'http://2048.localhost/exploit', source: mockGameWindow }, expectedGameOrigin, mockGameWindow)).toBe(false);
      expect(verifyPostMessageOrigin({ origin: 'http://2048.localhost?payload=1', source: mockGameWindow }, expectedGameOrigin, mockGameWindow)).toBe(false);
      expect(verifyPostMessageOrigin({ origin: 'http://2048.localhost#hash', source: mockGameWindow }, expectedGameOrigin, mockGameWindow)).toBe(false);
      expect(verifyPostMessageOrigin({ origin: 'http://2048.localhost/', source: mockGameWindow }, expectedGameOrigin, mockGameWindow)).toBe(false);
    });

    it('rejects origins with leading or trailing whitespace and CRLF injection', () => {
      expect(verifyPostMessageOrigin({ origin: ' http://2048.localhost', source: mockGameWindow }, expectedGameOrigin, mockGameWindow)).toBe(false);
      expect(verifyPostMessageOrigin({ origin: 'http://2048.localhost ', source: mockGameWindow }, expectedGameOrigin, mockGameWindow)).toBe(false);
      expect(verifyPostMessageOrigin({ origin: 'http://2048.localhost\r\n', source: mockGameWindow }, expectedGameOrigin, mockGameWindow)).toBe(false);
    });

    it('rejects blob, data, javascript, and file schemes', () => {
      expect(verifyPostMessageOrigin({ origin: 'blob:http://2048.localhost/uuid', source: mockGameWindow }, expectedGameOrigin, mockGameWindow)).toBe(false);
      expect(verifyPostMessageOrigin({ origin: 'data:text/html,payload', source: mockGameWindow }, expectedGameOrigin, mockGameWindow)).toBe(false);
      expect(verifyPostMessageOrigin({ origin: 'javascript:alert(1)', source: mockGameWindow }, expectedGameOrigin, mockGameWindow)).toBe(false);
      expect(verifyPostMessageOrigin({ origin: 'file:///etc/passwd', source: mockGameWindow }, expectedGameOrigin, mockGameWindow)).toBe(false);
    });

    it('neutralizes homograph and punycode spoofing', () => {
      // Cyrillic 'о' in localhost
      const cyrillicOrigin = 'http://2048.l\u043Ecalhost';
      expect(verifyPostMessageOrigin({ origin: cyrillicOrigin, source: mockGameWindow }, expectedGameOrigin, mockGameWindow)).toBe(false);
    });

    it('rejects trailing dot FQDN differences', () => {
      expect(verifyPostMessageOrigin({ origin: 'http://2048.localhost.', source: mockGameWindow }, expectedGameOrigin, mockGameWindow)).toBe(false);
    });
  });

  describe('2. Sender Window Binding & Spoofing Defense', () => {
    it('rejects messages when event.source is an attacker or sibling window despite matching origin', () => {
      const event = { origin: 'http://2048.localhost', source: mockAttackerWindow };
      expect(verifyPostMessageOrigin(event, expectedGameOrigin, mockGameWindow)).toBe(false);
    });

    it('rejects messages when event.source is null or undefined (detached frame)', () => {
      expect(verifyPostMessageOrigin({ origin: 'http://2048.localhost', source: null }, expectedGameOrigin, mockGameWindow)).toBe(false);
      expect(verifyPostMessageOrigin({ origin: 'http://2048.localhost', source: undefined }, expectedGameOrigin, mockGameWindow)).toBe(false);
    });
  });

  describe('3. RPC Message Envelope & Cryptographic Correlation ID Validation', () => {
    it('accepts valid RPC message envelope with UUIDv4', () => {
      const validMsg = {
        id: 'c2b489a2-97b7-4a41-b844-3d077d71be21',
        type: 'WGCP_SAVE',
        source: 'WGCP_SDK',
        payload: { slot: 'slot1', data: 'save_binary' }
      };
      expect(validateRPCMessageEnvelope(validMsg, 'WGCP_SDK')).toBe(true);
    });

    it('rejects messages with non-v4 UUIDs (UUIDv1)', () => {
      const v1Msg = {
        id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        type: 'WGCP_SAVE',
        source: 'WGCP_SDK'
      };
      expect(validateRPCMessageEnvelope(v1Msg, 'WGCP_SDK')).toBe(false);
    });

    it('rejects messages with role discriminator mismatch (prevent echo reflection)', () => {
      const reflectedMsg = {
        id: 'c2b489a2-97b7-4a41-b844-3d077d71be21',
        type: 'WGCP_SAVE',
        source: 'WGCP_PORTAL'
      };
      expect(validateRPCMessageEnvelope(reflectedMsg, 'WGCP_SDK')).toBe(false);
    });

    it('rejects unknown RPC types or prototype pollution injections', () => {
      expect(validateRPCMessageEnvelope({ id: 'c2b489a2-97b7-4a41-b844-3d077d71be21', type: '__proto__', source: 'WGCP_SDK' }, 'WGCP_SDK')).toBe(false);
      expect(validateRPCMessageEnvelope({ id: 'c2b489a2-97b7-4a41-b844-3d077d71be21', type: 'UNKNOWN_EVIL_RPC', source: 'WGCP_SDK' }, 'WGCP_SDK')).toBe(false);
    });
  });

  describe('4. Wildcard targetOrigin Interception Security', () => {
    it('demonstrates that explicit targetOrigin prevents cross-origin message leaks', () => {
      const secretPayload = { userToken: 'secret_user_token', saveState: { level: 99 } };

      const simulateDispatch = (targetOrigin: string, actualRecipientOrigin: string) => {
        if (targetOrigin === '*') {
          return { delivered: true, payload: secretPayload };
        }
        try {
          const targetCanonical = new URL(targetOrigin).origin;
          const recipientCanonical = new URL(actualRecipientOrigin).origin;
          if (targetCanonical === recipientCanonical) {
            return { delivered: true, payload: secretPayload };
          }
          return { delivered: false, payload: null };
        } catch {
          return { delivered: false, payload: null };
        }
      };

      // Attacker intercepts if wildcard is used
      const wildcardResult = simulateDispatch('*', 'http://attacker.com');
      expect(wildcardResult.delivered).toBe(true);
      expect(wildcardResult.payload).toEqual(secretPayload);

      // Attacker gets nothing when explicit targetOrigin is enforced
      const explicitResult = simulateDispatch('http://localhost:3000', 'http://attacker.com');
      expect(explicitResult.delivered).toBe(false);
      expect(explicitResult.payload).toBeNull();
    });
  });
});

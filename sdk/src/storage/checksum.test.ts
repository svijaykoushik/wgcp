import { describe, it, expect } from 'vitest';
import { calculateChecksum } from './index.js';

describe('calculateChecksum', () => {
  it('should compute the correct SHA-256 checksum for a string', async () => {
    const data = "hello world";
    const checksum = await calculateChecksum(data);
    expect(checksum).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
  });
});

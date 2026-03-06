import { hashPassword, verifyPassword } from '../../src/shared/utils/passwordHash';

describe('Password Hashing Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a valid password', async () => {
      const password = 'SecurePass123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
      expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'SecurePass123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should throw error for empty password', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password cannot be empty');
    });

    it('should throw error for whitespace-only password', async () => {
      await expect(hashPassword('   ')).rejects.toThrow('Password cannot be empty');
    });

    it('should handle special characters in password', async () => {
      const password = 'P@ssw0rd!#$%^&*()';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('should handle long passwords', async () => {
      const password = 'a'.repeat(100);
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('should handle unicode characters', async () => {
      const password = 'パスワード123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).toMatch(/^\$2[aby]\$/);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'SecurePass123!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'SecurePass123!';
      const wrongPassword = 'WrongPass456!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it('should reject password with different case', async () => {
      const password = 'SecurePass123!';
      const wrongPassword = 'securepass123!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it('should throw error for empty password', async () => {
      const hash = await hashPassword('ValidPass123!');
      await expect(verifyPassword('', hash)).rejects.toThrow('Password cannot be empty');
    });

    it('should throw error for whitespace-only password', async () => {
      const hash = await hashPassword('ValidPass123!');
      await expect(verifyPassword('   ', hash)).rejects.toThrow('Password cannot be empty');
    });

    it('should throw error for empty hash', async () => {
      await expect(verifyPassword('ValidPass123!', '')).rejects.toThrow('Hash cannot be empty');
    });

    it('should throw error for whitespace-only hash', async () => {
      await expect(verifyPassword('ValidPass123!', '   ')).rejects.toThrow('Hash cannot be empty');
    });

    it('should return false for invalid hash format', async () => {
      // bcrypt.compare returns false for invalid hashes rather than throwing
      const isValid = await verifyPassword('ValidPass123!', 'invalid-hash').catch(() => false);
      expect(isValid).toBe(false);
    });

    it('should handle special characters in password verification', async () => {
      const password = 'P@ssw0rd!#$%^&*()';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should handle unicode characters in password verification', async () => {
      const password = 'パスワード123';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should verify long passwords correctly', async () => {
      const password = 'a'.repeat(100);
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should handle bcrypt 72-byte password limit', async () => {
      // bcrypt truncates passwords to 72 bytes
      // Two passwords that differ only after 72 bytes will have the same hash
      const password = 'a'.repeat(72);
      const similarPassword = 'a'.repeat(72) + 'b';
      const hash = await hashPassword(password);
      
      // Both should verify as true due to bcrypt's 72-byte limit
      const isValid1 = await verifyPassword(password, hash);
      const isValid2 = await verifyPassword(similarPassword, hash);
      
      expect(isValid1).toBe(true);
      expect(isValid2).toBe(true); // This is expected behavior with bcrypt
    });
  });

  describe('Integration tests', () => {
    it('should handle multiple hash and verify operations', async () => {
      const passwords = ['Pass1!', 'Pass2@', 'Pass3#'];
      const hashes = await Promise.all(passwords.map(p => hashPassword(p)));

      // Verify correct passwords
      for (let i = 0; i < passwords.length; i++) {
        const isValid = await verifyPassword(passwords[i], hashes[i]);
        expect(isValid).toBe(true);
      }

      // Verify incorrect password combinations
      const isValid1 = await verifyPassword(passwords[0], hashes[1]);
      const isValid2 = await verifyPassword(passwords[1], hashes[2]);
      expect(isValid1).toBe(false);
      expect(isValid2).toBe(false);
    });

    it('should maintain consistency across multiple verifications', async () => {
      const password = 'ConsistentPass123!';
      const hash = await hashPassword(password);

      // Verify multiple times
      const results = await Promise.all([
        verifyPassword(password, hash),
        verifyPassword(password, hash),
        verifyPassword(password, hash),
      ]);

      expect(results).toEqual([true, true, true]);
    });
  });
});

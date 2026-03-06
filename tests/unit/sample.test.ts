/**
 * Sample Unit Test
 * Demonstrates basic Jest functionality with TypeScript
 */

describe('Sample Unit Tests', () => {
  describe('Basic Jest Functionality', () => {
    it('should pass a simple assertion', () => {
      expect(true).toBe(true);
    });

    it('should perform arithmetic operations', () => {
      expect(2 + 2).toBe(4);
      expect(10 - 5).toBe(5);
      expect(3 * 4).toBe(12);
      expect(15 / 3).toBe(5);
    });

    it('should handle string operations', () => {
      const greeting = 'Hello, World!';
      expect(greeting).toContain('World');
      expect(greeting.toLowerCase()).toBe('hello, world!');
    });

    it('should work with arrays', () => {
      const numbers = [1, 2, 3, 4, 5];
      expect(numbers).toHaveLength(5);
      expect(numbers).toContain(3);
      expect(numbers[0]).toBe(1);
    });

    it('should work with objects', () => {
      const user = {
        id: '123',
        name: 'Test User',
        email: 'test@example.com',
      };
      expect(user).toHaveProperty('id');
      expect(user.name).toBe('Test User');
      expect(user).toMatchObject({ email: 'test@example.com' });
    });
  });

  describe('Async Operations', () => {
    it('should handle promises', async () => {
      const promise = Promise.resolve('success');
      await expect(promise).resolves.toBe('success');
    });

    it('should handle async/await', async () => {
      const asyncFunction = async () => {
        return 'async result';
      };
      const result = await asyncFunction();
      expect(result).toBe('async result');
    });

    it('should handle rejected promises', async () => {
      const promise = Promise.reject(new Error('failed'));
      await expect(promise).rejects.toThrow('failed');
    });
  });

  describe('Mocking', () => {
    it('should mock functions', () => {
      const mockFn = jest.fn();
      mockFn('test');
      expect(mockFn).toHaveBeenCalledWith('test');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should mock return values', () => {
      const mockFn = jest.fn().mockReturnValue('mocked');
      expect(mockFn()).toBe('mocked');
    });

    it('should mock implementations', () => {
      const mockFn = jest.fn();
      mockFn.mockImplementation((x: number) => x * 2);
      expect(mockFn(5)).toBe(10);
      expect(mockFn).toHaveBeenCalledWith(5);
    });
  });

  describe('TypeScript Support', () => {
    interface User {
      id: string;
      name: string;
      email: string;
    }

    it('should work with TypeScript interfaces', () => {
      const user: User = {
        id: '123',
        name: 'Test User',
        email: 'test@example.com',
      };
      expect(user.id).toBe('123');
    });

    it('should work with TypeScript types', () => {
      type Status = 'active' | 'inactive';
      const status: Status = 'active';
      expect(status).toBe('active');
    });
  });
});

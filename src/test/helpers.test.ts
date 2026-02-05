import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateId, getGreeting, formatDateFull, isSameDay } from '../../utils/helpers';

describe('Helpers', () => {
  describe('generateId', () => {
    it('should generate a string ID', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    it('should use crypto.randomUUID when available', () => {
      const mockUUID = '123e4567-e89b-12d3-a456-426614174000';
      vi.stubGlobal('crypto', {
        randomUUID: vi.fn(() => mockUUID)
      });
      
      expect(generateId()).toBe(mockUUID);
      
      vi.unstubAllGlobals();
    });
  });

  describe('getGreeting', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return "Good Morning" before noon', () => {
      vi.setSystemTime(new Date(2024, 0, 1, 9, 0, 0)); // 9 AM
      expect(getGreeting('John')).toBe('Good Morning, John');
    });

    it('should return "Good Afternoon" between noon and 5 PM', () => {
      vi.setSystemTime(new Date(2024, 0, 1, 14, 0, 0)); // 2 PM
      expect(getGreeting('John')).toBe('Good Afternoon, John');
    });

    it('should return "Good Evening" after 5 PM', () => {
      vi.setSystemTime(new Date(2024, 0, 1, 19, 0, 0)); // 7 PM
      expect(getGreeting('John')).toBe('Good Evening, John');
    });

    it('should use "Student" as default name when empty', () => {
      vi.setSystemTime(new Date(2024, 0, 1, 9, 0, 0));
      expect(getGreeting('')).toBe('Good Morning, Student');
    });

    it('should use "Student" as default when name is whitespace', () => {
      vi.setSystemTime(new Date(2024, 0, 1, 9, 0, 0));
      expect(getGreeting('   ')).toBe('Good Morning, Student');
    });

    it('should trim whitespace from name', () => {
      vi.setSystemTime(new Date(2024, 0, 1, 9, 0, 0));
      expect(getGreeting('  John  ')).toBe('Good Morning, John');
    });
  });

  describe('formatDateFull', () => {
    it('should format date with weekday, month, and day', () => {
      const date = new Date(2024, 0, 15); // January 15, 2024 (Monday)
      const formatted = formatDateFull(date);
      expect(formatted).toContain('January');
      expect(formatted).toContain('15');
    });

    it('should include weekday name', () => {
      const date = new Date(2024, 0, 15); // This is a Monday
      const formatted = formatDateFull(date);
      expect(formatted).toContain('Monday');
    });
  });

  describe('isSameDay', () => {
    it('should return true for same dates', () => {
      const d1 = new Date(2024, 0, 15, 10, 30);
      const d2 = new Date(2024, 0, 15, 22, 45);
      expect(isSameDay(d1, d2)).toBe(true);
    });

    it('should return false for different days', () => {
      const d1 = new Date(2024, 0, 15);
      const d2 = new Date(2024, 0, 16);
      expect(isSameDay(d1, d2)).toBe(false);
    });

    it('should return false for different months', () => {
      const d1 = new Date(2024, 0, 15);
      const d2 = new Date(2024, 1, 15);
      expect(isSameDay(d1, d2)).toBe(false);
    });

    it('should return false for different years', () => {
      const d1 = new Date(2024, 0, 15);
      const d2 = new Date(2025, 0, 15);
      expect(isSameDay(d1, d2)).toBe(false);
    });

    it('should handle same exact moment', () => {
      const d1 = new Date(2024, 0, 15, 12, 0, 0);
      const d2 = new Date(d1);
      expect(isSameDay(d1, d2)).toBe(true);
    });
  });
});

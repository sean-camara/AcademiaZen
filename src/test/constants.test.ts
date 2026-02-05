import { describe, it, expect } from 'vitest';
import { INITIAL_STATE, DEFAULT_SETTINGS, DEFAULT_PROFILE, INITIAL_FOLDERS } from '../../constants';

describe('Constants', () => {
  describe('DEFAULT_SETTINGS', () => {
    it('should have correct default focus duration', () => {
      expect(DEFAULT_SETTINGS.focusDuration).toBe(25);
    });

    it('should have notifications enabled by default', () => {
      expect(DEFAULT_SETTINGS.notifications).toBe(true);
    });

    it('should have deadline alerts enabled by default', () => {
      expect(DEFAULT_SETTINGS.deadlineAlerts).toBe(true);
    });

    it('should have silent ambience by default', () => {
      expect(DEFAULT_SETTINGS.ambience).toBe('silent');
    });

    it('should have correct weekly focus goal (10 hours)', () => {
      expect(DEFAULT_SETTINGS.weeklyFocusGoal).toBe(600); // 10 hours in minutes
    });
  });

  describe('DEFAULT_PROFILE', () => {
    it('should have Student as default firstName', () => {
      expect(DEFAULT_PROFILE.firstName).toBe('Student');
    });

    it('should have empty lastName', () => {
      expect(DEFAULT_PROFILE.lastName).toBe('');
    });

    it('should have quotes enabled by default', () => {
      expect(DEFAULT_PROFILE.quoteEnabled).toBe(true);
    });
  });

  describe('INITIAL_FOLDERS', () => {
    it('should have a General folder', () => {
      expect(INITIAL_FOLDERS).toHaveLength(1);
      expect(INITIAL_FOLDERS[0].name).toBe('General');
      expect(INITIAL_FOLDERS[0].id).toBe('general');
    });

    it('should have empty items in General folder', () => {
      expect(INITIAL_FOLDERS[0].items).toEqual([]);
    });
  });

  describe('INITIAL_STATE', () => {
    it('should have empty tasks array', () => {
      expect(INITIAL_STATE.tasks).toEqual([]);
    });

    it('should have empty subjects array', () => {
      expect(INITIAL_STATE.subjects).toEqual([]);
    });

    it('should have empty flashcards array', () => {
      expect(INITIAL_STATE.flashcards).toEqual([]);
    });

    it('should have default folders', () => {
      expect(INITIAL_STATE.folders).toEqual(INITIAL_FOLDERS);
    });

    it('should have default profile', () => {
      expect(INITIAL_STATE.profile).toEqual(DEFAULT_PROFILE);
    });

    it('should have default settings', () => {
      expect(INITIAL_STATE.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should have null quizProgress', () => {
      expect(INITIAL_STATE.quizProgress).toBeNull();
    });

    it('should have empty aiChat array', () => {
      expect(INITIAL_STATE.aiChat).toEqual([]);
    });

    it('should have updatedAt timestamp', () => {
      expect(INITIAL_STATE.updatedAt).toBeDefined();
      expect(typeof INITIAL_STATE.updatedAt).toBe('string');
    });
  });
});

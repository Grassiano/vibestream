import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => { throw new Error('not found'); }),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import {
  ALL_ACHIEVEMENTS,
  AchievementTracker,
} from '../src/progression/achievements';
import type { SessionStats } from '../src/progression/achievements';

function makeStats(overrides: Partial<SessionStats> = {}): SessionStats {
  return {
    totalXP: 0,
    level: 1,
    sessionMinutes: 0,
    sessionXP: 0,
    totalSessions: 0,
    totalCommits: 0,
    totalPushes: 0,
    totalErrorsFixed: 0,
    peakViewers: 0,
    streakDays: 0,
    totalWatchMinutes: 0,
    currentCombo: 0,
    peakCombo: 0,
    messagesTyped: 0,
    ...overrides,
  };
}

describe('ALL_ACHIEVEMENTS', () => {
  it('has unique IDs', () => {
    const ids = ALL_ACHIEVEMENTS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has 29 achievements', () => {
    expect(ALL_ACHIEVEMENTS.length).toBe(29);
  });

  it('covers all categories', () => {
    const categories = new Set(ALL_ACHIEVEMENTS.map(a => a.category));
    expect(categories).toContain('coding');
    expect(categories).toContain('streaming');
    expect(categories).toContain('social');
    expect(categories).toContain('streak');
    expect(categories).toContain('special');
  });

  it('all achievements with checkFn accept SessionStats', () => {
    const stats = makeStats();
    for (const a of ALL_ACHIEVEMENTS) {
      if (a.checkFn) {
        expect(() => a.checkFn!(stats)).not.toThrow();
      }
    }
  });
});

describe('AchievementTracker', () => {
  let tracker: AchievementTracker;

  beforeEach(() => {
    tracker = new AchievementTracker();
  });

  it('starts with no unlocked achievements', () => {
    expect(tracker.unlockedCount).toBe(0);
    expect(tracker.getUnlocked()).toHaveLength(0);
  });

  it('unlocks first_blood on 1 error fixed', () => {
    const newlyUnlocked = tracker.check(makeStats({ totalErrorsFixed: 1 }));
    const ids = newlyUnlocked.map(a => a.id);
    expect(ids).toContain('first_blood');
  });

  it('unlocks first_stream on 1 session', () => {
    const newlyUnlocked = tracker.check(makeStats({ totalSessions: 1 }));
    const ids = newlyUnlocked.map(a => a.id);
    expect(ids).toContain('first_stream');
  });

  it('does not double-unlock same achievement', () => {
    tracker.check(makeStats({ totalErrorsFixed: 1 }));
    const second = tracker.check(makeStats({ totalErrorsFixed: 1 }));
    expect(second.find(a => a.id === 'first_blood')).toBeUndefined();
  });

  it('unlocks multiple achievements at once', () => {
    const newlyUnlocked = tracker.check(makeStats({
      totalErrorsFixed: 50,
      totalPushes: 1,
      totalSessions: 1,
      level: 5,
    }));
    const ids = newlyUnlocked.map(a => a.id);
    expect(ids).toContain('first_blood');
    expect(ids).toContain('bug_slayer');
    expect(ids).toContain('shipper');
    expect(ids).toContain('first_stream');
    expect(ids).toContain('leveled_up');
  });

  it('manual unlock works', () => {
    const result = tracker.unlock('s_rank');
    expect(result).toBeDefined();
    expect(result!.id).toBe('s_rank');
    expect(tracker.unlockedCount).toBe(1);
  });

  it('manual unlock returns undefined for already unlocked', () => {
    tracker.unlock('s_rank');
    const result = tracker.unlock('s_rank');
    expect(result).toBeUndefined();
  });

  it('manual unlock returns undefined for invalid ID', () => {
    const result = tracker.unlock('nonexistent_achievement');
    expect(result).toBeUndefined();
  });

  it('getAll returns all achievements with status', () => {
    const all = tracker.getAll();
    expect(all.length).toBe(ALL_ACHIEVEMENTS.length);
    expect(all.every(a => typeof a.unlocked === 'boolean')).toBe(true);
  });

  it('total reflects count of all achievements', () => {
    expect(tracker.total).toBe(ALL_ACHIEVEMENTS.length);
  });

  it('combo_king unlocks at peak combo 5', () => {
    const newlyUnlocked = tracker.check(makeStats({ peakCombo: 5 }));
    const ids = newlyUnlocked.map(a => a.id);
    expect(ids).toContain('combo_king');
  });

  it('xp_hoarder unlocks at 10000 total XP', () => {
    const newlyUnlocked = tracker.check(makeStats({ totalXP: 10000 }));
    const ids = newlyUnlocked.map(a => a.id);
    expect(ids).toContain('xp_hoarder');
  });

  it('marathon unlocks at 180 minutes', () => {
    const newlyUnlocked = tracker.check(makeStats({ sessionMinutes: 180 }));
    const ids = newlyUnlocked.map(a => a.id);
    expect(ids).toContain('marathon');
    expect(ids).toContain('double_feature'); // 120 also covered
  });
});

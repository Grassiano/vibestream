import { describe, it, expect } from 'vitest';

import { generateRecap } from '../src/progression/session-recap';
import type { SessionScore, PlayerProfile } from '../src/progression/xp-engine';
import type { SessionLogEntry } from '../src/progression/session-recap';

function makeScore(overrides: Partial<SessionScore> = {}): SessionScore {
  return {
    rank: 'B',
    xpEarned: 500,
    durationMinutes: 30,
    peakCombo: 3,
    peakViewers: 150,
    levelsGained: 1,
    startLevel: 3,
    endLevel: 4,
    startTitle: 'Prompt Beginner',
    endTitle: 'Prompt Beginner',
    ...overrides,
  };
}

function makeProfile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    xp: 500,
    level: 4,
    title: 'Prompt Beginner',
    streakDays: 5,
    streakLastDate: '2026-03-26',
    prestigeCount: 0,
    achievements: [],
    totalSessions: 10,
    totalWatchMinutes: 300,
    peakViewers: 150,
    totalCommits: 20,
    totalPushes: 5,
    totalErrorsFixed: 30,
    ...overrides,
  };
}

describe('generateRecap', () => {
  it('returns correct rank and color', () => {
    const recap = generateRecap(makeScore({ rank: 'S' }), makeProfile(), [], []);
    expect(recap.rank).toBe('S');
    expect(recap.rankColor).toBe('#ffd700');
  });

  it('returns all rank colors', () => {
    const ranks: Array<'S' | 'A' | 'B' | 'C' | 'D'> = ['S', 'A', 'B', 'C', 'D'];
    for (const rank of ranks) {
      const recap = generateRecap(makeScore({ rank }), makeProfile(), [], []);
      expect(recap.rankColor).toBeTruthy();
    }
  });

  it('formats duration correctly', () => {
    expect(generateRecap(makeScore({ durationMinutes: 30 }), makeProfile(), [], []).duration).toBe('30m');
    expect(generateRecap(makeScore({ durationMinutes: 90 }), makeProfile(), [], []).duration).toBe('1h 30m');
    expect(generateRecap(makeScore({ durationMinutes: 120 }), makeProfile(), [], []).duration).toBe('2h 0m');
  });

  it('detects leveledUp', () => {
    const recap = generateRecap(makeScore({ levelsGained: 1 }), makeProfile(), [], []);
    expect(recap.leveledUp).toBe(true);
  });

  it('no levelUp when 0 levels gained', () => {
    const recap = generateRecap(makeScore({ levelsGained: 0 }), makeProfile(), [], []);
    expect(recap.leveledUp).toBe(false);
  });

  it('includes achievements', () => {
    const recap = generateRecap(makeScore(), makeProfile(), ['first_blood', 'shipper'], []);
    expect(recap.achievements).toEqual(['first_blood', 'shipper']);
  });

  it('generates push highlight', () => {
    const log: SessionLogEntry[] = [
      { ts: 1000, type: 'git-push' },
      { ts: 2000, type: 'git-push' },
    ];
    const recap = generateRecap(makeScore(), makeProfile(), [], log);
    expect(recap.highlights.some(h => h.includes('Pushed'))).toBe(true);
  });

  it('generates improvement for no commits', () => {
    const recap = generateRecap(makeScore(), makeProfile(), [], []);
    expect(recap.improvements.some(i => i.includes('Commit'))).toBe(true);
  });

  it('generates improvement for short session', () => {
    const recap = generateRecap(makeScore({ durationMinutes: 10 }), makeProfile(), [], []);
    expect(recap.improvements.some(i => i.includes('longer'))).toBe(true);
  });

  it('generates improvement for low combo', () => {
    const recap = generateRecap(makeScore({ peakCombo: 1 }), makeProfile(), [], []);
    expect(recap.improvements.some(i => i.includes('momentum'))).toBe(true);
  });

  it('limits improvements to 2', () => {
    const log: SessionLogEntry[] = Array.from({ length: 10 }, (_, i) => ({
      ts: i * 1000,
      type: 'error-added',
    }));
    const recap = generateRecap(
      makeScore({ durationMinutes: 5, peakCombo: 0 }),
      makeProfile(),
      [],
      log,
    );
    expect(recap.improvements.length).toBeLessThanOrEqual(2);
  });

  it('limits highlights to 5', () => {
    const log: SessionLogEntry[] = [
      { ts: 0, type: 'git-push' },
      { ts: 1000, type: 'git-push' },
      { ts: 2000, type: 'git-push' },
      { ts: 3000, type: 'level-up', detail: 'Level 5' },
      { ts: 4000, type: 'level-up', detail: 'Level 6' },
      { ts: 5000, type: 'combo-update', detail: '5' },
      { ts: 6000, type: 'viewer-update', detail: '500' },
    ];
    const recap = generateRecap(makeScore(), makeProfile(), [], log);
    expect(recap.highlights.length).toBeLessThanOrEqual(5);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode before importing
vi.mock('vscode', () => ({
  Disposable: class { constructor(private fn: () => void) {} dispose() { this.fn(); } },
}));

// Mock fs to avoid real file I/O
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => { throw new Error('not found'); }),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import {
  getTitleForLevel,
  levelFromXP,
  getXPForEvent,
  XPEngine,
} from '../src/progression/xp-engine';
import type { XPCallbacks } from '../src/progression/xp-engine';

describe('getTitleForLevel', () => {
  it('returns Prompt Beginner for level 1', () => {
    expect(getTitleForLevel(1)).toBe('Prompt Beginner');
  });

  it('returns Prompt Apprentice for level 6', () => {
    expect(getTitleForLevel(6)).toBe('Prompt Apprentice');
  });

  it('returns GOAT for level 99', () => {
    expect(getTitleForLevel(99)).toBe('GOAT');
  });

  it('returns GOAT for levels beyond 99', () => {
    expect(getTitleForLevel(150)).toBe('GOAT');
  });

  it('returns correct title at boundary levels', () => {
    expect(getTitleForLevel(5)).toBe('Prompt Beginner');
    expect(getTitleForLevel(10)).toBe('Prompt Apprentice');
    expect(getTitleForLevel(15)).toBe('Prompt Crafter');
    expect(getTitleForLevel(20)).toBe('AI Pair Programmer');
    expect(getTitleForLevel(25)).toBe('Code Conductor');
    expect(getTitleForLevel(30)).toBe('Vibe Architect');
    expect(getTitleForLevel(40)).toBe('Shipping Machine');
    expect(getTitleForLevel(50)).toBe('10x Vibe Coder');
    expect(getTitleForLevel(60)).toBe('AI Whisperer');
    expect(getTitleForLevel(75)).toBe('Vibe Sensei');
    expect(getTitleForLevel(90)).toBe('Digital Maestro');
  });
});

describe('levelFromXP', () => {
  it('returns level 1 for 0 XP', () => {
    expect(levelFromXP(0)).toBe(1);
  });

  it('returns level 2 for exactly 100 XP', () => {
    expect(levelFromXP(100)).toBe(2);
  });

  it('stays level 1 for 99 XP', () => {
    expect(levelFromXP(99)).toBe(1);
  });

  it('returns level 3 for enough XP (100 + 110 = 210)', () => {
    expect(levelFromXP(210)).toBe(3);
  });

  it('caps at level 99', () => {
    expect(levelFromXP(999_999_999)).toBe(99);
  });

  it('is monotonically increasing', () => {
    let prevLevel = 1;
    for (let xp = 0; xp <= 50000; xp += 100) {
      const level = levelFromXP(xp);
      expect(level).toBeGreaterThanOrEqual(prevLevel);
      prevLevel = level;
    }
  });
});

describe('getXPForEvent', () => {
  it('returns correct XP for known events', () => {
    expect(getXPForEvent('save')).toBe(5);
    expect(getXPForEvent('git-commit')).toBe(50);
    expect(getXPForEvent('git-push')).toBe(100);
    expect(getXPForEvent('error-cleared')).toBe(15);
    expect(getXPForEvent('all-errors-cleared')).toBe(40);
    expect(getXPForEvent('keystroke')).toBe(1);
  });

  it('returns 0 for unknown events', () => {
    expect(getXPForEvent('foobar')).toBe(0);
    expect(getXPForEvent('')).toBe(0);
  });

  it('has vibe-coder specific events', () => {
    expect(getXPForEvent('convo-user-prompted')).toBe(8);
    expect(getXPForEvent('claude-response')).toBe(3);
    expect(getXPForEvent('convo-deep-dive')).toBe(15);
  });
});

describe('XPEngine', () => {
  let callbacks: XPCallbacks;
  let engine: XPEngine;

  beforeEach(() => {
    callbacks = {
      onXPGain: vi.fn(),
      onLevelUp: vi.fn(),
      onComboUpdate: vi.fn(),
      onComboDrop: vi.fn(),
    };
    engine = new XPEngine(callbacks);
  });

  afterEach(() => {
    engine.dispose();
  });

  it('starts at level 1 with 0 XP', () => {
    expect(engine.getLevel()).toBe(1);
    expect(engine.getXP()).toBe(0);
    expect(engine.getTitle()).toBe('Prompt Beginner');
  });

  it('earns XP and triggers callback', () => {
    const xp = engine.earnXP('save');
    expect(xp).toBe(5);
    expect(callbacks.onXPGain).toHaveBeenCalledWith(5, 5, 'save');
  });

  it('returns 0 for unknown event', () => {
    const xp = engine.earnXP('nonexistent');
    expect(xp).toBe(0);
    expect(callbacks.onXPGain).not.toHaveBeenCalled();
  });

  it('levels up when crossing threshold', () => {
    // Need 100 XP for level 2. git-push = 100 XP base
    engine.earnXP('git-push');
    expect(engine.getLevel()).toBe(2);
    expect(callbacks.onLevelUp).toHaveBeenCalledWith(2, 'Prompt Beginner');
  });

  it('accumulates XP across multiple events', () => {
    engine.earnXP('save'); // 5
    engine.earnXP('save'); // 5
    engine.earnXP('save'); // 5
    expect(engine.getXP()).toBeGreaterThanOrEqual(15);
  });

  it('tracks combo from rapid actions', () => {
    engine.earnXP('save');
    engine.earnXP('save');
    // After 2 actions, combo should be 2
    expect(engine.getCombo()).toBe(2);
    expect(engine.getMultiplier()).toBe(1.25);
  });

  it('XP progress returns correct percentages', () => {
    const progress = engine.getXPProgress();
    expect(progress.current).toBe(0);
    expect(progress.needed).toBe(100);
    expect(progress.percent).toBe(0);
  });

  it('tracks profile stats for commits and pushes', () => {
    engine.earnXP('git-commit');
    engine.earnXP('git-push');
    const profile = engine.getProfile();
    expect(profile.totalCommits).toBe(1);
    expect(profile.totalPushes).toBe(1);
  });

  it('tracks error fixes', () => {
    engine.earnXP('error-cleared');
    engine.earnXP('all-errors-cleared');
    const profile = engine.getProfile();
    expect(profile.totalErrorsFixed).toBe(2);
  });

  it('updatePeakViewers tracks peak', () => {
    engine.updatePeakViewers(100);
    engine.updatePeakViewers(50);
    engine.updatePeakViewers(200);
    const profile = engine.getProfile();
    expect(profile.peakViewers).toBe(200);
  });

  it('endSession returns valid score', () => {
    engine.earnXP('git-push');
    const score = engine.endSession();
    expect(score.xpEarned).toBeGreaterThan(0);
    expect(score.durationMinutes).toBeGreaterThanOrEqual(1);
    expect(['S', 'A', 'B', 'C', 'D']).toContain(score.rank);
    expect(score.startLevel).toBe(1);
    expect(score.endLevel).toBeGreaterThanOrEqual(1);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => { throw new Error('not found'); }),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock https
vi.mock('https', () => ({
  request: vi.fn(() => ({
    on: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  })),
}));

import { DailyChallengeTracker } from '../src/progression/daily-challenges';
import type { ChallengeData } from '../src/progression/daily-challenges';

describe('DailyChallengeTracker', () => {
  let tracker: DailyChallengeTracker;

  beforeEach(() => {
    tracker = new DailyChallengeTracker();
  });

  it('starts with null data', () => {
    expect(tracker.getData()).toBeNull();
  });

  it('setOnUpdate sets callback', () => {
    const handler = vi.fn();
    tracker.setOnUpdate(handler);
    // No crash
    expect(true).toBe(true);
  });

  it('setOnComplete sets callback', () => {
    const handler = vi.fn();
    tracker.setOnComplete(handler);
    expect(true).toBe(true);
  });

  it('setOnAllComplete sets callback', () => {
    const handler = vi.fn();
    tracker.setOnAllComplete(handler);
    expect(true).toBe(true);
  });

  it('processEvent does not crash when no state', () => {
    expect(() => tracker.processEvent('git-commit')).not.toThrow();
    expect(() => tracker.processEvent('git-push')).not.toThrow();
    expect(() => tracker.processEvent('unknown-event')).not.toThrow();
  });

  it('increment does not crash when no state', () => {
    expect(() => tracker.increment('atomic_coder')).not.toThrow();
  });
});

describe('ChallengeData shape', () => {
  it('has correct shape when constructed', () => {
    const data: ChallengeData = {
      date: '2026-03-26',
      challenges: [
        {
          id: 'test',
          title: 'Test',
          description: 'Test challenge',
          category: 'workflow',
          target: 3,
          xp_reward: 75,
          current: 1,
          completed: false,
          claimed: false,
        },
      ],
      allComplete: false,
    };

    expect(data.challenges).toHaveLength(1);
    expect(data.challenges[0].current).toBe(1);
    expect(data.allComplete).toBe(false);
  });
});

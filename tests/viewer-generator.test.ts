import { describe, it, expect, vi } from 'vitest';

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => { throw new Error('not found'); }),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import {
  computeRank,
  rankBadge,
  generateViewer,
  pickRandom,
  updateWatchTime,
  describeSessionViewers,
  getViewerProfiles,
  generateAnonymousProfile,
} from '../src/stream/viewer-generator';

describe('computeRank', () => {
  it('newcomer at 0 minutes', () => {
    expect(computeRank(0)).toBe('newcomer');
  });

  it('regular at 5 minutes', () => {
    expect(computeRank(5)).toBe('regular');
  });

  it('fan at 20 minutes', () => {
    expect(computeRank(20)).toBe('fan');
  });

  it('sub at 60 minutes', () => {
    expect(computeRank(60)).toBe('sub');
  });

  it('vip at 180 minutes', () => {
    expect(computeRank(180)).toBe('vip');
  });

  it('og at 500 minutes', () => {
    expect(computeRank(500)).toBe('og');
  });
});

describe('rankBadge', () => {
  it('returns empty for newcomer', () => {
    expect(rankBadge('newcomer')).toBe('');
  });

  it('returns SUB for sub', () => {
    expect(rankBadge('sub')).toBe('SUB');
  });

  it('returns VIP for vip', () => {
    expect(rankBadge('vip')).toBe('VIP');
  });

  it('returns OG for og', () => {
    expect(rankBadge('og')).toBe('OG');
  });
});

describe('generateViewer', () => {
  it('generates a viewer with all required fields', () => {
    const usedNames = new Set<string>();
    const viewer = generateViewer('hype', 'en', usedNames);

    expect(viewer.id).toBeTruthy();
    expect(viewer.name).toBeTruthy();
    expect(viewer.color).toMatch(/^#/);
    expect(viewer.personality).toBe('hype');
    expect(viewer.lang).toBe('en');
    expect(viewer.rank).toBe('newcomer');
    expect(viewer.profile.age).toBeGreaterThanOrEqual(16);
    expect(viewer.profile.age).toBeLessThanOrEqual(25);
    expect(viewer.dna.flavor).toBeTruthy();
    expect(viewer.dna.description).toBeTruthy();
    expect(viewer.stats.watchMinutes).toBe(0);
    expect(viewer.stats.sessionsWatched).toBe(1);
  });

  it('generates unique names', () => {
    const usedNames = new Set<string>();
    const viewers = Array.from({ length: 20 }, () =>
      generateViewer('hype', 'en', usedNames)
    );
    const names = viewers.map(v => v.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('generates Hebrew viewers', () => {
    const usedNames = new Set<string>();
    const viewer = generateViewer('troll', 'he', usedNames);
    expect(viewer.lang).toBe('he');
  });

  it('assigns languages array', () => {
    const usedNames = new Set<string>();
    const viewer = generateViewer('noob', 'en', usedNames);
    expect(viewer.languages).toContain('en');
  });

  it('generates all personality types', () => {
    const personalities = ['hype', 'troll', 'noob', 'veteran', 'critic', 'lurker', 'spammer'] as const;
    const usedNames = new Set<string>();
    for (const p of personalities) {
      const viewer = generateViewer(p, 'en', usedNames);
      expect(viewer.personality).toBe(p);
      expect(viewer.dna.flavor).toBeTruthy();
    }
  });
});

describe('pickRandom', () => {
  it('picks requested count', () => {
    const usedNames = new Set<string>();
    const roster = Array.from({ length: 10 }, () =>
      generateViewer('hype', 'en', usedNames)
    );
    const picked = pickRandom(roster, 3);
    expect(picked).toHaveLength(3);
  });

  it('never exceeds roster size', () => {
    const usedNames = new Set<string>();
    const roster = Array.from({ length: 3 }, () =>
      generateViewer('hype', 'en', usedNames)
    );
    const picked = pickRandom(roster, 10);
    expect(picked).toHaveLength(3);
  });
});

describe('updateWatchTime', () => {
  it('updates watch time and detects rank ups', () => {
    const usedNames = new Set<string>();
    const viewer = generateViewer('hype', 'en', usedNames);
    expect(viewer.rank).toBe('newcomer');

    const rankUps = updateWatchTime([viewer], 60);
    expect(viewer.stats.watchMinutes).toBe(60);
    expect(viewer.rank).toBe('sub');
    expect(rankUps.length).toBeGreaterThanOrEqual(1);
  });
});

describe('describeSessionViewers', () => {
  it('returns a string with viewer descriptions', () => {
    const usedNames = new Set<string>();
    const roster = [
      generateViewer('hype', 'en', usedNames),
      generateViewer('troll', 'en', usedNames),
    ];
    const desc = describeSessionViewers(roster);
    expect(desc).toContain('English-language stream');
    expect(desc).toContain(roster[0].name);
    expect(desc).toContain(roster[1].name);
  });
});

describe('getViewerProfiles', () => {
  it('returns serializable profile data', () => {
    const usedNames = new Set<string>();
    const roster = [generateViewer('veteran', 'en', usedNames)];
    const profiles = getViewerProfiles(roster);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe(roster[0].name);
    expect(profiles[0].personalityEmoji).toBeTruthy();
  });
});

describe('generateAnonymousProfile', () => {
  it('generates a profile for a name', () => {
    const profile = generateAnonymousProfile('TestUser');
    expect(profile.name).toBe('TestUser');
    expect(profile.color).toMatch(/^#/);
    expect(profile.rank).toBe('newcomer');
    expect(profile.personality).toBeTruthy();
  });
});

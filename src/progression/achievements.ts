// ═══════════════════════════════════════════════════════════════
// Achievements — 25+ unlockable milestones for VibeStream.
// Categories: coding, streaming, social, streak, special.
// AchievementTracker loads/saves from ~/.vibestream/profile.json.
// ═══════════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as path from 'path';

// ═══ Types ═══

export type AchievementCategory = 'coding' | 'streaming' | 'social' | 'streak' | 'special';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: string;
  requirement: string;
  checkFn?: (stats: SessionStats) => boolean;
}

export interface SessionStats {
  totalXP: number;
  level: number;
  sessionMinutes: number;
  sessionXP: number;
  totalSessions: number;
  totalCommits: number;
  totalPushes: number;
  totalErrorsFixed: number;
  peakViewers: number;
  streakDays: number;
  totalWatchMinutes: number;
  currentCombo: number;
  peakCombo: number;
  messagesTyped: number;
}

export interface AchievementWithStatus extends Achievement {
  unlocked: boolean;
  unlockedAt?: string;
}

// ═══ Profile Shape (achievements slice) ═══

interface ProfileAchievements {
  achievements: string[];
  [key: string]: unknown;
}

// ═══ All Achievements ═══

export const ALL_ACHIEVEMENTS: Achievement[] = [
  // ── Coding ──
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Fix your first error',
    category: 'coding',
    icon: '🩸',
    requirement: 'Fix 1 error',
    checkFn: (s) => s.totalErrorsFixed >= 1,
  },
  {
    id: 'bug_slayer',
    name: 'Bug Slayer',
    description: 'Fix 50 errors lifetime',
    category: 'coding',
    icon: '🗡️',
    requirement: 'Fix 50 errors',
    checkFn: (s) => s.totalErrorsFixed >= 50,
  },
  {
    id: 'bug_exterminator',
    name: 'Bug Exterminator',
    description: 'Fix 500 errors — absolutely ruthless',
    category: 'coding',
    icon: '☠️',
    requirement: 'Fix 500 errors',
    checkFn: (s) => s.totalErrorsFixed >= 500,
  },
  {
    id: 'shipper',
    name: 'Shipper',
    description: 'Your first git push — it\'s alive!',
    category: 'coding',
    icon: '🚀',
    requirement: '1 git push',
    checkFn: (s) => s.totalPushes >= 1,
  },
  {
    id: 'shipping_machine',
    name: 'Shipping Machine',
    description: '50 pushes lifetime — never stop shipping',
    category: 'coding',
    icon: '⚙️',
    requirement: '50 git pushes',
    checkFn: (s) => s.totalPushes >= 50,
  },
  {
    id: 'atomic_coder',
    name: 'Atomic Coder',
    description: '100 commits — history is your legacy',
    category: 'coding',
    icon: '⚛️',
    requirement: '100 commits',
    checkFn: (s) => s.totalCommits >= 100,
  },
  {
    id: 'commit_legend',
    name: 'Commit Legend',
    description: '500 commits — you\'re basically git itself',
    category: 'coding',
    icon: '🏛️',
    requirement: '500 commits',
    checkFn: (s) => s.totalCommits >= 500,
  },

  // ── Streaming ──
  {
    id: 'first_stream',
    name: 'First Stream',
    description: 'Complete your first coding session',
    category: 'streaming',
    icon: '📡',
    requirement: 'Complete 1 session',
    checkFn: (s) => s.totalSessions >= 1,
  },
  {
    id: 'crowd_pleaser',
    name: 'Crowd Pleaser',
    description: 'Peak 1,000 concurrent viewers',
    category: 'streaming',
    icon: '🎉',
    requirement: '1,000 peak viewers',
    checkFn: (s) => s.peakViewers >= 1000,
  },
  {
    id: 'viral',
    name: 'Going Viral',
    description: 'Peak 5,000 concurrent viewers',
    category: 'streaming',
    icon: '🔥',
    requirement: '5,000 peak viewers',
    checkFn: (s) => s.peakViewers >= 5000,
  },
  {
    id: 'double_feature',
    name: 'Double Feature',
    description: 'Code for 2+ hours in a single session',
    category: 'streaming',
    icon: '🎬',
    requirement: '120+ minute session',
    checkFn: (s) => s.sessionMinutes >= 120,
  },
  {
    id: 'marathon',
    name: 'Marathon',
    description: 'Code for 3+ hours in a single session',
    category: 'streaming',
    icon: '🏃',
    requirement: '180+ minute session',
    checkFn: (s) => s.sessionMinutes >= 180,
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Code in the dead of night (midnight – 5am)',
    category: 'streaming',
    icon: '🦉',
    requirement: 'Code between 12am – 5am',
    checkFn: () => {
      const h = new Date().getHours();
      return h >= 0 && h < 5;
    },
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Code before the world wakes up (5am – 7am)',
    category: 'streaming',
    icon: '🐦',
    requirement: 'Code between 5am – 7am',
    checkFn: () => {
      const h = new Date().getHours();
      return h >= 5 && h < 7;
    },
  },

  // ── Social ──
  {
    id: 'first_words',
    name: 'First Words',
    description: 'Send your first chat message',
    category: 'social',
    icon: '💬',
    requirement: 'Send 1 chat message',
    checkFn: (s) => s.messagesTyped >= 1,
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Send 10 messages in chat',
    category: 'social',
    icon: '🦋',
    requirement: 'Send 10 chat messages',
    checkFn: (s) => s.messagesTyped >= 10,
  },
  {
    id: 'chat_god',
    name: 'Chat God',
    description: 'Send 50 messages — who\'s the streamer here?',
    category: 'social',
    icon: '👑',
    requirement: 'Send 50 chat messages',
    checkFn: (s) => s.messagesTyped >= 50,
  },

  // ── Streak ──
  {
    id: 'consistent',
    name: 'Consistent',
    description: 'Code 7 days in a row',
    category: 'streak',
    icon: '📅',
    requirement: '7-day streak',
    checkFn: (s) => s.streakDays >= 7,
  },
  {
    id: 'dedicated',
    name: 'Dedicated',
    description: 'Code 30 days in a row — no days off',
    category: 'streak',
    icon: '💪',
    requirement: '30-day streak',
    checkFn: (s) => s.streakDays >= 30,
  },
  {
    id: 'immortal',
    name: 'Immortal',
    description: 'Code 100 days in a row — you are unstoppable',
    category: 'streak',
    icon: '⚡',
    requirement: '100-day streak',
    checkFn: (s) => s.streakDays >= 100,
  },
  {
    id: 'weekly_warrior',
    name: 'Weekly Warrior',
    description: 'Complete 7 total sessions',
    category: 'streak',
    icon: '🛡️',
    requirement: '7 total sessions',
    checkFn: (s) => s.totalSessions >= 7,
  },
  {
    id: 'monthly_grinder',
    name: 'Monthly Grinder',
    description: 'Complete 30 total sessions',
    category: 'streak',
    icon: '⚙️',
    requirement: '30 total sessions',
    checkFn: (s) => s.totalSessions >= 30,
  },

  // ── Special ──
  {
    id: 'leveled_up',
    name: 'Level Up!',
    description: 'Reach level 5',
    category: 'special',
    icon: '✨',
    requirement: 'Level 5',
    checkFn: (s) => s.level >= 5,
  },
  {
    id: 'double_digits',
    name: 'Double Digits',
    description: 'Reach level 10',
    category: 'special',
    icon: '🔟',
    requirement: 'Level 10',
    checkFn: (s) => s.level >= 10,
  },
  {
    id: 'senior_dev',
    name: 'Senior Dev',
    description: 'Reach level 30 — you\'ve paid your dues',
    category: 'special',
    icon: '🎓',
    requirement: 'Level 30',
    checkFn: (s) => s.level >= 30,
  },
  {
    id: 'combo_king',
    name: 'Combo King',
    description: 'Hit a x5 combo multiplier',
    category: 'special',
    icon: '🔥',
    requirement: 'x5 combo',
    checkFn: (s) => s.peakCombo >= 5,
  },
  {
    id: 'xp_hoarder',
    name: 'XP Hoarder',
    description: 'Earn 10,000 total XP',
    category: 'special',
    icon: '💎',
    requirement: '10,000 total XP',
    checkFn: (s) => s.totalXP >= 10_000,
  },
  {
    id: 'time_lord',
    name: 'Time Lord',
    description: '1,000 total minutes watched',
    category: 'special',
    icon: '⏳',
    requirement: '1,000 watch minutes',
    checkFn: (s) => s.totalWatchMinutes >= 1000,
  },
  {
    id: 's_rank',
    name: 'S-Rank Session',
    description: 'Earn an S-rank at the end of a session',
    category: 'special',
    icon: '🌟',
    requirement: 'S-rank session score',
    // No checkFn — unlocked externally by XPEngine when session rank === 'S'
  },
];

// ═══ Profile Helpers ═══

const PROFILE_DIR = path.join(process.env.HOME ?? '/tmp', '.vibestream');
const PROFILE_PATH = path.join(PROFILE_DIR, 'profile.json');

function loadUnlockedIds(): string[] {
  try {
    const raw = fs.readFileSync(PROFILE_PATH, 'utf-8');
    const profile = JSON.parse(raw) as ProfileAchievements;
    return Array.isArray(profile.achievements) ? profile.achievements : [];
  } catch {
    return [];
  }
}

function saveUnlockedIds(ids: string[]): void {
  try {
    if (!fs.existsSync(PROFILE_DIR)) {
      fs.mkdirSync(PROFILE_DIR, { recursive: true });
    }

    let profile: ProfileAchievements = { achievements: [] };

    try {
      const raw = fs.readFileSync(PROFILE_PATH, 'utf-8');
      profile = JSON.parse(raw) as ProfileAchievements;
    } catch {
      // Profile doesn't exist yet — start fresh
    }

    profile.achievements = ids;
    fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2));
  } catch {
    // Silent — never crash the extension over a save failure
  }
}

// ═══ Achievement Tracker ═══

export class AchievementTracker {
  private unlockedIds: Set<string>;

  constructor() {
    this.unlockedIds = new Set(loadUnlockedIds());
  }

  /**
   * Evaluate all achievements against the given stats.
   * Returns only achievements that are NEWLY unlocked this call.
   */
  check(stats: SessionStats): Achievement[] {
    const newlyUnlocked: Achievement[] = [];

    for (const achievement of ALL_ACHIEVEMENTS) {
      if (this.unlockedIds.has(achievement.id)) continue;
      if (!achievement.checkFn) continue;

      const unlocked = achievement.checkFn(stats);
      if (unlocked) {
        this.unlockedIds.add(achievement.id);
        newlyUnlocked.push(achievement);
      }
    }

    if (newlyUnlocked.length > 0) {
      saveUnlockedIds([...this.unlockedIds]);
    }

    return newlyUnlocked;
  }

  /**
   * Manually unlock an achievement by ID (e.g. 's_rank' triggered externally).
   * Returns the Achievement if it was newly unlocked, undefined if already had it.
   */
  unlock(id: string): Achievement | undefined {
    if (this.unlockedIds.has(id)) return undefined;

    const achievement = ALL_ACHIEVEMENTS.find((a) => a.id === id);
    if (!achievement) return undefined;

    this.unlockedIds.add(id);
    saveUnlockedIds([...this.unlockedIds]);
    return achievement;
  }

  /** All achievements with their unlocked status. */
  getAll(): AchievementWithStatus[] {
    return ALL_ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: this.unlockedIds.has(a.id),
    }));
  }

  /** Only the achievements that have been unlocked. */
  getUnlocked(): AchievementWithStatus[] {
    return this.getAll().filter((a) => a.unlocked);
  }

  /** Raw set of unlocked IDs — useful for serialization. */
  getUnlockedIds(): string[] {
    return [...this.unlockedIds];
  }

  /** Total count of achievements (useful for progress display). */
  get total(): number {
    return ALL_ACHIEVEMENTS.length;
  }

  /** Number of achievements unlocked so far. */
  get unlockedCount(): number {
    return this.unlockedIds.size;
  }
}

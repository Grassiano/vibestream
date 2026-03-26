// ═══════════════════════════════════════════════════════════════
// XP Engine — progression, combos, levels, and persistence.
// Every coding action earns XP. Good patterns = more XP.
// Combos multiply gains. Levels have titles. Everything saves.
// ═══════════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// ═══ Level Titles ═══

const LEVEL_TITLES: Array<{ maxLevel: number; title: string }> = [
  { maxLevel: 5,  title: 'Prompt Beginner' },
  { maxLevel: 10, title: 'Prompt Apprentice' },
  { maxLevel: 15, title: 'Prompt Crafter' },
  { maxLevel: 20, title: 'AI Pair Programmer' },
  { maxLevel: 25, title: 'Code Conductor' },
  { maxLevel: 30, title: 'Vibe Architect' },
  { maxLevel: 40, title: 'Shipping Machine' },
  { maxLevel: 50, title: '10x Vibe Coder' },
  { maxLevel: 60, title: 'AI Whisperer' },
  { maxLevel: 75, title: 'Vibe Sensei' },
  { maxLevel: 90, title: 'Digital Maestro' },
  { maxLevel: 99, title: 'GOAT' },
];

export function getTitleForLevel(level: number): string {
  for (const entry of LEVEL_TITLES) {
    if (level <= entry.maxLevel) return entry.title;
  }
  return 'GOAT';
}

// ═══ Level Thresholds — soft curve (each level = prev + 10%) ═══

function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  let increment = 100;
  for (let i = 2; i <= level; i++) {
    total += increment;
    increment = Math.floor(increment * 1.1);
  }
  return total;
}

function xpToNextLevel(level: number): number {
  return xpForLevel(level + 1) - xpForLevel(level);
}

export function levelFromXP(totalXP: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXP && level < 99) {
    level++;
  }
  return level;
}

// ═══ XP Sources ═══

const XP_VALUES: Record<string, number> = {
  'save':                5,
  'error-added':         2,
  'error-cleared':       15,
  'all-errors-cleared':  40,
  'git-commit':          50,
  'git-push':            100,
  'build-pass':          30,
  'build-fail':          5,
  'keystroke':           1,
  'vibe-code-landed':    20,
  'convo-user-prompted': 8,
  'convo-user-building': 5,
  'convo-user-fixing':   10,
  'convo-user-debugging':6,
  'convo-new-topic':     3,
  'convo-deep-dive':     15,
  'claude-response':     3,
  'streamer-chat':       2,
  'milestone':           50,
  'daily-challenge':     75,
  'all-dailies':         150,
  'mass-delete':         10,
  'large-file':          5,
  'language-change':     2,
};

export function getXPForEvent(eventType: string): number {
  return XP_VALUES[eventType] ?? 0;
}

// ═══ Combo System ═══

const COMBO_WINDOW_MS = 30_000;
const COMBO_DECAY_MS = 45_000;

function getMultiplier(combo: number): number {
  if (combo >= 5) return 2.0;
  if (combo === 4) return 1.75;
  if (combo === 3) return 1.5;
  if (combo === 2) return 1.25;
  return 1.0;
}

// ═══ Profile Persistence ═══

const PROFILE_DIR = path.join(process.env.HOME ?? '/tmp', '.vibestream');
const PROFILE_PATH = path.join(PROFILE_DIR, 'profile.json');

export interface PlayerProfile {
  xp: number;
  level: number;
  title: string;
  streakDays: number;
  streakLastDate: string;
  prestigeCount: number;
  achievements: string[];
  totalSessions: number;
  totalWatchMinutes: number;
  peakViewers: number;
  totalCommits: number;
  totalPushes: number;
  totalErrorsFixed: number;
}

function defaultProfile(): PlayerProfile {
  return {
    xp: 0, level: 1, title: 'Prompt Beginner',
    streakDays: 0, streakLastDate: '', prestigeCount: 0,
    achievements: [], totalSessions: 0, totalWatchMinutes: 0,
    peakViewers: 0, totalCommits: 0, totalPushes: 0, totalErrorsFixed: 0,
  };
}

function loadProfile(): PlayerProfile {
  try {
    const data = fs.readFileSync(PROFILE_PATH, 'utf-8');
    return { ...defaultProfile(), ...JSON.parse(data) };
  } catch {
    return defaultProfile();
  }
}

function saveProfile(profile: PlayerProfile): void {
  try {
    if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });
    fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2));
  } catch { /* silent */ }
}

// ═══ Session Score ═══

export type SessionRank = 'S' | 'A' | 'B' | 'C' | 'D';

export interface SessionScore {
  rank: SessionRank;
  xpEarned: number;
  durationMinutes: number;
  peakCombo: number;
  peakViewers: number;
  levelsGained: number;
  startLevel: number;
  endLevel: number;
  startTitle: string;
  endTitle: string;
}

function computeSessionRank(xpPerMinute: number): SessionRank {
  if (xpPerMinute >= 8) return 'S';
  if (xpPerMinute >= 5) return 'A';
  if (xpPerMinute >= 3) return 'B';
  if (xpPerMinute >= 1.5) return 'C';
  return 'D';
}

// ═══ XP Engine ═══

export interface XPCallbacks {
  onXPGain: (amount: number, total: number, source: string) => void;
  onLevelUp: (level: number, title: string) => void;
  onComboUpdate: (combo: number, multiplier: number) => void;
  onComboDrop: () => void;
}

export class XPEngine {
  private profile: PlayerProfile;
  private callbacks: XPCallbacks;
  private combo = 0;
  private comboActions: number[] = [];
  private comboTimer: ReturnType<typeof setTimeout> | null = null;
  private peakCombo = 0;
  private sessionXP = 0;
  private sessionStart = Date.now();
  private startLevel = 1;
  private peakViewers = 0;

  constructor(callbacks: XPCallbacks) {
    this.callbacks = callbacks;
    this.profile = loadProfile();
    this.startLevel = this.profile.level;
    this.profile.totalSessions++;
    this.updateStreak();
  }

  getProfile(): PlayerProfile { return { ...this.profile }; }
  getLevel(): number { return this.profile.level; }
  getTitle(): string { return this.profile.title; }
  getXP(): number { return this.profile.xp; }
  getCombo(): number { return this.combo; }
  getMultiplier(): number { return getMultiplier(this.combo); }

  getXPProgress(): { current: number; needed: number; percent: number } {
    const currentLevelXP = xpForLevel(this.profile.level);
    const needed = xpToNextLevel(this.profile.level);
    const current = this.profile.xp - currentLevelXP;
    const percent = needed > 0 ? Math.min(100, (current / needed) * 100) : 100;
    return { current, needed, percent };
  }

  updatePeakViewers(count: number): void {
    if (count > this.peakViewers) this.peakViewers = count;
    if (count > this.profile.peakViewers) this.profile.peakViewers = count;
  }

  earnXP(eventType: string): number {
    const baseXP = getXPForEvent(eventType);
    if (baseXP <= 0) return 0;

    this.updateCombo();
    const multiplier = getMultiplier(this.combo);
    const finalXP = Math.round(baseXP * multiplier);

    const oldLevel = this.profile.level;
    this.profile.xp += finalXP;
    this.sessionXP += finalXP;
    this.profile.level = levelFromXP(this.profile.xp);
    this.profile.title = getTitleForLevel(this.profile.level);

    if (eventType === 'git-commit') this.profile.totalCommits++;
    if (eventType === 'git-push') this.profile.totalPushes++;
    if (eventType === 'error-cleared' || eventType === 'all-errors-cleared') this.profile.totalErrorsFixed++;

    this.callbacks.onXPGain(finalXP, this.profile.xp, eventType);

    if (this.profile.level > oldLevel) {
      this.callbacks.onLevelUp(this.profile.level, this.profile.title);
    }

    saveProfile(this.profile);
    return finalXP;
  }

  private updateCombo(): void {
    const now = Date.now();
    this.comboActions.push(now);
    this.comboActions = this.comboActions.filter(t => now - t < COMBO_WINDOW_MS);

    const oldCombo = this.combo;
    this.combo = Math.min(5, this.comboActions.length);
    if (this.combo > this.peakCombo) this.peakCombo = this.combo;

    if (this.combo !== oldCombo && this.combo >= 2) {
      this.callbacks.onComboUpdate(this.combo, getMultiplier(this.combo));
    }

    if (this.comboTimer) clearTimeout(this.comboTimer);
    this.comboTimer = setTimeout(() => {
      if (this.combo > 0) {
        this.combo = 0;
        this.comboActions = [];
        this.callbacks.onComboDrop();
      }
    }, COMBO_DECAY_MS);
  }

  private updateStreak(): void {
    const today = new Date().toISOString().split('T')[0];
    if (this.profile.streakLastDate === today) return;
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    if (this.profile.streakLastDate === yesterday) {
      this.profile.streakDays++;
    } else {
      this.profile.streakDays = 1;
    }
    this.profile.streakLastDate = today;
    saveProfile(this.profile);
  }

  endSession(): SessionScore {
    const durationMinutes = Math.max(1, Math.round((Date.now() - this.sessionStart) / 60_000));
    this.profile.totalWatchMinutes += durationMinutes;
    saveProfile(this.profile);
    return {
      rank: computeSessionRank(this.sessionXP / durationMinutes),
      xpEarned: this.sessionXP, durationMinutes,
      peakCombo: this.peakCombo, peakViewers: this.peakViewers,
      levelsGained: this.profile.level - this.startLevel,
      startLevel: this.startLevel, endLevel: this.profile.level,
      startTitle: getTitleForLevel(this.startLevel), endTitle: this.profile.title,
    };
  }

  dispose(): void {
    if (this.comboTimer) clearTimeout(this.comboTimer);
    saveProfile(this.profile);
  }
}

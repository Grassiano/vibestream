// ═══════════════════════════════════════════════════════════════
// Daily Challenges — fetch from backend, track progress locally.
// 3 challenges per day, same for all users. Progress persists
// in ~/.vibestream/challenges.json and resets each day.
// ═══════════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';

const PROFILE_DIR = path.join(process.env.HOME ?? '/tmp', '.vibestream');
const CHALLENGES_PATH = path.join(PROFILE_DIR, 'challenges.json');

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  category: string;
  target: number;
  xp_reward: number;
}

export interface ChallengeProgress {
  id: string;
  current: number;
  target: number;
  completed: boolean;
  claimed: boolean;
}

interface SavedChallengeState {
  date: string;
  challenges: DailyChallenge[];
  progress: Record<string, ChallengeProgress>;
}

export interface ChallengeData {
  date: string;
  challenges: Array<DailyChallenge & ChallengeProgress>;
  allComplete: boolean;
}

function loadState(): SavedChallengeState | null {
  try {
    const raw = fs.readFileSync(CHALLENGES_PATH, 'utf-8');
    return JSON.parse(raw) as SavedChallengeState;
  } catch {
    return null;
  }
}

function saveState(state: SavedChallengeState): void {
  try {
    if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });
    fs.writeFileSync(CHALLENGES_PATH, JSON.stringify(state, null, 2));
  } catch { /* silent */ }
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export class DailyChallengeTracker {
  private state: SavedChallengeState | null = null;
  private onUpdate: ((data: ChallengeData) => void) | undefined;
  private onComplete: ((challenge: DailyChallenge) => void) | undefined;
  private onAllComplete: (() => void) | undefined;

  setOnUpdate(handler: (data: ChallengeData) => void): void {
    this.onUpdate = handler;
  }

  setOnComplete(handler: (challenge: DailyChallenge) => void): void {
    this.onComplete = handler;
  }

  setOnAllComplete(handler: () => void): void {
    this.onAllComplete = handler;
  }

  async fetchAndLoad(backendUrl: string): Promise<void> {
    const today = todayStr();

    // Check if we already have today's challenges
    const existing = loadState();
    if (existing && existing.date === today && existing.challenges.length > 0) {
      this.state = existing;
      this.emitUpdate();
      return;
    }

    // Fetch from backend
    const challenges = await this.fetchChallenges(backendUrl);
    if (!challenges || challenges.length === 0) return;

    this.state = {
      date: today,
      challenges,
      progress: {},
    };

    for (const c of challenges) {
      this.state.progress[c.id] = {
        id: c.id,
        current: 0,
        target: c.target,
        completed: false,
        claimed: false,
      };
    }

    saveState(this.state);
    this.emitUpdate();
  }

  /** Increment progress on a challenge by event type mapping */
  increment(challengeId: string, amount = 1): void {
    if (!this.state) return;
    const progress = this.state.progress[challengeId];
    if (!progress || progress.completed) return;

    progress.current = Math.min(progress.target, progress.current + amount);

    if (progress.current >= progress.target && !progress.completed) {
      progress.completed = true;
      const challenge = this.state.challenges.find(c => c.id === challengeId);
      if (challenge) this.onComplete?.(challenge);

      // Check if all complete
      const allDone = Object.values(this.state.progress).every(p => p.completed);
      if (allDone) this.onAllComplete?.();
    }

    saveState(this.state);
    this.emitUpdate();
  }

  /** Process a coding event and map it to challenge progress */
  processEvent(eventType: string, detail?: string): void {
    if (!this.state) return;

    for (const challenge of this.state.challenges) {
      const progress = this.state.progress[challenge.id];
      if (!progress || progress.completed) continue;

      // Map events to challenge IDs
      switch (challenge.id) {
        case 'atomic_coder':
          if (eventType === 'git-commit') this.increment(challenge.id);
          break;
        case 'ship_shape':
          if (eventType === 'git-push') this.increment(challenge.id);
          break;
        case 'git_discipline':
          if (eventType === 'git-commit') this.increment(challenge.id);
          break;
        case 'wordsmith':
          if (eventType === 'git-commit') this.increment(challenge.id);
          break;
        case 'flow_state':
          if (eventType === 'flow-state-reached') this.increment(challenge.id);
          break;
        case 'marathon_lite':
          if (eventType === 'session-90min') this.increment(challenge.id);
          break;
        case 'eagle_eye':
          if (eventType === 'quick-edit') this.increment(challenge.id);
          break;
        case 'zero_regret':
          if (eventType === 'session-no-error-loops') this.increment(challenge.id);
          break;
        case 'clean_accept':
          if (eventType === 'clean-accept') this.increment(challenge.id);
          break;
        case 'efficient_communicator':
          if (eventType === 'short-prompt-success') this.increment(challenge.id);
          break;
        case 'sniper':
          if (eventType === 'one-shot-success') this.increment(challenge.id);
          break;
        case 'context_king':
          if (eventType === 'error-context-prompt') this.increment(challenge.id);
          break;
        case 'constraint_crafter':
          if (eventType === 'constraint-prompt') this.increment(challenge.id);
          break;
        case 'single_focus':
          if (eventType === 'single-focus-15min') this.increment(challenge.id);
          break;
        case 'quality_gate':
          if (eventType === 'build-after-accept') this.increment(challenge.id);
          break;
        case 'smart_break':
          if (eventType === 'smart-break') this.increment(challenge.id);
          break;
      }
    }
  }

  getData(): ChallengeData | null {
    if (!this.state) return null;
    return this.buildData();
  }

  private buildData(): ChallengeData {
    const challenges = (this.state?.challenges ?? []).map(c => ({
      ...c,
      ...(this.state?.progress[c.id] ?? { id: c.id, current: 0, target: c.target, completed: false, claimed: false }),
    }));

    return {
      date: this.state?.date ?? todayStr(),
      challenges,
      allComplete: challenges.every(c => c.completed),
    };
  }

  private emitUpdate(): void {
    this.onUpdate?.(this.buildData());
  }

  private fetchChallenges(backendUrl: string): Promise<DailyChallenge[] | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 10_000);

      const url = new URL(`${backendUrl}/api/challenges/daily`);

      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname,
          method: 'GET',
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          headers: { 'Content-Type': 'application/json' },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            clearTimeout(timer);
            try {
              const parsed = JSON.parse(data) as { challenges: DailyChallenge[] };
              resolve(parsed.challenges ?? null);
            } catch {
              resolve(null);
            }
          });
        },
      );

      req.on('error', () => {
        clearTimeout(timer);
        resolve(null);
      });

      req.end();
    });
  }
}

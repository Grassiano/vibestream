// ═══════════════════════════════════════════════════════════════
// Viewer Count Engine — makes the viewer count feel alive.
// Tick-based system with momentum, noise, spikes, and milestones.
// ═══════════════════════════════════════════════════════════════

import * as vscode from 'vscode';

const TICK_MS = 3000; // Update every 3 seconds
const NOISE_RANGE = 3; // Random ±3 fluctuation per tick
const GRAVITY = -1.5; // Natural drift down per tick when idle
const IDLE_THRESHOLD_MS = 30_000; // 30s no activity = idle
const DEEP_IDLE_MS = 120_000; // 2min no activity = bleeding
const DEEP_IDLE_GRAVITY = -8; // Faster bleed when deep idle
const MOMENTUM_DECAY = 0.85; // Momentum loses 15% per tick
const OVERSHOOT_FACTOR = 1.15; // Spikes overshoot by 15%
const SETTLE_SPEED = 0.3; // How fast overshoot settles back

// Viewer count grows logarithmically — harder to grow at higher counts
function growthFactor(current: number): number {
  if (current < 100) return 1.0;
  if (current < 500) return 0.7;
  if (current < 1000) return 0.5;
  if (current < 5000) return 0.3;
  return 0.15;
}

const MILESTONES = [100, 250, 500, 1000, 2500, 5000, 10000];

export interface ViewerEngineCallbacks {
  onCountUpdate: (count: number) => void;
  onMilestone: (milestone: number) => void;
}

export class ViewerEngine {
  private count = 0;
  private displayCount = 0; // What the user sees (smoothed)
  private targetCount = 0; // Where count is heading (after overshoot)
  private momentum = 0; // Current velocity from spikes
  private lastActivity = Date.now();
  private timer: ReturnType<typeof setInterval> | null = null;
  private reachedMilestones = new Set<number>();
  private callbacks: ViewerEngineCallbacks;
  private baselineCount = 0; // Floor that slowly rises with session time
  private sessionMinutes = 0;

  constructor(callbacks: ViewerEngineCallbacks) {
    this.callbacks = callbacks;
  }

  start(initialCount = 5): vscode.Disposable {
    this.count = initialCount;
    this.displayCount = initialCount;
    this.targetCount = initialCount;
    this.baselineCount = initialCount;
    this.lastActivity = Date.now();
    this.reachedMilestones.clear();
    this.sessionMinutes = 0;

    this.timer = setInterval(() => this.tick(), TICK_MS);

    return new vscode.Disposable(() => {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    });
  }

  // Call this when any coding activity happens
  activity(): void {
    this.lastActivity = Date.now();
  }

  // Spike the viewer count from an event
  spike(amount: number): void {
    this.lastActivity = Date.now();
    const scaled = Math.round(amount * growthFactor(this.count));
    this.momentum += scaled;
    // Overshoot target, then settle
    this.targetCount = this.count + Math.round(scaled * OVERSHOOT_FACTOR);
  }

  getCount(): number {
    return Math.max(0, Math.round(this.displayCount));
  }

  private tick(): void {
    this.sessionMinutes += TICK_MS / 60_000;

    // Baseline slowly rises over time (you gain viewers just by being live)
    this.baselineCount = Math.min(50, 5 + Math.floor(this.sessionMinutes * 0.5));

    const now = Date.now();
    const idleTime = now - this.lastActivity;

    // Apply momentum (from spikes)
    if (Math.abs(this.momentum) > 0.5) {
      this.count += this.momentum;
      this.momentum *= MOMENTUM_DECAY;
      if (Math.abs(this.momentum) < 0.5) this.momentum = 0;
    }

    // Overshoot settle — if count overshot target, pull back
    if (this.targetCount > 0 && this.count > this.targetCount) {
      this.count -= (this.count - this.targetCount) * SETTLE_SPEED;
    }

    // Gravity (idle decay)
    if (idleTime > DEEP_IDLE_MS) {
      this.count += DEEP_IDLE_GRAVITY;
    } else if (idleTime > IDLE_THRESHOLD_MS) {
      this.count += GRAVITY;
    } else {
      // Active — slow organic growth
      this.count += 1 + Math.random() * 2;
    }

    // Noise — constant tiny fluctuation so the number feels alive
    this.count += (Math.random() - 0.5) * NOISE_RANGE * 2;

    // Floor — never go below baseline
    this.count = Math.max(this.baselineCount, this.count);

    // Smooth display — animate toward actual count
    const diff = this.count - this.displayCount;
    if (Math.abs(diff) < 1) {
      this.displayCount = this.count;
    } else {
      this.displayCount += diff * 0.3;
    }

    const finalCount = this.getCount();

    // Check milestones
    for (const milestone of MILESTONES) {
      if (finalCount >= milestone && !this.reachedMilestones.has(milestone)) {
        this.reachedMilestones.add(milestone);
        this.callbacks.onMilestone(milestone);
      }
    }

    this.callbacks.onCountUpdate(finalCount);
  }
}

// Event → spike amount mapping
export const VIEWER_SPIKES: Record<string, [number, number]> = {
  // [min, max] — random in range
  'save':              [5, 15],
  'error-added':       [20, 40],
  'error-cleared':     [30, 50],
  'all-errors-cleared':[40, 70],
  'git-commit':        [50, 100],
  'git-push':          [100, 200],
  'build-pass':        [40, 80],
  'build-fail':        [15, 30],
  'keystroke':         [1, 3],
  'ai-start':          [5, 10],
  'ai-end':            [20, 40],
  'convo-user-prompted': [8, 20],
  'claude-response':   [5, 15],
  'streamer-chat':     [10, 20],
  'raid':              [150, 400],
};

export function getSpikeAmount(eventType: string): number {
  const range = VIEWER_SPIKES[eventType];
  if (!range) return 0;
  return range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
}

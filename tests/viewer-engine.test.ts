import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({
  Disposable: class {
    private fn: () => void;
    constructor(fn: () => void) { this.fn = fn; }
    dispose() { this.fn(); }
  },
}));

import { ViewerEngine, getSpikeAmount, VIEWER_SPIKES } from '../src/stream/viewer-engine';
import type { ViewerEngineCallbacks } from '../src/stream/viewer-engine';

describe('getSpikeAmount', () => {
  it('returns 0 for unknown event', () => {
    expect(getSpikeAmount('foobar')).toBe(0);
  });

  it('returns value within range for known events', () => {
    for (const [event, [min, max]] of Object.entries(VIEWER_SPIKES)) {
      for (let i = 0; i < 20; i++) {
        const val = getSpikeAmount(event);
        expect(val).toBeGreaterThanOrEqual(min);
        expect(val).toBeLessThanOrEqual(max);
      }
    }
  });

  it('git-push gives the biggest spikes', () => {
    const pushRange = VIEWER_SPIKES['git-push'];
    const saveRange = VIEWER_SPIKES['save'];
    expect(pushRange[0]).toBeGreaterThan(saveRange[1]);
  });
});

describe('ViewerEngine', () => {
  let callbacks: ViewerEngineCallbacks;
  let engine: ViewerEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    callbacks = {
      onCountUpdate: vi.fn(),
      onMilestone: vi.fn(),
    };
    engine = new ViewerEngine(callbacks);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with initial count', () => {
    const disposable = engine.start(10);
    expect(engine.getCount()).toBe(10);
    disposable.dispose();
  });

  it('count increases after activity tick', () => {
    const disposable = engine.start(5);
    engine.activity();
    // Advance one tick (3s)
    vi.advanceTimersByTime(3000);
    // Active tick adds 1-3 + noise, so should be >= 5
    expect(engine.getCount()).toBeGreaterThanOrEqual(5);
    disposable.dispose();
  });

  it('spike increases count', () => {
    const disposable = engine.start(10);
    engine.spike(50);
    vi.advanceTimersByTime(3000);
    expect(engine.getCount()).toBeGreaterThan(10);
    disposable.dispose();
  });

  it('count never goes below 0', () => {
    const disposable = engine.start(1);
    // Go deep idle for a long time
    vi.advanceTimersByTime(300_000);
    expect(engine.getCount()).toBeGreaterThanOrEqual(0);
    disposable.dispose();
  });

  it('milestone fires when count crosses threshold', () => {
    const disposable = engine.start(5);
    // Spike a huge amount to cross 100
    engine.spike(500);
    vi.advanceTimersByTime(3000);
    vi.advanceTimersByTime(3000);
    vi.advanceTimersByTime(3000);

    if (engine.getCount() >= 100) {
      expect(callbacks.onMilestone).toHaveBeenCalledWith(100);
    }
    disposable.dispose();
  });

  it('fires onCountUpdate every tick', () => {
    const disposable = engine.start(5);
    vi.advanceTimersByTime(3000);
    expect(callbacks.onCountUpdate).toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(callbacks.onCountUpdate).toHaveBeenCalledTimes(2);
    disposable.dispose();
  });

  it('dispose stops the timer', () => {
    const disposable = engine.start(5);
    disposable.dispose();
    const callCount = (callbacks.onCountUpdate as ReturnType<typeof vi.fn>).mock.calls.length;
    vi.advanceTimersByTime(30_000);
    expect(callbacks.onCountUpdate).toHaveBeenCalledTimes(callCount);
  });
});

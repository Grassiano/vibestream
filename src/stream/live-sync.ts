// ═══════════════════════════════════════════════════════════════
// Live Sync — share stream state across multiple VS Code windows.
// First window = master (generates chat). Others = slaves (mirror).
// Sync via shared JSON file with fs.watch for real-time updates.
// ═══════════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const SYNC_DIR = path.join(process.env.HOME ?? '/tmp', '.vibestream');
const LOCK_PATH = path.join(SYNC_DIR, 'master.lock');
const STATE_PATH = path.join(SYNC_DIR, 'live-state.json');

export interface LiveMessage {
  viewer: string;
  color: string;
  text: string;
}

export interface LiveState {
  pid: number;
  ts: number;
  messages: LiveMessage[];       // Last batch of new messages
  allMessages: LiveMessage[];    // Last 30 messages total for new slaves joining
  viewerCount: number;
  hypeLevel: number;             // 0-100
  xp: {
    level: number;
    title: string;
    percent: number;
    streak: number;
  };
  xpPopup: { amount: number } | null;  // Floating XP popup
  combo: {
    combo: number;
    multiplier: number;
    active: boolean;
  };
  alert: {
    alertType: string;
    data: Record<string, unknown>;
  } | null;
  streamActive: boolean;
}

function ensureDir(): void {
  if (!fs.existsSync(SYNC_DIR)) {
    fs.mkdirSync(SYNC_DIR, { recursive: true });
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ═══ Master — writes state, owns the stream ═══

export class LiveSyncMaster {
  private allMessages: LiveMessage[] = [];
  private readonly MAX_MESSAGES = 30;

  constructor() {
    ensureDir();
    // Claim master lock
    fs.writeFileSync(LOCK_PATH, String(process.pid));
  }

  pushMessages(messages: LiveMessage[]): void {
    this.allMessages.push(...messages);
    if (this.allMessages.length > this.MAX_MESSAGES) {
      this.allMessages = this.allMessages.slice(-this.MAX_MESSAGES);
    }
  }

  writeState(state: Omit<LiveState, 'pid' | 'ts' | 'allMessages'>): void {
    this.pushMessages(state.messages);
    const full: LiveState = {
      pid: process.pid,
      ts: Date.now(),
      messages: state.messages,
      allMessages: this.allMessages,
      viewerCount: state.viewerCount,
      xp: state.xp,
      combo: state.combo,
      alert: state.alert,
      streamActive: state.streamActive,
    };

    try {
      fs.writeFileSync(STATE_PATH, JSON.stringify(full));
    } catch {
      // Silent
    }
  }

  dispose(): void {
    // Release lock
    try {
      const lockPid = fs.readFileSync(LOCK_PATH, 'utf-8').trim();
      if (lockPid === String(process.pid)) {
        fs.unlinkSync(LOCK_PATH);
      }
    } catch {
      // Silent
    }

    // Write stream inactive
    try {
      const raw = fs.readFileSync(STATE_PATH, 'utf-8');
      const state = JSON.parse(raw) as LiveState;
      state.streamActive = false;
      state.ts = Date.now();
      fs.writeFileSync(STATE_PATH, JSON.stringify(state));
    } catch {
      // Silent
    }
  }
}

// ═══ Slave — watches state file, mirrors to webview ═══

export interface SlaveCallbacks {
  onMessages: (messages: LiveMessage[]) => void;
  onViewerCount: (count: number) => void;
  onHype: (level: number) => void;
  onXPState: (level: number, title: string, percent: number, streak: number) => void;
  onXPPopup: (amount: number) => void;
  onCombo: (combo: number, multiplier: number, active: boolean) => void;
  onAlert: (alertType: string, data: Record<string, unknown>) => void;
  onStreamEnd: () => void;
}

export class LiveSyncSlave {
  private watcher: fs.FSWatcher | null = null;
  private lastTs = 0;
  private seenMessageCount = 0;
  private callbacks: SlaveCallbacks;

  constructor(callbacks: SlaveCallbacks) {
    this.callbacks = callbacks;
  }

  start(): vscode.Disposable {
    ensureDir();

    // Load initial state (catch up on chat history)
    this.loadInitialState();

    // Watch for changes
    try {
      this.watcher = fs.watch(STATE_PATH, () => {
        this.onFileChange();
      });
    } catch {
      // File might not exist yet — poll until it does
      const pollTimer = setInterval(() => {
        if (fs.existsSync(STATE_PATH)) {
          clearInterval(pollTimer);
          this.loadInitialState();
          try {
            this.watcher = fs.watch(STATE_PATH, () => {
              this.onFileChange();
            });
          } catch {
            // Silent
          }
        }
      }, 2000);

      return new vscode.Disposable(() => {
        clearInterval(pollTimer);
        this.watcher?.close();
      });
    }

    return new vscode.Disposable(() => {
      this.watcher?.close();
    });
  }

  private loadInitialState(): void {
    try {
      const raw = fs.readFileSync(STATE_PATH, 'utf-8');
      const state = JSON.parse(raw) as LiveState;

      if (!state.streamActive) return;

      // Load full chat history
      if (state.allMessages.length > 0) {
        this.callbacks.onMessages(state.allMessages);
        this.seenMessageCount = state.allMessages.length;
      }

      this.callbacks.onViewerCount(state.viewerCount);
      this.callbacks.onHype(state.hypeLevel ?? 0);
      this.callbacks.onXPState(state.xp.level, state.xp.title, state.xp.percent, state.xp.streak);
      if (state.combo.active) {
        this.callbacks.onCombo(state.combo.combo, state.combo.multiplier, true);
      }

      this.lastTs = state.ts;
    } catch {
      // File doesn't exist or invalid — wait for master
    }
  }

  private onFileChange(): void {
    try {
      const raw = fs.readFileSync(STATE_PATH, 'utf-8');
      const state = JSON.parse(raw) as LiveState;

      // Skip if we already processed this update
      if (state.ts <= this.lastTs) return;
      this.lastTs = state.ts;

      if (!state.streamActive) {
        this.callbacks.onStreamEnd();
        return;
      }

      // New messages only (don't replay old ones)
      if (state.messages.length > 0) {
        this.callbacks.onMessages(state.messages);
      }

      this.callbacks.onViewerCount(state.viewerCount);
      this.callbacks.onHype(state.hypeLevel ?? 0);
      this.callbacks.onXPState(state.xp.level, state.xp.title, state.xp.percent, state.xp.streak);

      if (state.xpPopup) {
        this.callbacks.onXPPopup(state.xpPopup.amount);
      }

      if (state.combo.active) {
        this.callbacks.onCombo(state.combo.combo, state.combo.multiplier, true);
      } else {
        this.callbacks.onCombo(0, 1, false);
      }

      if (state.alert) {
        this.callbacks.onAlert(state.alert.alertType, state.alert.data);
      }
    } catch {
      // Silent — file might be mid-write
    }
  }
}

// ═══ Role Detection ═══

export type SyncRole = 'master' | 'slave';

export function detectRole(): SyncRole {
  ensureDir();

  try {
    if (fs.existsSync(LOCK_PATH)) {
      const lockPid = parseInt(fs.readFileSync(LOCK_PATH, 'utf-8').trim(), 10);

      // If the lock holder is still alive and it's not us → we're slave
      if (lockPid !== process.pid && isProcessAlive(lockPid)) {
        return 'slave';
      }

      // Lock holder is dead → take over as master
      fs.unlinkSync(LOCK_PATH);
    }
  } catch {
    // Can't read lock → assume master
  }

  return 'master';
}

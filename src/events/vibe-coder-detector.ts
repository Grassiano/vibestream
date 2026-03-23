import * as vscode from 'vscode';
import { FileChangeTracker, FileChangeSummary } from './file-change-tracker';

export type VibeState =
  | 'idle'
  | 'prompting'
  | 'ai-working'
  | 'code-landed'
  | 'reviewing';

export interface VibeContext {
  filesChanged?: string[];
  fileCount?: number;
  duration?: number;
}

const AI_EXTENSION_IDS = [
  'anthropic.claude-code',
  'saoudrizwan.claude-dev',
] as const;

const DEBOUNCE_EDITOR_LEAVE_MS = 2_000;
const FALSE_POSITIVE_RETURN_MS = 5_000;
const FILE_BURST_WINDOW_MS = 2_000;
const FILE_BURST_THRESHOLD = 2;
const CODE_SETTLED_MS = 3_000;
const CODE_LANDED_TIMEOUT_MS = 30_000;

type StateChangeCallback = (state: VibeState, context: VibeContext) => void;

export class VibeCoderDetector implements vscode.Disposable {
  private state: VibeState = 'idle';
  private callbacks: StateChangeCallback[] = [];
  private disposables: vscode.Disposable[] = [];
  private fileChangeTracker: FileChangeTracker;

  private hasAiExtension = false;
  private stateEnteredAt = Date.now();

  // Timers
  private editorLeaveTimer: ReturnType<typeof setTimeout> | undefined;
  private falsePositiveTimer: ReturnType<typeof setTimeout> | undefined;
  private codeSettledTimer: ReturnType<typeof setTimeout> | undefined;
  private codeLandedTimeoutTimer: ReturnType<typeof setTimeout> | undefined;

  // Burst tracking for file changes without active editor
  private recentFileChanges: number[] = [];
  private terminalJustFocused = false;
  private terminalFocusTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.fileChangeTracker = new FileChangeTracker();
    this.detectAiExtensions();
    this.registerListeners();
  }

  onStateChange(callback: StateChangeCallback): vscode.Disposable {
    this.callbacks.push(callback);
    return new vscode.Disposable(() => {
      const idx = this.callbacks.indexOf(callback);
      if (idx >= 0) {
        this.callbacks.splice(idx, 1);
      }
    });
  }

  getState(): VibeState {
    return this.state;
  }

  private detectAiExtensions(): void {
    this.hasAiExtension = AI_EXTENSION_IDS.some(
      (id) => vscode.extensions.getExtension(id) !== undefined
    );
  }

  private registerListeners(): void {
    // Active editor changes (undefined = user left editor area)
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor === undefined) {
          this.handleEditorLost();
        } else {
          this.handleEditorGained();
        }
      })
    );

    // Text document changes (file edits — could be AI writing)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.scheme !== 'file') return;
        this.handleFileChange(e);
      })
    );

    // Terminal focus — distinguish from AI chat panel
    this.disposables.push(
      vscode.window.onDidChangeActiveTerminal((_terminal) => {
        this.terminalJustFocused = true;
        this.clearTimer('terminalFocusTimer');
        this.terminalFocusTimer = setTimeout(() => {
          this.terminalJustFocused = false;
        }, DEBOUNCE_EDITOR_LEAVE_MS);
      })
    );

    // Extension install/uninstall — refresh AI extension detection
    this.disposables.push(
      vscode.extensions.onDidChange(() => {
        this.detectAiExtensions();
      })
    );
  }

  private handleEditorLost(): void {
    // Terminal focus is not prompting
    if (this.terminalJustFocused) return;

    if (this.state === 'idle' && this.hasAiExtension) {
      // Debounce: wait 2s before transitioning to prompting
      this.clearTimer('editorLeaveTimer');
      this.editorLeaveTimer = setTimeout(() => {
        // Only transition if editor is still gone
        if (vscode.window.activeTextEditor === undefined) {
          this.transitionTo('prompting', {});

          // Set false positive timer: if editor returns within 5s, revert
          this.clearTimer('falsePositiveTimer');
          this.falsePositiveTimer = setTimeout(() => {
            // Timer expired — user stayed in prompting, that's valid
          }, FALSE_POSITIVE_RETURN_MS);
        }
      }, DEBOUNCE_EDITOR_LEAVE_MS);
    }

    if (this.state === 'reviewing' && this.hasAiExtension) {
      this.transitionTo('prompting', {});
    }
  }

  private handleEditorGained(): void {
    this.clearTimer('editorLeaveTimer');

    if (this.state === 'prompting') {
      const elapsed = Date.now() - this.stateEnteredAt;
      if (elapsed < FALSE_POSITIVE_RETURN_MS) {
        // False positive: user came back quickly
        this.clearTimer('falsePositiveTimer');
        this.transitionTo('idle', {});
      }
    }

    if (this.state === 'code-landed') {
      this.clearTimer('codeLandedTimeoutTimer');
      const summary = this.fileChangeTracker.getSummary();
      this.transitionTo('reviewing', {
        filesChanged: summary.filesChanged,
        fileCount: summary.fileCount,
      });
    }
  }

  private handleFileChange(e: vscode.TextDocumentChangeEvent): void {
    const now = Date.now();
    const activeEditor = vscode.window.activeTextEditor;

    // In reviewing state: user typing means back to normal coding
    if (this.state === 'reviewing' && activeEditor !== undefined) {
      const isActiveDocument =
        activeEditor.document.uri.toString() === e.document.uri.toString();
      if (isActiveDocument && e.contentChanges.length > 0) {
        const summary = this.fileChangeTracker.stopTracking();
        this.transitionTo('idle', {
          filesChanged: summary.filesChanged,
          fileCount: summary.fileCount,
          duration: Date.now() - this.stateEnteredAt,
        });
        return;
      }
    }

    // File changes without active editor → AI is writing
    if (activeEditor === undefined) {
      // Track burst
      this.recentFileChanges.push(now);
      this.recentFileChanges = this.recentFileChanges.filter(
        (t) => now - t < FILE_BURST_WINDOW_MS
      );

      if (
        this.state === 'prompting' &&
        this.recentFileChanges.length >= FILE_BURST_THRESHOLD
      ) {
        this.fileChangeTracker.startTracking();
        this.transitionTo('ai-working', {});
      }
    }

    // During AI working: reset the "settled" timer on each change
    if (this.state === 'ai-working') {
      this.clearTimer('codeSettledTimer');
      this.codeSettledTimer = setTimeout(() => {
        const summary = this.fileChangeTracker.stopTracking();
        this.transitionTo('code-landed', {
          filesChanged: summary.filesChanged,
          fileCount: summary.fileCount,
        });

        // If no one opens the editor within 30s, go idle
        this.clearTimer('codeLandedTimeoutTimer');
        this.codeLandedTimeoutTimer = setTimeout(() => {
          if (this.state === 'code-landed') {
            this.transitionTo('idle', {
              duration: Date.now() - this.stateEnteredAt,
            });
          }
        }, CODE_LANDED_TIMEOUT_MS);
      }, CODE_SETTLED_MS);
    }
  }

  private transitionTo(newState: VibeState, context: VibeContext): void {
    if (this.state === newState) return;
    this.state = newState;
    this.stateEnteredAt = Date.now();
    this.recentFileChanges = [];

    for (const callback of this.callbacks) {
      callback(newState, context);
    }
  }

  private clearTimer(
    timerName:
      | 'editorLeaveTimer'
      | 'falsePositiveTimer'
      | 'codeSettledTimer'
      | 'codeLandedTimeoutTimer'
      | 'terminalFocusTimer'
  ): void {
    const timer = this[timerName];
    if (timer !== undefined) {
      clearTimeout(timer);
      this[timerName] = undefined;
    }
  }

  private clearAllTimers(): void {
    this.clearTimer('editorLeaveTimer');
    this.clearTimer('falsePositiveTimer');
    this.clearTimer('codeSettledTimer');
    this.clearTimer('codeLandedTimeoutTimer');
    this.clearTimer('terminalFocusTimer');
  }

  dispose(): void {
    this.clearAllTimers();
    this.fileChangeTracker.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
    this.callbacks = [];
  }
}

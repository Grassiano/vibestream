import * as vscode from 'vscode';

export type VibeBuddyEventType =
  | 'keystroke'
  | 'save'
  | 'error-added'
  | 'error-cleared'
  | 'all-errors-cleared'
  | 'ai-start'
  | 'ai-end'
  | 'git-commit'
  | 'git-push'
  | 'build-pass'
  | 'build-fail'
  | 'streak-update'
  | 'idle'
  | 'language-change'
  | 'large-file'
  | 'mass-delete'
  // Vibe coder lifecycle
  | 'vibe-prompting'
  | 'vibe-ai-working'
  | 'vibe-code-landed'
  | 'vibe-reviewing'
  // Activity states
  | 'activity-deep-focus'
  | 'activity-confused'
  | 'activity-stuck'
  | 'activity-speed-run'
  | 'activity-reviewing-ai'
  | 'activity-about-to-ship'
  | 'activity-late-night'
  | 'activity-long-session'
  // Claude conversation awareness
  | 'convo-user-prompted'
  | 'convo-user-building'
  | 'convo-user-fixing'
  | 'convo-user-debugging'
  | 'convo-user-iterating'
  | 'convo-error-loop'
  | 'convo-deep-dive'
  | 'convo-new-topic'
  // Emotional intelligence
  | 'emotion-frustrated'
  | 'emotion-flowing'
  | 'emotion-confused'
  | 'emotion-excited'
  | 'emotion-fatigued'
  // Multi-conversation awareness
  | 'multi-convo-parallel'
  | 'multi-convo-ship-day'
  | 'multi-convo-conflict'
  | 'multi-convo-complete';

export type VibeState = 'idle' | 'prompting' | 'ai-working' | 'code-landed' | 'reviewing';

export type ActivityState =
  | 'deep-focus'
  | 'confused'
  | 'stuck'
  | 'speed-run'
  | 'reviewing-ai'
  | 'about-to-ship'
  | 'late-night'
  | 'long-session'
  | 'normal';

export interface EventContext {
  language?: string;
  errorMessage?: string;
  errorLine?: number;
  fileName?: string;
  commitMessage?: string;
  streakMinutes?: number;
  linesDeleted?: number;
  fileLineCount?: number;
  errorCount?: number;
  // Vibe coder context
  filesChanged?: string[];
  fileCount?: number;
  aiToolName?: string;
  vibeSessionDuration?: number;
  // Activity context
  activityState?: ActivityState;
  focusedFile?: string;
  focusMinutes?: number;
  switchRate?: number;
  sessionHours?: number;
  // Brain/memory context
  lastSessionFeature?: string;
  sessionCount?: number;
  daysActive?: number;
  errorStreak?: number;
  feature?: string;
  // Conversation context
  userTopic?: string;
  userIntent?: string;
  conversationDepth?: number;
  convoFilesTouched?: string[];
  // Emotional intelligence
  emotionalState?: string;
  emotionConfidence?: number;
  promptLengthTrend?: string;
  // Multi-conversation
  activeConvoCount?: number;
  convoTopics?: string[];
  overlappingFiles?: string[];
  // Smart AI-generated reaction
  smartMessage?: string;
}

export interface VibeBuddyEvent {
  type: VibeBuddyEventType;
  context: EventContext;
  timestamp: number;
}

type EventHandler = (event: VibeBuddyEvent) => void;

export class EventBus {
  private handlers: EventHandler[] = [];
  private lastEventTime = Date.now();

  on(handler: EventHandler): vscode.Disposable {
    this.handlers.push(handler);
    return new vscode.Disposable(() => {
      const idx = this.handlers.indexOf(handler);
      if (idx >= 0) {
        this.handlers.splice(idx, 1);
      }
    });
  }

  emit(type: VibeBuddyEventType, context: EventContext = {}): void {
    this.lastEventTime = Date.now();
    const event: VibeBuddyEvent = { type, context, timestamp: Date.now() };
    for (const handler of this.handlers) {
      handler(event);
    }
  }

  getLastEventTime(): number {
    return this.lastEventTime;
  }
}

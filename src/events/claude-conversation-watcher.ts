import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Watches Claude Code conversation .jsonl files in real-time.
 * Supports MULTIPLE simultaneous conversations (2-4 Claude Code instances).
 * Extracts what the VIBE CODER is working on — not what Claude said.
 */

export interface ConversationContext {
  /** What feature/topic the user is working on (inferred from prompts) */
  userTopic: string;
  /** What the user asked for (simplified) */
  userIntent: 'building' | 'fixing' | 'asking' | 'refactoring' | 'debugging' | 'designing' | 'testing' | 'deploying' | 'exploring';
  /** Files Claude is touching (from tool calls) */
  filesTouched: string[];
  /** How many back-and-forth rounds in this topic */
  conversationDepth: number;
  /** Is the user iterating on errors? (prompt → error → prompt → error) */
  errorLoop: boolean;
  /** How long the user has been on this topic (ms) */
  topicDuration: number;
  /** Raw user prompt (last one) */
  lastPrompt: string;
  /** Which conversation session this came from (for multi-instance tracking) */
  sessionId: string;
}

/** Lightweight event fired on EVERY user prompt — no cooldown */
export interface PromptEvent {
  userTopic: string;
  userIntent: ConversationContext['userIntent'];
  lastPrompt: string;
  conversationDepth: number;
  sessionId: string;
}

/** Fired when Claude responds — captures the response's shape, not full text */
export interface ResponseEvent {
  /** First 100 chars of Claude's text response */
  responseSummary: string;
  /** Total character count of all text blocks */
  responseLength: number;
  /** How many code blocks Claude wrote */
  codeBlockCount: number;
  /** Which files Claude modified (from tool_use) */
  filesModified: string[];
  /** Which tools Claude used */
  toolsUsed: string[];
  sessionId: string;
}

type ConversationHandler = (ctx: ConversationContext) => void;
type PromptHandler = (evt: PromptEvent) => void;
type ResponseHandler = (evt: ResponseEvent) => void;

interface JsonlEntry {
  type: 'user' | 'assistant' | 'system' | 'progress' | 'queue-operation' | 'file-history-snapshot' | 'last-prompt';
  message?: {
    role?: string;
    content?: string | ContentBlock[];
    model?: string;
  };
  timestamp?: string;
  sessionId?: string;
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'image';
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/** Per-file tracking state for one conversation */
interface ConversationFileState {
  filePath: string;
  fileSize: number;
  userPrompts: { text: string; timestamp: number }[];
  filesTouched: Set<string>;
  topicStartTime: number;
  errorMentions: number;
  currentTopic: string;
  lastActivity: number;
}

export class ClaudeConversationWatcher implements vscode.Disposable {
  private dirWatchers: fs.FSWatcher[] = [];
  private handlers: ConversationHandler[] = [];
  private promptHandlers: PromptHandler[] = [];
  private responseHandlers: ResponseHandler[] = [];
  private disposables: vscode.Disposable[] = [];
  private pollInterval: ReturnType<typeof setInterval> | undefined;
  private lastEmitTime = 0;

  /** Track multiple conversation files simultaneously */
  private activeFiles = new Map<string, ConversationFileState>();

  /** Max age before we stop tracking a stale conversation (30 min) */
  private static readonly STALE_THRESHOLD_MS = 30 * 60_000;
  /** Cooldown between emits */
  private static readonly EMIT_COOLDOWN_MS = 15_000;
  /** How often to scan for active files (every 10s) */
  private static readonly SCAN_INTERVAL_MS = 10_000;

  /** Callback for raw prompt text (used by EmotionDetector) */
  private promptCallback: ((text: string) => void) | undefined;

  constructor(private workspaceName: string) {}

  /** Register a callback that receives raw prompt text for analysis */
  onRawPrompt(callback: (text: string) => void): void {
    this.promptCallback = callback;
  }

  /** Get info about all currently active conversations (for multi-convo analyzer) */
  getActiveConversations(): { sessionId: string; topic: string; filesTouched: string[]; lastActivity: number }[] {
    const now = Date.now();
    const results: { sessionId: string; topic: string; filesTouched: string[]; lastActivity: number }[] = [];

    for (const [filePath, state] of this.activeFiles) {
      if (now - state.lastActivity < ClaudeConversationWatcher.STALE_THRESHOLD_MS) {
        results.push({
          sessionId: path.basename(filePath, '.jsonl'),
          topic: state.currentTopic,
          filesTouched: [...state.filesTouched],
          lastActivity: state.lastActivity,
        });
      }
    }
    return results;
  }

  start(): void {
    const dirs = this.findAllClaudeProjectDirs();
    if (dirs.length === 0) return;

    // Initial scan of all directories
    for (const dir of dirs) {
      this.scanDirectory(dir);
    }

    // Watch directories for new conversation files
    for (const dir of dirs) {
      try {
        const watcher = fs.watch(dir, (_, filename) => {
          if (filename?.endsWith('.jsonl')) {
            this.scanDirectory(dir);
          }
        });
        this.dirWatchers.push(watcher);
      } catch {
        // fs.watch not available for this dir
      }
    }

    // Poll all active files for new content
    this.pollInterval = setInterval(() => {
      this.pollAllFiles();
      this.pruneStaleFiles();
    }, 2000);

    // Periodic full rescan to catch new conversations
    const rescanInterval = setInterval(() => {
      for (const dir of dirs) {
        this.scanDirectory(dir);
      }
    }, ClaudeConversationWatcher.SCAN_INTERVAL_MS);
    this.disposables.push(new vscode.Disposable(() => clearInterval(rescanInterval)));
  }

  onConversation(handler: ConversationHandler): vscode.Disposable {
    this.handlers.push(handler);
    const disposable = new vscode.Disposable(() => {
      const idx = this.handlers.indexOf(handler);
      if (idx >= 0) this.handlers.splice(idx, 1);
    });
    this.disposables.push(disposable);
    return disposable;
  }

  /** Fires when Claude responds */
  onResponse(handler: ResponseHandler): vscode.Disposable {
    this.responseHandlers.push(handler);
    const disposable = new vscode.Disposable(() => {
      const idx = this.responseHandlers.indexOf(handler);
      if (idx >= 0) this.responseHandlers.splice(idx, 1);
    });
    this.disposables.push(disposable);
    return disposable;
  }

  /** Fires on EVERY user prompt — no cooldown, no throttling */
  onPrompt(handler: PromptHandler): vscode.Disposable {
    this.promptHandlers.push(handler);
    const disposable = new vscode.Disposable(() => {
      const idx = this.promptHandlers.indexOf(handler);
      if (idx >= 0) this.promptHandlers.splice(idx, 1);
    });
    this.disposables.push(disposable);
    return disposable;
  }

  dispose(): void {
    for (const w of this.dirWatchers) w.close();
    if (this.pollInterval) clearInterval(this.pollInterval);
    for (const d of this.disposables) d.dispose();
    this.activeFiles.clear();
  }

  // ─── Private ──────────────────────────────────────

  private findAllClaudeProjectDirs(): string[] {
    const homeDir = os.homedir();
    const claudeBase = path.join(homeDir, '.claude', 'projects');
    if (!fs.existsSync(claudeBase)) return [];

    const dirs: string[] = [];

    // Workspace-specific dir
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders?.[0]) {
      const wsPath = workspaceFolders[0].uri.fsPath;
      const mangled = wsPath.replace(/\//g, '-');
      const wsDir = path.join(claudeBase, mangled);
      if (fs.existsSync(wsDir)) dirs.push(wsDir);
    }

    // Home directory project (Claude Code opened without specific workspace)
    const homeMangled = homeDir.replace(/\//g, '-');
    const homeProjectDir = path.join(claudeBase, homeMangled);
    if (fs.existsSync(homeProjectDir) && !dirs.includes(homeProjectDir)) {
      dirs.push(homeProjectDir);
    }

    return dirs;
  }

  /**
   * Scan a directory for recently active .jsonl files.
   * Only picks up files modified in the last 30 minutes.
   */
  private scanDirectory(dir: string): void {
    try {
      const now = Date.now();
      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => {
          const fullPath = path.join(dir, f);
          try {
            const stats = fs.statSync(fullPath);
            return { fullPath, mtimeMs: stats.mtimeMs, size: stats.size };
          } catch {
            return null;
          }
        })
        .filter((f): f is NonNullable<typeof f> => f !== null)
        // Only consider files active in the last 30 minutes
        .filter(f => now - f.mtimeMs < ClaudeConversationWatcher.STALE_THRESHOLD_MS);

      for (const file of files) {
        if (!this.activeFiles.has(file.fullPath)) {
          const state: ConversationFileState = {
            filePath: file.fullPath,
            fileSize: file.size,
            userPrompts: [],
            filesTouched: new Set(),
            topicStartTime: 0,
            errorMentions: 0,
            currentTopic: '',
            lastActivity: file.mtimeMs,
          };
          // Warm up context from recent history (don't emit events, just populate state)
          this.warmupState(state, file.size);
          this.activeFiles.set(file.fullPath, state);
        }
      }
    } catch {
      // Directory read error
    }
  }

  /** Read tail of file to warm up topic/prompts without emitting events */
  private warmupState(state: ConversationFileState, fileSize: number): void {
    const TAIL_BYTES = 4096;
    if (fileSize < 10) return;

    try {
      const readFrom = Math.max(0, fileSize - TAIL_BYTES);
      const fd = fs.openSync(state.filePath, 'r');
      const buffer = Buffer.alloc(fileSize - readFrom);
      fs.readSync(fd, buffer, 0, buffer.length, readFrom);
      fs.closeSync(fd);

      const text = buffer.toString('utf-8');
      const lines = text.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as JsonlEntry;
          if (entry.type === 'user') {
            const promptText = this.extractText(entry.message?.content);
            if (promptText) {
              state.userPrompts.push({ text: promptText, timestamp: Date.now() });
              if (state.userPrompts.length > 10) state.userPrompts.shift();
              state.currentTopic = this.inferTopic(promptText);
              state.topicStartTime = Date.now();
              if (this.isErrorRelated(promptText)) state.errorMentions++;
            }
          } else if (entry.type === 'assistant') {
            const content = entry.message?.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === 'tool_use' && block.input) {
                  const filePath = (block.input as Record<string, string>).file_path
                    ?? (block.input as Record<string, string>).path;
                  if (filePath) state.filesTouched.add(path.basename(filePath));
                }
              }
            }
          }
        } catch {
          // Skip malformed lines (including partial first line from mid-file read)
        }
      }
    } catch {
      // File read error during warmup — not critical
    }
  }

  /** Poll all tracked files for new content */
  private pollAllFiles(): void {
    for (const [filePath, state] of this.activeFiles) {
      this.checkFileForNewLines(filePath, state);
    }
  }

  /** Remove conversations that haven't had activity in 30 min */
  private pruneStaleFiles(): void {
    const now = Date.now();
    for (const [filePath, state] of this.activeFiles) {
      if (now - state.lastActivity > ClaudeConversationWatcher.STALE_THRESHOLD_MS) {
        this.activeFiles.delete(filePath);
      }
    }
  }

  private checkFileForNewLines(filePath: string, state: ConversationFileState): void {
    let currentSize: number;
    try {
      currentSize = fs.statSync(filePath).size;
    } catch {
      return;
    }

    if (currentSize <= state.fileSize) return;

    try {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(currentSize - state.fileSize);
      fs.readSync(fd, buffer, 0, buffer.length, state.fileSize);
      fs.closeSync(fd);

      state.fileSize = currentSize;
      state.lastActivity = Date.now();

      const newText = buffer.toString('utf-8');
      const lines = newText.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as JsonlEntry;
          this.processEntry(entry, state);
        } catch {
          // Skip malformed lines
        }
      }
    } catch {
      // File read error
    }
  }

  private processEntry(entry: JsonlEntry, state: ConversationFileState): void {
    if (entry.type === 'user') {
      this.processUserMessage(entry, state);
    } else if (entry.type === 'assistant') {
      this.processAssistantMessage(entry, state);
    }
  }

  private processUserMessage(entry: JsonlEntry, state: ConversationFileState): void {
    const text = this.extractText(entry.message?.content);
    if (!text) return;

    // Forward raw prompt for emotion analysis
    this.promptCallback?.(text);

    state.userPrompts.push({ text, timestamp: Date.now() });

    // Keep last 10 prompts per conversation
    if (state.userPrompts.length > 10) {
      state.userPrompts.shift();
    }

    // Topic detection
    const newTopic = this.inferTopic(text);
    if (newTopic !== state.currentTopic) {
      state.topicStartTime = Date.now();
      state.currentTopic = newTopic;
      state.errorMentions = 0;
      state.filesTouched.clear();
    }

    if (this.isErrorRelated(text)) {
      state.errorMentions++;
    }

    // ALWAYS fire prompt event — no cooldown, buddy responds to every prompt
    this.emitPrompt(state, text);

    // Cooldown-gated intent analysis (deep dive, error loop, etc.)
    this.maybeEmit(state);
  }

  private processAssistantMessage(entry: JsonlEntry, state: ConversationFileState): void {
    const content = entry.message?.content;
    if (!Array.isArray(content)) return;

    let fullText = '';
    let codeBlockCount = 0;
    const filesModified: string[] = [];
    const toolsUsed: string[] = [];

    for (const block of content) {
      if (block.type === 'text' && block.text) {
        fullText += block.text;
        // Count code blocks in the response
        const codeMatches = block.text.match(/```/g);
        if (codeMatches) codeBlockCount += Math.floor(codeMatches.length / 2);
      }
      if (block.type === 'tool_use') {
        if (block.name) toolsUsed.push(block.name);
        if (block.input) {
          const filePath = (block.input as Record<string, string>).file_path
            ?? (block.input as Record<string, string>).path;
          if (filePath) {
            const baseName = path.basename(filePath);
            state.filesTouched.add(baseName);
            filesModified.push(baseName);
          }
        }
      }
    }

    // Fire response event if there's meaningful content
    if (fullText.length > 10 || filesModified.length > 0) {
      const sessionId = path.basename(state.filePath, '.jsonl');
      const evt: ResponseEvent = {
        responseSummary: fullText.slice(0, 150),
        responseLength: fullText.length,
        codeBlockCount,
        filesModified: [...new Set(filesModified)],
        toolsUsed: [...new Set(toolsUsed)],
        sessionId,
      };
      for (const handler of this.responseHandlers) {
        handler(evt);
      }
    }
  }

  private emitPrompt(state: ConversationFileState, promptText: string): void {
    const sessionId = path.basename(state.filePath, '.jsonl');
    const evt: PromptEvent = {
      userTopic: state.currentTopic,
      userIntent: this.inferIntent(promptText),
      lastPrompt: promptText.slice(0, 200),
      conversationDepth: state.userPrompts.length,
      sessionId,
    };
    for (const handler of this.promptHandlers) {
      handler(evt);
    }
  }

  private maybeEmit(state: ConversationFileState): void {
    const now = Date.now();
    if (now - this.lastEmitTime < ClaudeConversationWatcher.EMIT_COOLDOWN_MS) return;

    const lastPrompt = state.userPrompts[state.userPrompts.length - 1];
    if (!lastPrompt) return;

    // Extract sessionId from file path (the UUID filename)
    const sessionId = path.basename(state.filePath, '.jsonl');

    const ctx: ConversationContext = {
      userTopic: state.currentTopic,
      userIntent: this.inferIntent(lastPrompt.text),
      filesTouched: [...state.filesTouched],
      conversationDepth: state.userPrompts.length,
      errorLoop: state.errorMentions >= 2,
      topicDuration: now - (state.topicStartTime || now),
      lastPrompt: lastPrompt.text.slice(0, 200),
      sessionId,
    };

    this.lastEmitTime = now;
    for (const handler of this.handlers) {
      handler(ctx);
    }
  }

  private extractText(content: string | ContentBlock[] | undefined): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    for (const block of content) {
      if (block.type === 'text' && block.text) return block.text;
    }
    return '';
  }

  private inferTopic(text: string): string {
    const lower = text.toLowerCase();

    const topicPatterns: [RegExp, string][] = [
      [/\b(auth|login|signup|sign.?up|password|session|jwt|token)\b/i, 'authentication'],
      [/\b(pay|stripe|billing|checkout|subscription|price)\b/i, 'payments'],
      [/\b(database|schema|migration|prisma|supabase|sql|table|query)\b/i, 'database'],
      [/\b(api|endpoint|route|rest|graphql|fetch)\b/i, 'API'],
      [/\b(test|spec|jest|vitest|cypress|playwright)\b/i, 'testing'],
      [/\b(deploy|ci|cd|docker|railway|vercel|build)\b/i, 'deployment'],
      [/\b(style|css|tailwind|design|layout|responsive|ui|ux)\b/i, 'UI/design'],
      [/\b(animation|canvas|sprite|render|draw|pixel)\b/i, 'animation'],
      [/\b(upload|file|image|media|storage|bucket)\b/i, 'file handling'],
      [/\b(email|notification|push|alert|webhook)\b/i, 'notifications'],
      [/\b(search|filter|sort|pagination)\b/i, 'search'],
      [/\b(chat|message|socket|realtime|stream)\b/i, 'real-time features'],
      [/\b(form|input|validation|modal|dialog)\b/i, 'forms'],
      [/\b(nav|menu|sidebar|header|footer|page)\b/i, 'navigation'],
      [/\b(error|bug|fix|crash|broken|issue|fail)\b/i, 'bug fixing'],
      [/\b(refactor|clean|rename|reorganize|extract)\b/i, 'refactoring'],
      [/\b(setup|init|install|config|scaffold)\b/i, 'project setup'],
    ];

    for (const [pattern, topic] of topicPatterns) {
      if (pattern.test(lower)) return topic;
    }

    const words = text.split(/\s+/).slice(0, 8).join(' ');
    return words.length > 40 ? words.slice(0, 40) + '...' : words || 'something';
  }

  private inferIntent(text: string): ConversationContext['userIntent'] {
    const lower = text.toLowerCase();

    if (/\b(fix|bug|error|crash|broken|wrong|fail|issue|doesn'?t work)\b/.test(lower)) return 'fixing';
    if (/\b(debug|why|what happened|console|log|inspect)\b/.test(lower)) return 'debugging';
    if (/\b(refactor|clean|rename|extract|reorganize|simplify)\b/.test(lower)) return 'refactoring';
    if (/\b(test|spec|coverage|assert|expect|mock)\b/.test(lower)) return 'testing';
    if (/\b(deploy|push|ship|release|publish|build)\b/.test(lower)) return 'deploying';
    if (/\b(design|style|layout|ui|ux|color|font|responsive)\b/.test(lower)) return 'designing';
    if (/\b(what|how|why|explain|show me|where|can you)\b/.test(lower) && lower.length < 100) return 'asking';
    if (/\b(explore|look|check|find|search|investigate)\b/.test(lower)) return 'exploring';

    return 'building';
  }

  private isErrorRelated(text: string): boolean {
    return /\b(error|bug|fix|crash|broken|wrong|fail|doesn'?t work|not working|still broken)\b/i.test(text);
  }
}

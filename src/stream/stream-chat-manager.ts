import * as vscode from 'vscode';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { EventBus, VibeBuddyEvent } from '../events/event-bus';
import { loadImprovements, Improvements } from './session-analyzer';
import {
  ViewerAgent, ViewerProfileData, RankUpEvent,
  createSessionRoster, persistRoster, pickRandom,
  describeSessionViewers, getViewerProfiles, generateAnonymousProfile,
  updateWatchTime,
} from './viewer-generator';

// ═══ Session Log — prompts + responses with timestamps ═══
const LOG_PATH = path.join(process.env.HOME ?? '/tmp', '.vibestream-stream-log.jsonl');

function streamLog(entry: Record<string, unknown>): void {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    fs.appendFileSync(LOG_PATH, line + '\n');
  } catch {
    // Silent
  }
}

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const TIMEOUT_MS = 4_000;

// Style-dependent settings
const STYLE_CONFIG: Record<string, { batchInterval: number; baseMsgCount: number; instantOnAll: boolean }> = {
  hype:   { batchInterval: 4_000, baseMsgCount: 5, instantOnAll: true },
  chill:  { batchInterval: 8_000, baseMsgCount: 2, instantOnAll: false },
  savage: { batchInterval: 5_000, baseMsgCount: 4, instantOnAll: false },
};
const VIEWER_DECAY_INTERVAL_MS = 12_000;
const IDLE_CHAT_INTERVAL_MS = 10_000;
const MIN_VIEWERS = 30;
const MAX_VIEWERS = 9999;

const EVENT_VIEWER_BOOST: Record<string, number> = {
  keystroke: 3,
  save: 12,
  'error-added': 25,
  'error-cleared': 15,
  'all-errors-cleared': 150,
  'git-commit': 200,
  'git-push': 350,
  'mass-delete': 120,
  'build-pass': 180,
  'build-fail': 80,
  'vibe-code-landed': 200,
  'convo-user-prompted': 20,
  'convo-error-loop': 40,
  'language-change': 8,
  'vibe-ai-working': 30,
  'vibe-prompting': 15,
  idle: -10,
};

const HYPE_EVENTS = new Set([
  'git-commit', 'git-push', 'all-errors-cleared', 'build-pass',
  'vibe-code-landed', 'mass-delete', 'build-fail', 'convo-error-loop',
]);

// (Instant reactions + idle chat now come from viewer-generator roster)

interface ChatMessage {
  viewer: string;
  color: string;
  text: string;
}

interface StreamEvent {
  type: string;
  detail: string;
  timestamp: number;
  hype: boolean;
}

const VIEWER_COLORS = [
  '#ff4444', '#ff6b6b', '#e94560', '#ff6b9d', '#ec4899',
  '#d946ef', '#a855f7', '#8b5cf6', '#7c3aed', '#6366f1',
  '#818cf8', '#60a5fa', '#38bdf8', '#22d3ee', '#06b6d4',
  '#14b8a6', '#10b981', '#34d399', '#4ade80', '#84cc16',
  '#a3e635', '#facc15', '#fbbf24', '#f59e0b', '#fb923c',
  '#f97316', '#ef4444', '#fca5a5', '#c084fc', '#67e8f9',
];

export class StreamChatManager {
  private apiKey: string | undefined;
  private eventBuffer: StreamEvent[] = [];
  private batchTimer: NodeJS.Timeout | undefined;
  private decayTimer: NodeJS.Timeout | undefined;
  private idleChatTimer: NodeJS.Timeout | undefined;
  private viewerCount = MIN_VIEWERS;
  private active = false;
  private onChat: ((messages: ChatMessage[], viewerCount: number) => void) | undefined;
  private onViewerUpdate: ((count: number) => void) | undefined;
  private sessionStartTime = Date.now();
  private totalKeystrokes = 0;
  private totalSaves = 0;
  private totalErrors = 0;
  private lastActivityTime = Date.now();
  private lastInstantTime: Record<string, number> = {};
  private usedTexts = new Set<string>();
  private chatHistory: string[] = [];
  private readonly MAX_HISTORY = 40;
  private improvements: Improvements | null = null;
  // Claude conversation context
  private recentPrompts: string[] = [];
  private lastClaudeTopic = '';
  private lastClaudeIntent = '';
  private claudeConvoDepth = 0;
  // Generated viewer roster
  private sessionRoster: ViewerAgent[] = [];
  private onProfiles: ((profiles: ViewerProfileData[]) => void) | undefined;
  private onRankUp: ((viewer: string, rank: string) => void) | undefined;
  private watchTimeTimer: NodeJS.Timeout | undefined;

  constructor(private bus: EventBus) {}

  private streamerName = 'Streamer';
  private chatLang = 'he';
  private chatStyle = 'hype';

  setApiKey(key: string | undefined): void {
    this.apiKey = key;
  }

  setConfig(name: string, lang: string, style: string): void {
    this.streamerName = name;
    this.chatLang = lang;
    this.chatStyle = style;
  }

  setOnChat(handler: (messages: ChatMessage[], viewerCount: number) => void): void {
    this.onChat = handler;
  }

  setOnViewerUpdate(handler: (count: number) => void): void {
    this.onViewerUpdate = handler;
  }

  setOnProfiles(handler: (profiles: ViewerProfileData[]) => void): void {
    this.onProfiles = handler;
  }

  setOnRankUp(handler: (viewer: string, rank: string) => void): void {
    this.onRankUp = handler;
  }

  getProfiles(): ViewerProfileData[] {
    return getViewerProfiles(this.sessionRoster);
  }

  getProfileForViewer(name: string): ViewerProfileData | null {
    const viewer = this.sessionRoster.find(v => v.name === name);
    if (viewer) return getViewerProfiles([viewer])[0];
    return generateAnonymousProfile(name);
  }

  start(): vscode.Disposable {
    this.active = true;
    this.viewerCount = 120 + Math.floor(Math.random() * 80);
    this.sessionStartTime = Date.now();
    this.totalKeystrokes = 0;
    this.totalSaves = 0;
    this.totalErrors = 0;
    this.lastActivityTime = Date.now();
    this.lastInstantTime = {};

    // Generate session roster — living viewer agents
    const { roster, newViewers, rankUps } = createSessionRoster(this.chatLang);
    this.sessionRoster = roster;
    streamLog({ type: 'session-roster', total: roster.length, new: newViewers.length, returning: roster.length - newViewers.length, rankUps: rankUps.length });

    // Send profiles to webview
    this.onProfiles?.(getViewerProfiles(roster));

    // Announce rank-ups as system messages
    for (const ru of rankUps) {
      this.onRankUp?.(ru.viewer.name, ru.newRank);
    }

    // Track watch time — every 5 minutes, credit viewers + check rank-ups
    this.watchTimeTimer = setInterval(() => {
      const newRankUps = updateWatchTime(this.sessionRoster, 5);
      for (const ru of newRankUps) {
        this.onRankUp?.(ru.viewer.name, ru.newRank);
      }
      // Persist updated stats
      persistRoster(this.sessionRoster);
      // Refresh profiles in webview
      this.onProfiles?.(getViewerProfiles(this.sessionRoster));
    }, 5 * 60_000);

    // Load improvements from previous sessions
    this.improvements = loadImprovements();
    if (this.improvements.avoid.length > 0) {
      for (const text of this.improvements.avoid) {
        this.usedTexts.add(text);
      }
      streamLog({ type: 'loaded-improvements', version: this.improvements.version, avoidCount: this.improvements.avoid.length, rulesCount: this.improvements.promptRules.length });
    }

    const busSub = this.bus.on((event) => {
      if (!this.active) return;
      this.handleEvent(event);
    });

    // Layer 2: LLM batch every 5s
    this.batchTimer = setInterval(() => {
      if (this.eventBuffer.length > 0) {
        this.flushBatch();
      }
    }, (STYLE_CONFIG[this.chatStyle] ?? STYLE_CONFIG.hype).batchInterval);

    // Viewer decay
    this.decayTimer = setInterval(() => {
      const idleSeconds = (Date.now() - this.lastActivityTime) / 1000;
      if (this.viewerCount > MIN_VIEWERS) {
        const decayRate = idleSeconds > 30 ? 0.08 : 0.03;
        const decay = Math.max(1, Math.floor(this.viewerCount * decayRate));
        this.viewerCount = Math.max(MIN_VIEWERS, this.viewerCount - decay);
        this.onViewerUpdate?.(this.viewerCount);
      }
    }, VIEWER_DECAY_INTERVAL_MS);

    // Idle chatter — random messages even when nothing happens
    this.idleChatTimer = setInterval(() => {
      const idleSeconds = (Date.now() - this.lastActivityTime) / 1000;
      if (idleSeconds > 10 && Math.random() < 0.7) {
        this.sendIdleChat();
      } else if (idleSeconds <= 10 && Math.random() < 0.3) {
        this.sendIdleChat();
      }
    }, IDLE_CHAT_INTERVAL_MS);

    this.onViewerUpdate?.(this.viewerCount);

    // Welcome burst — chat should never be empty when stream starts
    this.sendWelcomeBurst();

    return new vscode.Disposable(() => {
      busSub.dispose();
      this.stop();
    });
  }

  stop(): void {
    this.active = false;
    if (this.batchTimer) clearInterval(this.batchTimer);
    if (this.decayTimer) clearInterval(this.decayTimer);
    if (this.idleChatTimer) clearInterval(this.idleChatTimer);
    if (this.watchTimeTimer) clearInterval(this.watchTimeTimer);
    this.eventBuffer = [];
    // Persist final viewer stats
    if (this.sessionRoster.length > 0) {
      persistRoster(this.sessionRoster);
    }
  }

  isActive(): boolean {
    return this.active;
  }

  // Claude response tracking
  private lastClaudeResponse = '';
  private lastClaudeResponseLength = 0;
  private lastClaudeCodeBlocks = 0;
  private lastClaudeFilesModified: string[] = [];

  /** Feed Claude's response data */
  feedClaudeResponse(summary: string, length: number, codeBlocks: number, files: string[]): void {
    this.lastClaudeResponse = summary;
    this.lastClaudeResponseLength = length;
    this.lastClaudeCodeBlocks = codeBlocks;
    this.lastClaudeFilesModified = files;

    // Log to chat history so viewers can see what Claude did
    const sizeDesc = length > 5000 ? 'תשובה ענקית' : length > 1000 ? 'תשובה ארוכה' : 'תשובה קצרה';
    const fileDesc = files.length > 0 ? `, שינה ${files.join(', ')}` : '';
    const codeDesc = codeBlocks > 0 ? `, ${codeBlocks} בלוקי קוד` : '';
    this.logChat('SYSTEM', `🤖 Claude ענה: ${sizeDesc} (${length} תווים${codeDesc}${fileDesc})`);

    streamLog({ type: 'claude-response', length, codeBlocks, files, summary: summary.slice(0, 100) });
  }

  /** Feed Claude conversation context from the extension */
  feedClaudeContext(prompt: string, topic: string, intent: string, depth: number): void {
    // Label source clearly so LLM doesn't confuse with stream chat
    const labeled = `[CLAUDE PROMPT] ${prompt.slice(0, 200)}`;
    this.recentPrompts.push(labeled);
    if (this.recentPrompts.length > 5) this.recentPrompts.shift();
    this.lastClaudeTopic = topic;
    this.lastClaudeIntent = intent;
    this.claudeConvoDepth = depth;

    // Also log to chat history with clear label
    this.logChat('SYSTEM', `📡 שלח פרומפט ל-Claude: "${topic}" (${intent})`);
  }

  async reactToStreamerMessage(text: string): Promise<void> {
    if (!this.apiKey || !this.active) return;

    // Track in conversation thread
    this.logChat('STREAMER', text);

    // BIG viewer spike — the star is talking
    this.viewerCount = Math.min(MAX_VIEWERS, this.viewerCount + 250);
    this.onViewerUpdate?.(this.viewerCount);

    // Use session roster for waves
    const active = this.sessionRoster;

    // ═══ WAVE 1: Fastest (0.8-2s) — spammers + hype ═══
    const wave1 = active.filter(v => v.personality === 'spammer' || v.personality === 'hype');
    wave1.forEach((viewer, i) => {
      const pool = viewer.streamerReactions;
      if (!pool || pool.length === 0) return;
      const reaction = pool[Math.floor(Math.random() * pool.length)];
      setTimeout(() => {
        this.logChat(viewer.name, reaction);
        viewer.stats.messageCount++;
        this.onChat?.([{ viewer: viewer.name, color: viewer.color, text: reaction }], this.viewerCount);
      }, 800 + i * 300 + Math.random() * 400);
    });

    // ═══ WAVE 2: Quick readers (1.5-3s) — noobs + trolls ═══
    const wave2 = active.filter(v => v.personality === 'noob' || v.personality === 'troll');
    wave2.forEach((viewer, i) => {
      const pool = viewer.streamerReactions;
      if (!pool || pool.length === 0) return;
      const reaction = pool[Math.floor(Math.random() * pool.length)];
      setTimeout(() => {
        this.logChat(viewer.name, reaction);
        viewer.stats.messageCount++;
        this.onChat?.([{ viewer: viewer.name, color: viewer.color, text: reaction }], this.viewerCount);
      }, 1500 + i * 500 + Math.random() * 600);
    });

    // ═══ WAVE 3: Thinkers (2.5-4s) — veterans + critics + lurkers ═══
    const wave3 = active.filter(v => v.personality === 'veteran' || v.personality === 'critic' || v.personality === 'lurker');
    wave3.forEach((viewer, i) => {
      const pool = viewer.streamerReactions;
      if (!pool || pool.length === 0) return;
      const reaction = pool[Math.floor(Math.random() * pool.length)];
      setTimeout(() => {
        this.logChat(viewer.name, reaction);
        viewer.stats.messageCount++;
        this.onChat?.([{ viewer: viewer.name, color: viewer.color, text: reaction }], this.viewerCount);
      }, 2500 + i * 600 + Math.random() * 800);
    });

    // ═══ WAVE 4: LLM smart reactions (4-7s) ═══
    const personaDesc = describeSessionViewers(this.sessionRoster);
    const fullHistory = this.chatHistory.join('\n');

    const prompt = `הסטרימר כתב הודעה ישירות בצ'אט הסטרים שלו (לא פרומפט ל-Claude — הודעה לצופים!). הצ'אט צריך להתפוצץ.

${personaDesc}

היסטוריית הצ'אט המלאה (שים לב לתיוגים — 🎙️ = הודעת סטרימר, 📡 = פרומפט ל-Claude, @ = צופה):
${fullHistory}

🎙️ הסטרימר כתב עכשיו בצ'אט (מדבר ישירות לצופים!): "${text.slice(0, 200)}"

צור 5-6 תגובות. הסטרימר הוא הכוכב — כשהוא מדבר, כולם מגיבים. חוקים:
- כל הדמויות חייבות להגיב לתוכן של מה שהסטרימר אמר — לא תגובות גנריות
- אם הסטרימר שאל שאלה — לפחות 3 צופים עונים (תשובות שונות, חלקם חולקים)
- אם הסטרימר אמר משהו מצחיק — אחד צוחק, אחד מעתיק, אחד ממשיך את הבדיחה
- אם הסטרימר ענה על שאלה של צופה — אותו צופה חייב להגיב
- אם הסטרימר הודה לצ'אט — גל חום: "np", "אחי", "love u", "peepoHappy"
- צופים בשפה מקומית כותבים רק בשפה שלהם, בלי ערבוב
- צופים מגיבים אחד לשני גם: "@Kappa_Andy shut up"
- אל תחזור על תגובות שכבר נאמרו
- מקסימום 60 תווים, חלק מההודעות קצרות מאוד (מילה אחת)
- תערבב הודעות ארוכות (30-60 תווים) עם קצרות (3-15 תווים)

פורמט:
@ViewerName: הודעה`;

    streamLog({ type: 'streamer-prompt', streamerMsg: text.slice(0, 200), viewers: this.viewerCount });

    try {
      const response = await this.callGemini(prompt);
      if (!response) return;

      streamLog({ type: 'streamer-llm-response', raw: response.slice(0, 500) });

      const messages = this.parseMessages(response);
      if (messages.length > 0) {
        messages.forEach((msg, i) => {
          setTimeout(() => {
            this.logChat(msg.viewer, msg.text);
            streamLog({ type: 'streamer-reaction', viewer: msg.viewer, text: msg.text });
            this.onChat?.([msg], this.viewerCount);
          }, 4000 + i * (400 + Math.random() * 600));
        });
      }
    } catch {
      // Silently fail
    }
  }

  private logChat(speaker: string, text: string): void {
    const prefix = speaker === 'STREAMER'
      ? '🎙️ STREAMER (בצ\'אט הסטרים)'
      : speaker === 'SYSTEM'
      ? '⚡ SYSTEM'
      : `@${speaker} (צופה)`;
    this.chatHistory.push(`${prefix}: ${text}`);
    if (this.chatHistory.length > this.MAX_HISTORY) {
      this.chatHistory.shift();
    }
  }

  private sendWelcomeBurst(): void {
    // Pick a random subset of the roster for the welcome
    const welcomeViewers = pickRandom(this.sessionRoster, Math.min(6, this.sessionRoster.length));

    welcomeViewers.forEach((persona, i) => {
      const pool = persona.idleMessages;
      if (!pool || pool.length === 0) return;
      const text = pool[Math.floor(Math.random() * pool.length)];
      setTimeout(() => {
        this.logChat(persona.name, text);
        persona.stats.messageCount++;
        this.onChat?.(
          [{ viewer: persona.name, color: persona.color, text }],
          this.viewerCount,
        );
      }, 500 + i * (400 + Math.random() * 600));
    });
  }

  // ═══════════════════════════════════════════════════════════
  // LAYER 1: Instant reactions — <300ms, no API
  // ═══════════════════════════════════════════════════════════

  private fireInstantReaction(eventType: string, _context: VibeBuddyEvent['context']): void {
    const now = Date.now();
    const lastTime = this.lastInstantTime[eventType] ?? 0;
    const isHype = HYPE_EVENTS.has(eventType);
    const styleConf = STYLE_CONFIG[this.chatStyle] ?? STYLE_CONFIG.hype;

    if (!isHype && !styleConf.instantOnAll) return;
    if (now - lastTime < 3_000) return;
    this.lastInstantTime[eventType] = now;

    const viewers = pickRandom(this.sessionRoster, 2 + (Math.random() < 0.4 ? 1 : 0));
    const messages: ChatMessage[] = [];

    for (const viewer of viewers) {
      const pool = viewer.reactions[eventType];
      if (!pool || pool.length === 0) continue;

      // Pick a text that hasn't been used yet
      const available = pool.filter(t => !this.usedTexts.has(t));
      if (available.length === 0) continue;
      const text = available[Math.floor(Math.random() * available.length)];
      this.usedTexts.add(text);
      viewer.stats.messageCount++;

      messages.push({ viewer: viewer.name, color: viewer.color, text });
    }

    // Clean up used texts when it gets too big (keep last 80)
    if (this.usedTexts.size > 80) {
      const arr = [...this.usedTexts];
      this.usedTexts = new Set(arr.slice(arr.length - 40));
    }

    messages.forEach((msg, i) => {
      setTimeout(() => {
        this.logChat(msg.viewer, msg.text);
        this.onChat?.([msg], this.viewerCount);
      }, i * (200 + Math.random() * 300));
    });
  }



  private sendIdleChat(): void {
    if (this.sessionRoster.length === 0) return;
    const viewer = this.sessionRoster[Math.floor(Math.random() * this.sessionRoster.length)];
    const pool = viewer.idleMessages;
    if (!pool || pool.length === 0) return;

    const available = pool.filter(t => !this.usedTexts.has(t));
    if (available.length === 0) return;
    const text = available[Math.floor(Math.random() * available.length)];
    this.usedTexts.add(text);
    viewer.stats.messageCount++;

    this.logChat(viewer.name, text);
    this.onChat?.([{ viewer: viewer.name, color: viewer.color, text }], this.viewerCount);
  }

  // ═══════════════════════════════════════════════════════════
  // Event handling — fires Layer 1 instantly + buffers for Layer 2
  // ═══════════════════════════════════════════════════════════

  private handleEvent(event: VibeBuddyEvent): void {
    const boost = EVENT_VIEWER_BOOST[event.type] ?? 1;
    this.viewerCount = Math.max(MIN_VIEWERS, Math.min(MAX_VIEWERS, this.viewerCount + boost));
    this.lastActivityTime = Date.now();
    this.onViewerUpdate?.(this.viewerCount);

    if (event.type === 'keystroke') this.totalKeystrokes++;
    if (event.type === 'save') this.totalSaves++;
    if (event.type === 'error-added') this.totalErrors++;

    // LAYER 1: Fire instant reaction NOW
    this.fireInstantReaction(event.type, event.context);

    // Buffer for LAYER 2 (LLM batch)
    const detail = this.eventToDetail(event);
    if (detail) {
      this.eventBuffer.push({
        type: event.type,
        detail,
        timestamp: event.timestamp,
        hype: HYPE_EVENTS.has(event.type),
      });
    }
  }

  private eventToDetail(event: VibeBuddyEvent): string | null {
    const ctx = event.context;
    switch (event.type) {
      case 'keystroke':
        return `Typing fast in ${ctx.fileName ?? 'a file'}`;
      case 'save':
        return `Saved ${ctx.fileName ?? 'a file'}`;
      case 'error-added':
        return `ERROR in ${ctx.fileName ?? 'unknown'}: "${ctx.errorMessage ?? ''}"`;
      case 'error-cleared':
        return `Fixing errors... ${ctx.errorCount ?? 0} left`;
      case 'all-errors-cleared':
        return 'ALL ERRORS GONE — CLEAN BUILD';
      case 'git-commit':
        return `COMMITTED: "${ctx.commitMessage ?? 'changes'}"`;
      case 'git-push':
        return 'PUSHED TO PRODUCTION';
      case 'mass-delete':
        return `DELETED ${ctx.linesDeleted ?? '?'} lines — scorched earth`;
      case 'build-pass':
        return 'BUILD PASSED';
      case 'build-fail':
        return 'BUILD FAILED';
      case 'language-change':
        return `Switched to ${ctx.fileName ?? 'a file'}`;
      case 'large-file':
        return `Opened a MASSIVE ${ctx.fileLineCount}-line file`;
      case 'vibe-code-landed':
        return `AI just dropped code in ${ctx.fileCount ?? '?'} files`;
      case 'vibe-ai-working':
        return 'AI is cooking...';
      case 'vibe-prompting':
        return 'Sending prompt to AI';
      case 'convo-user-prompted':
        return ctx.userTopic ? `Talking to AI about: ${ctx.userTopic}` : 'Prompting AI';
      case 'convo-error-loop':
        return 'STUCK IN ERROR LOOP';
      case 'convo-deep-dive':
        return 'Deep diving for 10+ minutes';
      case 'idle':
        return 'AFK';
      case 'activity-deep-focus':
        return 'In the ZONE — deep focus';
      case 'activity-speed-run':
        return 'SPEED RUN';
      case 'activity-late-night':
        return 'Late night session';
      case 'activity-stuck':
        return 'Looks stuck...';
      default:
        return null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // LAYER 2: LLM smart reactions — contextual, 3-5s delay
  // ═══════════════════════════════════════════════════════════

  private async flushBatch(): Promise<void> {
    if (!this.apiKey || this.eventBuffer.length === 0) return;

    const events = this.dedupeEvents(this.eventBuffer);
    const hasHype = this.eventBuffer.some(e => e.hype);
    this.eventBuffer = [];

    const styleBase = (STYLE_CONFIG[this.chatStyle] ?? STYLE_CONFIG.hype).baseMsgCount;
    const msgCount = hasHype ? Math.min(styleBase + 2, 8) : styleBase;

    const sessionMinutes = Math.floor((Date.now() - this.sessionStartTime) / 60_000);
    const prompt = this.buildPrompt(events, msgCount, sessionMinutes, hasHype);

    streamLog({ type: 'batch-prompt', events: events.map(e => e.detail), viewers: this.viewerCount, lang: this.chatLang });

    try {
      const response = await this.callGemini(prompt);
      if (!response) return;

      streamLog({ type: 'batch-llm-response', raw: response.slice(0, 500) });

      const messages = this.parseMessages(response);
      if (messages.length > 0) {
        for (const msg of messages) {
          this.logChat(msg.viewer, msg.text);
          streamLog({ type: 'batch-reaction', viewer: msg.viewer, text: msg.text });
        }
        this.onChat?.(messages, this.viewerCount);
      }
    } catch {
      // Silently fail
    }
  }

  private dedupeEvents(events: StreamEvent[]): StreamEvent[] {
    const result: StreamEvent[] = [];
    let keystrokeCount = 0;

    for (const ev of events) {
      if (ev.type === 'keystroke') {
        keystrokeCount++;
      } else {
        if (keystrokeCount > 0) {
          result.push({
            type: 'keystroke',
            detail: `Typing non-stop (${keystrokeCount} keystrokes)`,
            timestamp: ev.timestamp,
            hype: false,
          });
          keystrokeCount = 0;
        }
        result.push(ev);
      }
    }

    if (keystrokeCount > 0) {
      const speed = keystrokeCount > 20 ? 'BLAZING' : keystrokeCount > 10 ? 'fast' : 'steady';
      result.push({
        type: 'keystroke',
        detail: `${speed} typing (${keystrokeCount} keystrokes)`,
        timestamp: Date.now(),
        hype: keystrokeCount > 20,
      });
    }

    return result;
  }

  private captureCodeContext(): string {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return '';

    const doc = editor.document;
    const cursor = editor.selection.active;
    const startLine = Math.max(0, cursor.line - 5);
    const endLine = Math.min(doc.lineCount - 1, cursor.line + 5);

    const lines: string[] = [];
    for (let i = startLine; i <= endLine; i++) {
      const prefix = i === cursor.line ? '>>>' : '   ';
      lines.push(`${prefix} ${doc.lineAt(i).text}`);
    }

    return lines.join('\n');
  }

  private buildPrompt(events: StreamEvent[], msgCount: number, sessionMinutes: number, isHype: boolean): string {
    const eventList = events.map(e => `- ${e.detail}`).join('\n');

    const editor = vscode.window.activeTextEditor;
    const fileName = editor?.document.fileName.split('/').pop() ?? 'unknown';
    const language = editor?.document.languageId ?? 'unknown';
    const lineCount = editor?.document.lineCount ?? 0;
    const codeContext = this.captureCodeContext();

    const personaDesc = describeSessionViewers(this.sessionRoster);

    // Claude conversation context — the MAIN content for vibe coders
    let claudeSection = '';
    if (this.recentPrompts.length > 0 || this.lastClaudeTopic) {
      claudeSection = `\n📡 שיחה עם Claude (זה הדבר הכי מעניין לצופים!):`;
      if (this.lastClaudeTopic) {
        claudeSection += `\nנושא: ${this.lastClaudeTopic} | כוונה: ${this.lastClaudeIntent} | עומק שיחה: ${this.claudeConvoDepth} הודעות`;
      }
      if (this.recentPrompts.length > 0) {
        claudeSection += `\nפרומפטים אחרונים שהמפתח שלח ל-Claude:`;
        this.recentPrompts.forEach((p, i) => {
          claudeSection += `\n  ${i + 1}. "${p}"`;
        });
      }
    }

    return `אתה קבוצה של צופים שצופים ב-vibe coder דרך ה-IDE שלו.

חשוב! יש 3 ערוצים שונים — אל תערבב ביניהם:
1. 🎙️ STREAMER (בצ'אט הסטרים) = הודעות שהסטרימר כותב ישירות לכם, לצופים. הגיבו לו!
2. 📡 CLAUDE PROMPT = פרומפטים שהסטרימר שולח ל-Claude Code (כלי AI לקוד). זה לא מופנה אליכם — זה עבודה. הגיבו על זה כצופים ("הוא ביקש מהבינה לעשות X")
3. @ (צופה) = הודעות של צופים אחרים בצ'אט. תגיבו אחד לשני.

מה מעניין:
- מה הוא מבקש מ-Claude (הפרומפטים — זה התוכן האמיתי)
- כמה עמוק הוא בשיחה עם Claude
- האם הוא מסתבך עם Claude
- כשהוא כותב לכם בצ'אט — זה הרגע הכי חשוב, כולם מגיבים

${isHype ? '🔥 רגע דרמטי!' : ''}

${personaDesc}
${claudeSection}

${this.lastClaudeResponse ? `🤖 תשובת Claude האחרונה: "${this.lastClaudeResponse.slice(0, 100)}..." (${this.lastClaudeResponseLength} תווים, ${this.lastClaudeCodeBlocks} בלוקי קוד${this.lastClaudeFilesModified.length > 0 ? `, שינה: ${this.lastClaudeFilesModified.join(', ')}` : ''})` : ''}

מה על המסך:
קובץ: ${fileName} (${language}, ${lineCount} שורות)
${codeContext ? `קוד:\n${codeContext}` : ''}

אירועים:
${eventList}

סשן: ${sessionMinutes} דק | ${this.totalKeystrokes} הקשות | ${this.totalSaves} שמירות | ${this.totalErrors} שגיאות

${this.chatHistory.length > 0 ? `היסטוריית הצ'אט המלאה (הכל מה שנכתב עד עכשיו — קרא הכל!):\n${this.chatHistory.join('\n')}` : ''}

צור ${msgCount} הודעות. חוקים:
- עדיפות ראשונה: הגיבו על השיחה עם Claude — הפרומפטים, הנושאים, עומק השיחה
- עדיפות שנייה: הגיבו על מה שקורה ב-IDE — קבצים, שגיאות, שמות ספציפיים
- לא תגובות גנריות כמו "PogChamp", "W", "LETS GO" — אלה משעממות
- צופים בשפה מקומית כותבים רק בשפה שלהם, בלי ערבוב
- כשצופה מגיב לצופה אחר — הוא חייב להגיב באותה שפה שהצופה ההוא כתב. אם @achi_hadev כתב בעברית ו-@Kappa_Andy עונה לו, הוא עונה בעברית (גם אם הוא בדרך כלל כותב באנגלית). אנשים מתאימים את עצמם לשפה של השיחה.
- טבעי, לא מושלם, קיצורים מותרים
${this.improvements?.promptRules.length ? `\nכללים נלמדים מסשנים קודמים (חשוב!):\n${this.improvements.promptRules.map(r => `- ${r}`).join('\n')}` : ''}
${this.improvements?.avoid.length ? `\nלעולם אל תשתמש בביטויים האלה (חזרו יותר מדי):\n${this.improvements.avoid.slice(0, 15).map(a => `- "${a}"`).join('\n')}` : ''}

פורמט:
@ViewerName: הודעה`;
  }

  private parseMessages(raw: string): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const lines = raw.trim().split('\n');

    for (const line of lines) {
      const match = line.match(/^@([^:]+?):\s*(.+)$/);
      if (match) {
        const viewer = match[1];
        const text = match[2].trim();
        // Use roster color if viewer exists, otherwise hash-based
        const rosterViewer = this.sessionRoster.find(v => v.name === viewer);
        const color = rosterViewer?.color ?? VIEWER_COLORS[this.hashString(viewer) % VIEWER_COLORS.length];
        if (rosterViewer) rosterViewer.stats.messageCount++;
        messages.push({ viewer, color, text });
      }
    }

    return messages;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private callGemini(prompt: string): Promise<string | null> {
    return new Promise((resolve) => {
      if (!this.apiKey) { resolve(null); return; }

      const timer = setTimeout(() => resolve(null), TIMEOUT_MS);

      const body = JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: prompt }] },
        ],
        generationConfig: {
          maxOutputTokens: 350,
          temperature: 1.4,
        },
      });

      const url = new URL(`${GEMINI_URL}?key=${this.apiKey}`);

      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            clearTimeout(timer);
            try {
              const json = JSON.parse(data) as {
                candidates?: { content?: { parts?: { text?: string }[] } }[];
              };
              const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
              resolve(text ?? null);
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

      req.write(body);
      req.end();
    });
  }
}

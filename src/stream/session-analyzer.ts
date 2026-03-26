// ═══════════════════════════════════════════════════════════════
// Session Analyzer — self-improvement loop.
// Every 30 minutes, sends recent chat log to backend /api/analyze.
// Backend returns improvement rules that get merged into the
// improvements file. Stream chat manager reloads these rules
// and the NEXT batch of chat is better.
// ═══════════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as vscode from 'vscode';

const HOME = process.env.HOME ?? '/tmp';
const LOG_PATH = path.join(HOME, '.vibestream-stream-log.jsonl');
const IMPROVEMENTS_PATH = path.join(HOME, '.vibestream-improvements.json');
const ANALYSIS_INTERVAL_MS = 30 * 60_000; // 30 minutes
const MIN_ENTRIES_FOR_ANALYSIS = 10;

interface LogEntry {
  ts: string;
  type: string;
  viewer?: string;
  text?: string;
  raw?: string;
  streamerMsg?: string;
  events?: string[];
  viewers?: number;
  lang?: string;
}

export interface Improvements {
  version: number;
  lastAnalyzed: string;
  sessionsAnalyzed: number;
  qualityScore: number;
  avoid: string[];
  promptRules: string[];
  suggestedReactions: Record<string, string[]>;
}

export function loadImprovements(): Improvements {
  try {
    if (fs.existsSync(IMPROVEMENTS_PATH)) {
      const raw = fs.readFileSync(IMPROVEMENTS_PATH, 'utf-8');
      return JSON.parse(raw) as Improvements;
    }
  } catch { /* start fresh */ }
  return {
    version: 0,
    lastAnalyzed: '',
    sessionsAnalyzed: 0,
    qualityScore: 5,
    avoid: [],
    promptRules: [],
    suggestedReactions: {},
  };
}

function saveImprovements(imp: Improvements): void {
  try {
    fs.writeFileSync(IMPROVEMENTS_PATH, JSON.stringify(imp, null, 2), 'utf-8');
  } catch { /* silent */ }
}

function readRecentLog(): LogEntry[] {
  try {
    if (!fs.existsSync(LOG_PATH)) return [];
    const raw = fs.readFileSync(LOG_PATH, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines.map(line => {
      try { return JSON.parse(line) as LogEntry; }
      catch { return null; }
    }).filter((e): e is LogEntry => e !== null);
  } catch {
    return [];
  }
}

function trimLog(): void {
  // Keep only last 200 entries to prevent file bloat
  try {
    const entries = readRecentLog();
    if (entries.length > 200) {
      const trimmed = entries.slice(-200);
      fs.writeFileSync(LOG_PATH, trimmed.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf-8');
    }
  } catch { /* silent */ }
}

// ═══ Backend API Call ═══

function callBackendAnalyze(
  backendUrl: string,
  licenseKey: string,
  chatLog: LogEntry[],
  currentRules: string[],
  currentAvoid: string[],
  streamLang: string,
): Promise<{
  quality_score: number;
  avoid: string[];
  prompt_rules: string[];
  suggested_reactions: Record<string, string[]>;
  analysis: string;
} | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 15_000);

    const body = JSON.stringify({
      chat_log: chatLog.slice(-80).map(e => ({
        ts: e.ts,
        viewer: e.viewer ?? '',
        text: e.text ?? e.streamerMsg ?? '',
        type: e.type,
      })),
      current_rules: currentRules,
      current_avoid: currentAvoid,
      stream_lang: streamLang,
    });

    const url = new URL(`${backendUrl}/api/analyze`);

    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-License-Key': licenseKey,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          clearTimeout(timer);
          try {
            resolve(JSON.parse(data));
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

// ═══ Analysis Runner ═══

async function runAnalysis(backendUrl: string, licenseKey: string, streamLang: string): Promise<boolean> {
  const entries = readRecentLog();
  if (entries.length < MIN_ENTRIES_FOR_ANALYSIS) return false;

  const existing = loadImprovements();

  const result = await callBackendAnalyze(
    backendUrl,
    licenseKey,
    entries,
    existing.promptRules,
    existing.avoid,
    streamLang,
  );

  if (!result) return false;

  // Merge improvements
  const updated: Improvements = {
    version: existing.version + 1,
    lastAnalyzed: new Date().toISOString(),
    sessionsAnalyzed: existing.sessionsAnalyzed + 1,
    qualityScore: result.quality_score ?? existing.qualityScore,
    avoid: [...new Set([...existing.avoid, ...result.avoid])].slice(-50),
    promptRules: [...new Set([...existing.promptRules, ...result.prompt_rules])].slice(-15),
    suggestedReactions: mergeReactions(existing.suggestedReactions, result.suggested_reactions),
  };

  saveImprovements(updated);
  trimLog();

  return true;
}

function mergeReactions(
  existing: Record<string, string[]>,
  incoming: Record<string, string[]>,
): Record<string, string[]> {
  const merged = { ...existing };
  for (const [lang, reactions] of Object.entries(incoming ?? {})) {
    merged[lang] = [...new Set([...(merged[lang] ?? []), ...reactions])].slice(-30);
  }
  return merged;
}

// ═══ Periodic Analysis Loop ═══

export class SelfImprovementLoop {
  private timer: ReturnType<typeof setInterval> | null = null;
  private backendUrl: string;
  private licenseKey: string;
  private streamLang: string;
  private onImproved: (() => void) | undefined;

  constructor(backendUrl: string, licenseKey: string, streamLang: string) {
    this.backendUrl = backendUrl;
    this.licenseKey = licenseKey;
    this.streamLang = streamLang;
  }

  setOnImproved(handler: () => void): void {
    this.onImproved = handler;
  }

  start(): vscode.Disposable {
    // Run first analysis after 5 minutes (give some data to accumulate)
    const firstRun = setTimeout(() => {
      this.analyze();
    }, 5 * 60_000);

    // Then every 30 minutes
    this.timer = setInterval(() => {
      this.analyze();
    }, ANALYSIS_INTERVAL_MS);

    return new vscode.Disposable(() => {
      clearTimeout(firstRun);
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      // Final analysis on stop (synchronous save — no race condition)
      this.analyze();
    });
  }

  updateConfig(lang: string): void {
    this.streamLang = lang;
  }

  private async analyze(): Promise<void> {
    const success = await runAnalysis(this.backendUrl, this.licenseKey, this.streamLang);
    if (success) {
      this.onImproved?.();
    }
  }
}

// Legacy export for backward compat
export async function analyzeSession(backendUrl: string): Promise<void> {
  await runAnalysis(backendUrl, '', 'he');
}

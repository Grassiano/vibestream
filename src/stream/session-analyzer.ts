import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const HOME = process.env.HOME ?? '/tmp';
const LOG_PATH = path.join(HOME, '.vibestream-stream-log.jsonl');
const IMPROVEMENTS_PATH = path.join(HOME, '.vibestream-improvements.json');
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

/** Load existing improvements or return default */
export function loadImprovements(): Improvements {
  try {
    if (fs.existsSync(IMPROVEMENTS_PATH)) {
      const raw = fs.readFileSync(IMPROVEMENTS_PATH, 'utf-8');
      return JSON.parse(raw) as Improvements;
    }
  } catch {
    // Corrupted file — start fresh
  }
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

/** Save improvements to disk */
function saveImprovements(imp: Improvements): void {
  try {
    fs.writeFileSync(IMPROVEMENTS_PATH, JSON.stringify(imp, null, 2), 'utf-8');
  } catch {
    // Silent
  }
}

/** Read and parse the session log */
function readLog(): LogEntry[] {
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

/** Clear the log after analysis */
function clearLog(): void {
  try {
    fs.writeFileSync(LOG_PATH, '', 'utf-8');
  } catch {
    // Silent
  }
}

/** Run post-session analysis — called on deactivate */
export async function analyzeSession(apiKey: string): Promise<void> {
  const entries = readLog();
  if (entries.length < 5) return; // Not enough data

  const existing = loadImprovements();

  // Build analysis summary from log
  const reactions = entries.filter(e => e.type?.includes('reaction'));
  const prompts = entries.filter(e => e.type?.includes('prompt'));
  const llmResponses = entries.filter(e => e.type?.includes('llm-response'));

  // Find repeated texts
  const textCounts = new Map<string, number>();
  for (const r of reactions) {
    if (r.text) {
      textCounts.set(r.text, (textCounts.get(r.text) ?? 0) + 1);
    }
  }
  const repeated = [...textCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([text, count]) => `"${text}" (${count}x)`);

  // Build all reaction texts for analysis
  const allReactions = reactions
    .filter(r => r.text && r.viewer)
    .map(r => `[${r.ts?.slice(11, 19) ?? ''}] @${r.viewer}: ${r.text}`)
    .slice(-80); // Last 80 reactions

  const streamerMessages = entries
    .filter(e => e.type === 'streamer-prompt' && e.streamerMsg)
    .map(e => `[${e.ts?.slice(11, 19) ?? ''}] STREAMER: ${e.streamerMsg}`)
    .slice(-20);

  const prompt = `אתה מנתח איכות של צ'אט סימולציה (Twitch-style) שרץ לצד IDE של מפתח. נתח את הסשן הזה ותן שיפורים ספציפיים.

סטטיסטיקות:
- ${reactions.length} תגובות צופים
- ${prompts.length} פרומפטים ל-LLM
- ${llmResponses.length} תגובות LLM
- ${streamerMessages.length} הודעות סטרימר

תגובות שחזרו:
${repeated.length > 0 ? repeated.join('\n') : 'אין חזרות'}

הודעות הסטרימר:
${streamerMessages.join('\n') || 'לא היו'}

דגימת תגובות צופים (אחרונות 80):
${allReactions.join('\n') || 'ריק'}

שיפורים קודמים שכבר נטענו (גרסה ${existing.version}):
- הימנע מ: ${existing.avoid.slice(0, 10).join(', ') || 'אין'}
- כללי פרומפט: ${existing.promptRules.join(', ') || 'אין'}

תן תשובה בפורמט JSON בלבד (בלי markdown, בלי הסברים):
{
  "qualityScore": <1-10>,
  "repeatedToAvoid": ["text1", "text2", ...],
  "newPromptRules": ["rule1", "rule2", ...],
  "suggestedReactions": {
    "he": ["תגובה1", "תגובה2"],
    "en": ["reaction1", "reaction2"]
  },
  "analysis": "סיכום קצר של מה היה טוב ומה לא"
}`;

  try {
    const response = await callGemini(apiKey, prompt);
    if (!response) return;

    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const result = JSON.parse(jsonMatch[0]) as {
      qualityScore: number;
      repeatedToAvoid: string[];
      newPromptRules: string[];
      suggestedReactions: Record<string, string[]>;
      analysis: string;
    };

    // Merge with existing improvements
    const newAvoid = [...new Set([...existing.avoid, ...(result.repeatedToAvoid ?? [])])].slice(-50);
    const newRules = [...new Set([...existing.promptRules, ...(result.newPromptRules ?? [])])].slice(-15);

    // Merge suggested reactions
    const mergedReactions = { ...existing.suggestedReactions };
    for (const [lang, reactions] of Object.entries(result.suggestedReactions ?? {})) {
      const existing_ = mergedReactions[lang] ?? [];
      mergedReactions[lang] = [...new Set([...existing_, ...reactions])].slice(-30);
    }

    const updated: Improvements = {
      version: existing.version + 1,
      lastAnalyzed: new Date().toISOString(),
      sessionsAnalyzed: existing.sessionsAnalyzed + 1,
      qualityScore: result.qualityScore ?? existing.qualityScore,
      avoid: newAvoid,
      promptRules: newRules,
      suggestedReactions: mergedReactions,
    };

    saveImprovements(updated);

    // Log the analysis result
    const analysisLog = {
      ts: new Date().toISOString(),
      type: 'session-analysis',
      version: updated.version,
      score: updated.qualityScore,
      newAvoidCount: result.repeatedToAvoid?.length ?? 0,
      newRulesCount: result.newPromptRules?.length ?? 0,
      analysis: result.analysis,
    };
    fs.appendFileSync(LOG_PATH, JSON.stringify(analysisLog) + '\n');

    // Clear old log entries (keep analysis result)
    // We don't clear completely — just trim to last analysis
    clearLog();
    fs.appendFileSync(LOG_PATH, JSON.stringify(analysisLog) + '\n');

  } catch {
    // Analysis failed — no problem, try next time
  }
}

function callGemini(apiKey: string, prompt: string): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 10_000);

    const body = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 800, temperature: 0.3 },
    });

    const url = new URL(`${GEMINI_URL}?key=${apiKey}`);

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
            resolve(json.candidates?.[0]?.content?.parts?.[0]?.text ?? null);
          } catch {
            resolve(null);
          }
        });
      },
    );

    req.on('error', () => { clearTimeout(timer); resolve(null); });
    req.write(body);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════
// Session Recap — end-of-session score card generator.
// Pulls from SessionScore + PlayerProfile to build everything
// the webview needs to render a full recap screen.
// ═══════════════════════════════════════════════════════════════

import { SessionScore, PlayerProfile } from './xp-engine';

// ═══ Session Log Entry ═══

export interface SessionLogEntry {
  ts: number;
  type: string;
  detail?: string;
}

// ═══ Recap Data Shape ═══

export interface SessionRecapData {
  rank: 'S' | 'A' | 'B' | 'C' | 'D';
  rankColor: string;
  duration: string;
  xpEarned: number;
  levelStart: number;
  levelEnd: number;
  titleStart: string;
  titleEnd: string;
  leveledUp: boolean;
  peakViewers: number;
  peakCombo: number;
  streakDays: number;
  achievements: string[];
  highlights: string[];
  improvements: string[];
}

// ═══ Constants ═══

const RANK_COLORS: Record<SessionRecapData['rank'], string> = {
  S: '#ffd700',
  A: '#a855f7',
  B: '#60a5fa',
  C: '#4ade80',
  D: '#71717a',
};

// ═══ Duration Formatter ═══

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ═══ Highlight Generator ═══

function generateHighlights(log: SessionLogEntry[]): string[] {
  const highlights: string[] = [];

  // Git pushes
  const pushes = log.filter(e => e.type === 'git-push');
  if (pushes.length > 0) {
    const label = pushes.length === 1
      ? 'Pushed to production'
      : `Pushed to production ${pushes.length}x`;
    highlights.push(label);
  }

  // Peak viewer count from log
  const viewerEvents = log.filter(e => e.type === 'viewer-update' && e.detail !== undefined);
  if (viewerEvents.length > 0) {
    const peak = viewerEvents.reduce((max, e) => {
      const count = parseInt(e.detail ?? '0', 10);
      return count > max ? count : max;
    }, 0);
    if (peak >= 100) {
      highlights.push(`Peak: ${peak.toLocaleString()} viewers`);
    }
  }

  // Level-up events
  const levelUps = log.filter(e => e.type === 'level-up');
  for (const lu of levelUps) {
    const detail = lu.detail ? ` to ${lu.detail}` : '';
    highlights.push(`Leveled up${detail}!`);
  }

  // Combo streak events
  const comboEvents = log.filter(e => e.type === 'combo-update');
  if (comboEvents.length > 0) {
    const peakComboEvent = comboEvents.reduce((max, e) => {
      const val = parseInt(e.detail ?? '0', 10);
      return val > parseInt(max.detail ?? '0', 10) ? e : max;
    });
    const peakVal = parseInt(peakComboEvent.detail ?? '0', 10);
    if (peakVal >= 3) {
      highlights.push(`Hit x${peakVal} combo!`);
    }
  }

  // Error-free streaks — look for gaps in error events >= 15 min
  const errorEvents = log.filter(e =>
    e.type === 'error-added' || e.type === 'build-fail'
  );
  if (errorEvents.length > 0 && log.length >= 2) {
    const sessionStart = log[0].ts;
    const sessionEnd = log[log.length - 1].ts;

    const errorTimes = [
      sessionStart,
      ...errorEvents.map(e => e.ts),
      sessionEnd,
    ].sort((a, b) => a - b);

    let maxGapMs = 0;
    for (let i = 1; i < errorTimes.length; i++) {
      const gap = errorTimes[i] - errorTimes[i - 1];
      if (gap > maxGapMs) maxGapMs = gap;
    }

    const gapMinutes = Math.floor(maxGapMs / 60_000);
    if (gapMinutes >= 15) {
      highlights.push(`${gapMinutes} min with zero errors`);
    }
  } else if (log.length >= 2) {
    // No errors at all — whole session was clean
    const totalMs = log[log.length - 1].ts - log[0].ts;
    const totalMin = Math.floor(totalMs / 60_000);
    if (totalMin >= 15) {
      highlights.push(`${totalMin} min with zero errors`);
    }
  }

  // Long coding streaks — look for dense save/keystroke windows >= 45 min
  const activeEvents = log.filter(e =>
    e.type === 'save' || e.type === 'keystroke' || e.type === 'vibe-code-landed'
  );
  if (activeEvents.length >= 2) {
    let streakStart = activeEvents[0].ts;
    let maxStreakMs = 0;
    const GAP_THRESHOLD_MS = 5 * 60_000; // 5 min silence = streak break

    for (let i = 1; i < activeEvents.length; i++) {
      const gap = activeEvents[i].ts - activeEvents[i - 1].ts;
      if (gap > GAP_THRESHOLD_MS) {
        const streakMs = activeEvents[i - 1].ts - streakStart;
        if (streakMs > maxStreakMs) maxStreakMs = streakMs;
        streakStart = activeEvents[i].ts;
      }
    }
    // Final streak
    const finalStreakMs = activeEvents[activeEvents.length - 1].ts - streakStart;
    if (finalStreakMs > maxStreakMs) maxStreakMs = finalStreakMs;

    const streakMinutes = Math.floor(maxStreakMs / 60_000);
    if (streakMinutes >= 45) {
      highlights.push(`${streakMinutes} min deep focus`);
    }
  }

  // Return 3–5 highlights, trimming to max 5
  return highlights.slice(0, 5);
}

// ═══ Improvement Generator ═══

function generateImprovements(
  score: SessionScore,
  log: SessionLogEntry[],
): string[] {
  const improvements: string[] = [];

  // Many errors — suggest reviewing AI code
  const errorAdded = log.filter(e => e.type === 'error-added').length;
  const buildFails = log.filter(e => e.type === 'build-fail').length;
  if (errorAdded + buildFails >= 5) {
    improvements.push('Review AI code before accepting');
  }

  // No commits at all
  const commits = log.filter(e => e.type === 'git-commit' || e.type === 'git-push').length;
  if (commits === 0) {
    improvements.push('Commit more frequently');
  }

  // Short session (under 20 min)
  if (score.durationMinutes < 20) {
    improvements.push('Try a longer session next time');
  }

  // Low combo — never hit x3
  if (score.peakCombo < 3) {
    improvements.push('Build momentum with faster actions');
  }

  // Return at most 2 improvements
  return improvements.slice(0, 2);
}

// ═══ Main Export ═══

export function generateRecap(
  score: SessionScore,
  profile: PlayerProfile,
  newAchievements: string[],
  sessionLog: SessionLogEntry[],
): SessionRecapData {
  const highlights = generateHighlights(sessionLog);
  const improvements = generateImprovements(score, sessionLog);

  return {
    rank: score.rank,
    rankColor: RANK_COLORS[score.rank],
    duration: formatDuration(score.durationMinutes),
    xpEarned: score.xpEarned,
    levelStart: score.startLevel,
    levelEnd: score.endLevel,
    titleStart: score.startTitle,
    titleEnd: score.endTitle,
    leveledUp: score.levelsGained > 0,
    peakViewers: score.peakViewers,
    peakCombo: score.peakCombo,
    streakDays: profile.streakDays,
    achievements: newAchievements,
    highlights,
    improvements,
  };
}

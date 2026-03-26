declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

// Stream chat elements
const streamChatContainer = document.getElementById('stream-chat-container')!;
const chatMessages = document.getElementById('chat-messages')!;
const viewerNum = document.getElementById('viewer-num')!;

// XP bar elements
const xpLevelBadge = document.getElementById('xp-level-badge')!;
const xpBarFill = document.getElementById('xp-bar-fill')!;
const xpLabel = document.getElementById('xp-label')!;
const comboBadge = document.getElementById('combo-badge')!;
const alertOverlay = document.getElementById('alert-overlay')!;
const alertImage = document.getElementById('alert-image') as HTMLImageElement;
const alertSubtitle = document.getElementById('alert-subtitle')!;
const alertUris: Record<string, string> = {};

function showXpPopup(xp: number, combo: number): void {
  const el = document.createElement('div');
  const size = xp >= 100 ? 'huge' : xp >= 50 ? 'big' : '';
  el.className = `xp-popup ${size}`;
  const comboText = combo >= 2 ? ` x${combo}` : '';
  el.textContent = `+${xp} XP${comboText}`;
  // Random vertical position in chat area
  el.style.bottom = `${60 + Math.random() * 100}px`;
  streamChatContainer.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

function showAlert(alertType: string, subtitle?: string): void {
  const uri = alertUris[alertType];
  if (!uri) return;

  alertImage.src = uri;
  alertSubtitle.textContent = subtitle ?? '';
  alertOverlay.classList.remove('fade-out');
  alertOverlay.classList.add('active');

  // Play alert sound
  playAlertSound(alertType);

  // Flash XP bar gold on level up
  if (alertType === 'level-up') {
    xpBarFill.classList.add('level-up');
  }

  // Hold for 3.5 seconds, then fade out
  setTimeout(() => {
    alertOverlay.classList.add('fade-out');
    setTimeout(() => {
      alertOverlay.classList.remove('active', 'fade-out');
      xpBarFill.classList.remove('level-up');
    }, 500);
  }, 3500);
}

let _alertCtx: AudioContext | null = null;

function getAlertCtx(): AudioContext {
  if (!_alertCtx) _alertCtx = new AudioContext();
  return _alertCtx;
}

function playAlertSound(alertType: string): void {
  try {
    const ctx = getAlertCtx();
    const t = ctx.currentTime;

    if (alertType === 'level-up') {
      // Rising arpeggio — C5→E5→G5→C6, major chord ascending, shimmer feel
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        const noteStart = t + i * 0.1;
        const noteEnd = noteStart + 0.18;
        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.14, noteStart + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, noteEnd);
        osc.start(noteStart);
        osc.stop(noteEnd + 0.05);

        // Shimmer: faint overtone one octave up
        const shimmer = ctx.createOscillator();
        const shimmerGain = ctx.createGain();
        shimmer.connect(shimmerGain);
        shimmerGain.connect(ctx.destination);
        shimmer.type = 'sine';
        shimmer.frequency.setValueAtTime(freq * 2, noteStart);
        shimmerGain.gain.setValueAtTime(0, noteStart);
        shimmerGain.gain.linearRampToValueAtTime(0.03, noteStart + 0.01);
        shimmerGain.gain.exponentialRampToValueAtTime(0.001, noteEnd + 0.1);
        shimmer.start(noteStart);
        shimmer.stop(noteEnd + 0.15);
      });

    } else if (alertType === 'milestone') {
      // White noise burst → rising sine sweep → double-ding (C6, E6)
      const bufferSize = ctx.sampleRate * 0.1;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseGain = ctx.createGain();
      noise.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseGain.gain.setValueAtTime(0.12, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      noise.start(t);
      noise.stop(t + 0.1);

      // Rising sine sweep 200→800Hz over 300ms
      const sweep = ctx.createOscillator();
      const sweepGain = ctx.createGain();
      sweep.connect(sweepGain);
      sweepGain.connect(ctx.destination);
      sweep.type = 'sine';
      sweep.frequency.setValueAtTime(200, t + 0.1);
      sweep.frequency.exponentialRampToValueAtTime(800, t + 0.4);
      sweepGain.gain.setValueAtTime(0.09, t + 0.1);
      sweepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      sweep.start(t + 0.1);
      sweep.stop(t + 0.42);

      // Double-ding: C6 then E6
      [[1046.5, t + 0.42], [1318.5, t + 0.52]].forEach(([freq, start]) => {
        const ding = ctx.createOscillator();
        const dingGain = ctx.createGain();
        ding.connect(dingGain);
        dingGain.connect(ctx.destination);
        ding.type = 'sine';
        ding.frequency.setValueAtTime(freq, start);
        dingGain.gain.setValueAtTime(0.15, start);
        dingGain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
        ding.start(start);
        ding.stop(start + 0.2);
      });

    } else if (alertType === 'combo') {
      // Square punch at start, then sawtooth ramp 150→600Hz — short, aggressive
      const punch = ctx.createOscillator();
      const punchGain = ctx.createGain();
      punch.connect(punchGain);
      punchGain.connect(ctx.destination);
      punch.type = 'square';
      punch.frequency.setValueAtTime(150, t);
      punchGain.gain.setValueAtTime(0.18, t);
      punchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      punch.start(t);
      punch.stop(t + 0.05);

      const ramp = ctx.createOscillator();
      const rampGain = ctx.createGain();
      ramp.connect(rampGain);
      rampGain.connect(ctx.destination);
      ramp.type = 'sawtooth';
      ramp.frequency.setValueAtTime(150, t + 0.03);
      ramp.frequency.exponentialRampToValueAtTime(600, t + 0.18);
      rampGain.gain.setValueAtTime(0.12, t + 0.03);
      rampGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      ramp.start(t + 0.03);
      ramp.stop(t + 0.2);

    } else if (alertType === 'achievement') {
      // 6-note fanfare: G4→B4→D5→G5→D5→G5 (50ms each), longer sustain on last
      const notes = [392.0, 493.88, 587.33, 783.99, 587.33, 783.99];
      notes.forEach((freq, i) => {
        const isLast = i === notes.length - 1;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        const noteStart = t + i * 0.05;
        const duration = isLast ? 0.35 : 0.06;
        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.13, noteStart + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + duration);
        osc.start(noteStart);
        osc.stop(noteStart + duration + 0.05);
      });
    }
  } catch {
    // Audio not available
  }
}

function playXPSound(): void {
  try {
    const ctx = getAlertCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    gain.gain.setValueAtTime(0.03, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.start(t);
    osc.stop(t + 0.035);
  } catch {
    // Audio not available
  }
}

function playComboTickSound(combo: number): void {
  try {
    const ctx = getAlertCtx();
    const t = ctx.currentTime;
    const freq = 400 * combo;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.start(t);
    osc.stop(t + 0.055);
  } catch {
    // Audio not available
  }
}

const MAX_CHAT_MESSAGES = 50;
const hypeFill = document.getElementById('hype-fill')!;
let hypeLevel = 0;
let hypeDecayTimer: ReturnType<typeof setInterval> | null = null;

function boostHype(amount: number): void {
  hypeLevel = Math.min(100, hypeLevel + amount);
  hypeFill.style.width = `${hypeLevel}%`;

  if (!hypeDecayTimer) {
    hypeDecayTimer = setInterval(() => {
      hypeLevel = Math.max(0, hypeLevel - 2);
      hypeFill.style.width = `${hypeLevel}%`;
      if (hypeLevel <= 0 && hypeDecayTimer) {
        clearInterval(hypeDecayTimer);
        hypeDecayTimer = null;
      }
    }, 500);
  }
}

window.addEventListener('message', (event) => {
  const message = event.data;

  switch (message.type) {
    case 'stream-mode': {
      const { enabled, needsSetup, editMode } = message.payload as { enabled: boolean; needsSetup?: boolean; editMode?: boolean };
      if (enabled) {
        if (needsSetup) {
          isEditMode = editMode ?? false;
          setupGoBtn.textContent = isEditMode ? 'SAVE' : 'GO LIVE';
          const titleEl = document.getElementById('setup-title')!;
          const subtitleEl = document.getElementById('setup-subtitle')!;
          if (isEditMode) {
            titleEl.textContent = 'Stream Settings';
            subtitleEl.textContent = '';
            subtitleEl.style.display = 'none';
          } else {
            titleEl.textContent = '📡 Welcome to VibeStream';
            subtitleEl.textContent = 'Your coding session is about to go live. AI viewers will watch, react, and hype you up. Set up your stream below.';
            subtitleEl.style.display = 'block';
          }
          setupScreen.classList.add('active');
          if (!isEditMode) {
            streamChatContainer.classList.remove('active');
          }
        } else {
          setupScreen.classList.remove('active');
          streamChatContainer.classList.add('active');
        }
      } else {
        streamChatContainer.classList.remove('active');
        setupScreen.classList.remove('active');
      }
      break;
    }

    case 'stream-config': {
      const cfg = message.payload as { name: string; lang: string; style: string };
      setupNameInput.value = cfg.name;
      chatLang = cfg.lang;
      chatStyle = cfg.style;
      document.querySelectorAll('.lang-btn').forEach((btn) => {
        btn.classList.toggle('selected', (btn as HTMLElement).dataset.lang === cfg.lang);
      });
      document.querySelectorAll('.style-option').forEach((opt) => {
        opt.classList.toggle('selected', (opt as HTMLElement).dataset.style === cfg.style);
      });
      break;
    }

    case 'viewer-profiles': {
      // Store all viewer profiles for the session
      const profiles = message.payload as ViewerProfilePayload[];
      for (const p of profiles) {
        viewerProfileCache.set(p.name, p);
      }
      break;
    }

    case 'viewer-profile': {
      // Show a single profile card
      const p = message.payload as ViewerProfilePayload;
      viewerProfileCache.set(p.name, p);
      showProfileCard(p);
      break;
    }

    case 'xp-gain': {
      const { amount, level, title, percent } = message.payload as {
        amount: number; level: number; title: string; percent: number;
      };
      xpLevelBadge.textContent = `⚡ Lv.${level} ${title}`;
      xpBarFill.style.width = `${percent}%`;
      xpLabel.textContent = `+${amount} XP`;
      showXpPopup(amount, 0);
      playXPSound();
      break;
    }

    case 'xp-state': {
      const { level, title, percent, streak } = message.payload as {
        level: number; title: string; percent: number; streak: number;
      };
      xpLevelBadge.textContent = `⚡ Lv.${level} ${title}${streak > 1 ? ` 🔥${streak}` : ''}`;
      xpBarFill.style.width = `${percent}%`;
      break;
    }

    case 'alert': {
      const { alertType, level, title, viewers, multiplier } = message.payload as {
        alertType: string; level?: number; title?: string; viewers?: number; multiplier?: number;
      };
      let subtitle = '';
      if (alertType === 'level-up') subtitle = `Level ${level} — ${title}`;
      else if (alertType === 'milestone') subtitle = `${viewers?.toLocaleString()} VIEWERS!`;
      else if (alertType === 'combo') subtitle = `${multiplier}x XP MULTIPLIER`;
      showAlert(alertType, subtitle);
      break;
    }

    case 'alert-uris': {
      const uris = message.payload as Record<string, string>;
      Object.assign(alertUris, uris);
      break;
    }

    case 'combo-update': {
      const { combo, multiplier } = message.payload as { combo: number; multiplier: number };
      comboBadge.textContent = `x${combo} ${multiplier}x`;
      comboBadge.classList.add('active');
      playComboTickSound(combo);
      break;
    }

    case 'combo-drop': {
      comboBadge.classList.remove('active');
      break;
    }

    case 'hype-level': {
      const { level: hype } = message.payload as { level: number };
      hypeFill.style.width = `${hype}%`;
      break;
    }

    case 'achievement': {
      const { name, icon, description } = message.payload as { name: string; icon: string; description: string };
      showAlert('achievement', `${icon} ${name}`);
      // Add system message to chat
      const el = document.createElement('div');
      el.className = 'chat-msg system-msg';
      el.textContent = `🏆 Achievement Unlocked: ${name} — ${description}`;
      chatMessages.appendChild(el);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      break;
    }

    case 'session-recap': {
      const recap = message.payload as {
        rank: string; rankColor: string; duration: string;
        xpEarned: number; levelStart: number; levelEnd: number;
        titleStart: string; titleEnd: string; leveledUp: boolean;
        peakViewers: number; peakCombo: number; streakDays: number;
        achievements: string[]; highlights: string[]; improvements: string[];
      };
      // Show recap as a system message block in chat
      const recapEl = document.createElement('div');
      recapEl.className = 'chat-msg system-msg';
      const levelStr = recap.leveledUp
        ? `Lv.${recap.levelStart} → Lv.${recap.levelEnd} (${recap.titleEnd})`
        : `Lv.${recap.levelEnd} (${recap.titleEnd})`;
      const achieveStr = recap.achievements.length > 0
        ? `\n🏆 ${recap.achievements.join(', ')}`
        : '';
      recapEl.innerHTML = `<strong style="color:${recap.rankColor};font-size:16px">${recap.rank}-RANK SESSION</strong><br>${recap.duration} | +${recap.xpEarned} XP | ${levelStr}<br>Peak: ${recap.peakViewers.toLocaleString()} viewers | Combo: x${recap.peakCombo} | Streak: ${recap.streakDays}d${achieveStr}`;
      chatMessages.appendChild(recapEl);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      break;
    }

    case 'stream-chat': {
      const { messages: chatMsgs, viewerCount } = message.payload as {
        messages: { viewer: string; color: string; text: string }[];
        viewerCount: number;
      };

      animateViewerCount(viewerCount);

      // Boost hype based on message count
      boostHype(chatMsgs.length * 5);

      // Drip messages in with random delays (150-500ms between each)
      chatMsgs.forEach((msg, i) => {
        setTimeout(() => {
          addChatMessage(msg.viewer, msg.color, msg.text);
        }, i * (150 + Math.random() * 350));
      });
      break;
    }

    case 'viewer-count': {
      const { count } = message.payload as { count: number };
      animateViewerCount(count);
      break;
    }

    case 'daily-challenges': {
      const data = message.payload as {
        date: string;
        challenges: Array<{
          id: string; title: string; description: string; category: string;
          target: number; xp_reward: number; current: number; completed: boolean;
        }>;
        allComplete: boolean;
      };
      renderChallenges(data);
      break;
    }
  }
});

vscode.postMessage({ type: 'ready' });

// ═══════════ Setup Screen ═══════════
const setupScreen = document.getElementById('setup-screen')!;
const setupNameInput = document.getElementById('setup-name') as HTMLInputElement;
const setupGoBtn = document.getElementById('setup-go-btn')!;
let streamerName = 'Streamer';
let chatLang = 'he';
let chatStyle = 'hype';
let isEditMode = false;

// Settings gear button
const settingsBtn = document.getElementById('settings-btn');
settingsBtn?.addEventListener('click', () => {
  vscode.postMessage({ type: 'open-settings' });
});

// Lang buttons
document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    chatLang = (btn as HTMLElement).dataset.lang ?? 'he';
  });
});

// Style options
document.querySelectorAll('.style-option').forEach((opt) => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.style-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    chatStyle = (opt as HTMLElement).dataset.style ?? 'hype';
  });
});

// GO LIVE / SAVE
setupGoBtn.addEventListener('click', () => {
  streamerName = setupNameInput.value.trim() || 'Streamer';
  setupScreen.classList.remove('active');

  if (isEditMode) {
    // Back to chat — stream stays running
    streamChatContainer.classList.add('active');
    isEditMode = false;
  }

  // Send setup config to extension (saves to VS Code settings + updates stream)
  vscode.postMessage({
    type: 'stream-setup',
    payload: { name: streamerName, lang: chatLang, style: chatStyle },
  });
});

// ═══════════ Streamer Sound ═══════════
const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

function playStreamerSound(): void {
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.2);
  } catch {
    // Audio not available — silent
  }
}

// ═══════════ Streamer Chat Input ═══════════
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const chatSendBtn = document.getElementById('chat-send-btn')!;

function sendStreamerMessage(): void {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';

  // Play sound
  playStreamerSound();

  // Display streamer message with gold badge
  const el = document.createElement('div');
  el.className = 'chat-msg streamer-msg';
  el.innerHTML = `<span class="badge badge-streamer">STREAMER</span><span class="viewer-name" style="color:#ffd700">${escapeHtml(streamerName)}</span> <span class="msg-text">${escapeHtml(text)}</span>`;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  boostHype(40);
  vscode.postMessage({ type: 'streamer-chat', text });
}

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendStreamerMessage();
  }
});
chatSendBtn.addEventListener('click', sendStreamerMessage);

// Dynamic badges from viewer profile cache
const BADGE_CSS_MAP: Record<string, string> = { SUB: 'badge-sub', VIP: 'badge-vip', OG: 'badge-og', MOD: 'badge-mod' };

function getViewerBadge(viewer: string): string {
  const profile = viewerProfileCache.get(viewer);
  if (!profile?.badge) return '';
  const cssClass = BADGE_CSS_MAP[profile.badge] ?? 'badge-sub';
  return `<span class="badge ${cssClass}">${profile.badge}</span>`;
}

// Detect hype-worthy text
function isHypeMessage(text: string): boolean {
  const hypePatterns = /\b(PogChamp|KEKW|LETS GO|LFG|SHIP IT|GOAT|INSANE|CRACKED|W W W|GG|POGGERS)\b|^[A-Z\s!]{5,}$|!{3,}|🔥{2,}|🚀{2,}/i;
  return hypePatterns.test(text);
}

// Auto-scroll only if user is near the bottom (not scrolled up reading history)
function isNearBottom(): boolean {
  const threshold = 60;
  return chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < threshold;
}

function addChatMessage(viewer: string, color: string, text: string): void {
  const shouldScroll = isNearBottom();

  const el = document.createElement('div');
  const hype = isHypeMessage(text);
  el.className = hype ? 'chat-msg hype-msg' : 'chat-msg';

  const badge = getViewerBadge(viewer);
  el.innerHTML = `${badge}<span class="viewer-name" style="color:${color}">${viewer}</span> <span class="msg-text">${escapeHtml(text)}</span>`;

  chatMessages.appendChild(el);

  while (chatMessages.children.length > MAX_CHAT_MESSAGES) {
    chatMessages.removeChild(chatMessages.firstChild!);
  }

  if (shouldScroll) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

let currentViewerDisplay = 0;
let viewerAnimFrame: number | null = null;

function animateViewerCount(target: number): void {
  if (viewerAnimFrame) cancelAnimationFrame(viewerAnimFrame);

  const step = () => {
    if (currentViewerDisplay === target) {
      viewerAnimFrame = null;
      return;
    }

    const diff = target - currentViewerDisplay;
    const change = Math.sign(diff) * Math.max(1, Math.floor(Math.abs(diff) * 0.2));
    currentViewerDisplay += change;

    if ((diff > 0 && currentViewerDisplay > target) || (diff < 0 && currentViewerDisplay < target)) {
      currentViewerDisplay = target;
    }

    viewerNum.textContent = String(currentViewerDisplay);
    viewerAnimFrame = requestAnimationFrame(step);
  };

  viewerAnimFrame = requestAnimationFrame(step);
}

// ═══════════ Viewer Profiles ═══════════
interface ViewerProfilePayload {
  name: string;
  color: string;
  personality: string;
  personalityEmoji: string;
  rank: string;
  badge: string;
  profile: { age: number; location: string; bio: string };
  languages: string[];
  watchMinutes: number;
  messageCount: number;
  sessionsWatched: number;
  firstSeen: string;
}

const viewerProfileCache = new Map<string, ViewerProfilePayload>();
const profileOverlay = document.getElementById('profile-overlay')!;
const profileCloseBtn = document.getElementById('profile-close')!;

const RANK_COLORS: Record<string, string> = {
  newcomer: '#71717a',
  regular: '#a1a1aa',
  fan: '#60a5fa',
  sub: '#a855f7',
  vip: '#eab308',
  og: '#f97316',
};

function showProfileCard(p: ViewerProfilePayload): void {
  document.getElementById('profile-avatar')!.textContent = p.personalityEmoji;
  const nameEl = document.getElementById('profile-name-text')!;
  nameEl.textContent = p.name;
  nameEl.style.color = p.color;

  const rankEl = document.getElementById('profile-rank-text')!;
  const rankColor = RANK_COLORS[p.rank] ?? '#71717a';
  rankEl.innerHTML = `<span style="color:${rankColor}">${p.rank.toUpperCase()}</span>`;
  if (p.badge) {
    rankEl.innerHTML += ` <span class="profile-rank-badge" style="background:${rankColor};color:#fff">${p.badge}</span>`;
  }

  document.getElementById('profile-age')!.textContent = `${p.profile.age}y`;
  document.getElementById('profile-location')!.textContent = p.profile.location;

  const LANG_FLAGS: Record<string, string> = {
    he: '🇮🇱', en: '🇺🇸', es: '🇪🇸', pt: '🇧🇷', fr: '🇫🇷',
    de: '🇩🇪', ja: '🇯🇵', ru: '🇷🇺', ar: '🇸🇦',
  };
  const LANG_NAMES: Record<string, string> = {
    he: 'Hebrew', en: 'English', es: 'Spanish', pt: 'Portuguese', fr: 'French',
    de: 'German', ja: 'Japanese', ru: 'Russian', ar: 'Arabic',
  };
  const langDisplay = (p.languages ?? ['en']).map(l => `${LANG_FLAGS[l] ?? ''} ${LANG_NAMES[l] ?? l}`).join(', ');
  document.getElementById('profile-languages')!.textContent = `🗣️ ${langDisplay}`;

  document.getElementById('profile-bio')!.textContent = `"${p.profile.bio}"`;
  document.getElementById('profile-watch')!.textContent = String(p.watchMinutes);
  document.getElementById('profile-sessions')!.textContent = String(p.sessionsWatched);
  document.getElementById('profile-messages')!.textContent = String(p.messageCount);

  const since = new Date(p.firstSeen);
  const dateStr = `${since.getDate()}/${since.getMonth() + 1}`;
  document.getElementById('profile-since')!.textContent = dateStr;

  profileOverlay.classList.add('active');
}

profileCloseBtn.addEventListener('click', () => {
  profileOverlay.classList.remove('active');
});
profileOverlay.addEventListener('click', (e) => {
  if (e.target === profileOverlay) {
    profileOverlay.classList.remove('active');
  }
});

// ═══════════ Daily Challenges ═══════════
const challengesPanel = document.getElementById('challenges-panel')!;
const challengesList = document.getElementById('challenges-list')!;
const challengesDate = document.getElementById('challenges-date')!;
const challengesToggle = document.getElementById('challenges-toggle')!;
let challengesVisible = false;

challengesToggle.addEventListener('click', () => {
  challengesVisible = !challengesVisible;
  challengesPanel.classList.toggle('active', challengesVisible);
});

const CATEGORY_ICONS: Record<string, string> = {
  prompting: '💬',
  review: '👁️',
  workflow: '⚙️',
  focus: '🎯',
};

interface ChallengePayload {
  date: string;
  challenges: Array<{
    id: string; title: string; description: string; category: string;
    target: number; xp_reward: number; current: number; completed: boolean;
  }>;
  allComplete: boolean;
}

function renderChallenges(data: ChallengePayload): void {
  challengesDate.textContent = data.date;
  challengesToggle.classList.toggle('has-challenges', !data.allComplete);

  let html = '';
  for (const c of data.challenges) {
    const pct = Math.min(100, (c.current / c.target) * 100);
    const icon = CATEGORY_ICONS[c.category] ?? '⭐';
    const doneClass = c.completed ? ' completed' : '';
    const fillClass = c.completed ? ' complete' : '';

    html += `<div class="challenge-item${doneClass}">
      <span class="challenge-icon">${c.completed ? '✅' : icon}</span>
      <div class="challenge-info">
        <div class="challenge-name">${escapeHtml(c.title)}</div>
        <div class="challenge-desc">${escapeHtml(c.description)}</div>
      </div>
      <div class="challenge-progress">
        <div class="challenge-bar"><div class="challenge-bar-fill${fillClass}" style="width:${pct}%"></div></div>
        <span class="challenge-count">${c.current}/${c.target}</span>
      </div>
      <span class="challenge-xp">${c.completed ? '✓' : `+${c.xp_reward}`}</span>
    </div>`;
  }

  if (data.allComplete) {
    html += '<div class="challenges-all-done">🎉 All challenges complete! +150 bonus XP</div>';
  }

  challengesList.innerHTML = html;
}

// Handle viewer name click in chat — delegate
chatMessages.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains('viewer-name')) {
    const name = target.textContent?.replace(/:$/, '') ?? '';
    if (!name) return;

    // Check local cache first
    const cached = viewerProfileCache.get(name);
    if (cached) {
      showProfileCard(cached);
    } else {
      // Request from extension
      vscode.postMessage({ type: 'viewer-profile-click', name });
    }
  }
});



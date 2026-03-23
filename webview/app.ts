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

const VIEWER_COLORS_POOL = [
  '#ff4444', '#ff6b6b', '#e94560', '#ff6b9d', '#ec4899',
  '#d946ef', '#a855f7', '#8b5cf6', '#7c3aed', '#6366f1',
  '#60a5fa', '#38bdf8', '#22d3ee', '#06b6d4', '#14b8a6',
  '#10b981', '#34d399', '#4ade80', '#84cc16', '#facc15',
  '#fbbf24', '#f59e0b', '#fb923c', '#f97316', '#c084fc',
];

function hashName(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}

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


// ═══════════════════════════════════════════════════════════════
// Viewer Generator — living agents that persist across sessions.
// Each viewer has a unique name, personality, rank, profile,
// and reaction pools. They rank up by watching, remember past
// sessions, and feel alive.
// ═══════════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as path from 'path';
import { PERSONAS_BY_LANG, ViewerPersona, PersonaType } from './viewer-personas';

// ═══ Types ═══

export type BasePersonality = 'hype' | 'troll' | 'noob' | 'veteran' | 'critic' | 'lurker' | 'spammer';
export type ViewerRank = 'newcomer' | 'regular' | 'fan' | 'sub' | 'vip' | 'og';

export interface ViewerProfile {
  age: number;
  location: string;
  bio: string;
}

export interface ViewerAgent {
  id: string;
  name: string;
  color: string;
  personality: BasePersonality;
  lang: string;
  rank: ViewerRank;
  badge: string;
  profile: ViewerProfile;
  stats: {
    watchMinutes: number;
    messageCount: number;
    firstSeen: string;
    lastSeen: string;
    sessionsWatched: number;
  };
  reactions: Record<string, string[]>;
  idleMessages: string[];
  streamerReactions: string[];
}

// Serializable viewer (no reaction pools — those are hydrated from persona system)
interface SavedViewer {
  id: string;
  name: string;
  color: string;
  personality: BasePersonality;
  lang: string;
  profile: ViewerProfile;
  stats: {
    watchMinutes: number;
    messageCount: number;
    firstSeen: string;
    lastSeen: string;
    sessionsWatched: number;
  };
}

interface SavedRoster {
  version: number;
  viewers: SavedViewer[];
}

// ═══ Rank System ═══

const RANK_BADGES: Record<ViewerRank, string> = {
  newcomer: '',
  regular: '',
  fan: '',
  sub: 'SUB',
  vip: 'VIP',
  og: 'OG',
};

export function computeRank(watchMinutes: number): ViewerRank {
  if (watchMinutes >= 500) return 'og';
  if (watchMinutes >= 180) return 'vip';
  if (watchMinutes >= 60) return 'sub';
  if (watchMinutes >= 20) return 'fan';
  if (watchMinutes >= 5) return 'regular';
  return 'newcomer';
}

export function rankBadge(rank: ViewerRank): string {
  return RANK_BADGES[rank];
}

// ═══ Personality → Persona Lookup ═══

const PERSONALITY_TO_TYPE: Record<BasePersonality, Record<string, PersonaType>> = {
  hype:    { default: 'fanboy', he: 'israeli_fan' },
  troll:   { default: 'troll',  he: 'israeli_troll' },
  noob:    { default: 'noob',   he: 'israeli_noob' },
  veteran: { default: 'veteran' },
  critic:  { default: 'critic' },
  lurker:  { default: 'lurker' },
  spammer: { default: 'spammer' },
};

function getPersonaSource(personality: BasePersonality, lang: string): ViewerPersona | null {
  const typeMap = PERSONALITY_TO_TYPE[personality];
  const type = typeMap[lang] ?? typeMap.default;

  // Check viewer's language first
  const langPersonas = PERSONAS_BY_LANG[lang];
  if (langPersonas) {
    const found = langPersonas.find(p => p.type === type);
    if (found) return found;
  }

  // Fall back to English
  const enPersonas = PERSONAS_BY_LANG['en'];
  if (enPersonas) {
    const found = enPersonas.find(p => p.type === type);
    if (found) return found;
  }

  return null;
}

function hydrateReactions(viewer: SavedViewer): ViewerAgent {
  const source = getPersonaSource(viewer.personality, viewer.lang);
  const rank = computeRank(viewer.stats.watchMinutes);
  return {
    ...viewer,
    rank,
    badge: RANK_BADGES[rank],
    reactions: source?.reactions ?? {},
    idleMessages: source?.idleMessages ?? [],
    streamerReactions: source?.streamerReactions ?? [],
  };
}

// ═══ Name Generation ═══

const NAME_POOLS: Record<string, string[][]> = {
  en: [
    ['Code', 'Dev', 'Pixel', 'Byte', 'Stack', 'Git', 'Ship', 'Vibe', 'Hype', 'Based', 'Turbo', 'Mega', 'Night', 'Dark', 'Neo', 'Cloud', 'Bug', 'Script', 'Debug', 'Deploy', 'Merge', 'Push', 'Lint', 'Type', 'React', 'Node', 'Rust', 'Cargo', 'Hash', 'Loop', 'Parse', 'Async', 'Cache', 'Thread', 'Kernel', 'Socket', 'Lambda', 'Null', 'Void', 'True'],
    ['King', 'Lord', 'Master', 'Andy', 'Guy', 'Boss', 'Pro', 'Ninja', 'Wizard', 'Monk', 'Bear', 'Wolf', 'Fox', 'Hawk', 'Storm', 'Fire', 'Zen', 'Max', 'Prime', 'Chad', 'Chief', 'Duke', 'Legend', 'Hero', 'Sage', 'Ghost', 'Shadow', 'Blade', 'Frost', 'Spark', 'Coder', 'Watcher', 'Runner', 'Slayer', 'Hunter', 'Drifter', 'Rider'],
  ],
  he: [
    ['קודר', 'מתכנת', 'האקר', 'גיבור', 'אלוף', 'מלך', 'נינגה', 'צופה', 'בונה', 'שולח', 'דוחף', 'באגר', 'סטאקר', 'לופר', 'פרסר', 'מפתח', 'דבאגר', 'האש', 'ביט', 'בייט'],
    ['_הקוד', '_42', '_dev', '_il', '_pro', '_מאשדוד', '_מחיפה', '_מתא', '_מירו', '_מפתח', '_99', '_מהרצליה', '_מרעננה', '_מבאר_שבע', '_מנתניה', '_x', '_טק'],
  ],
  es: [
    ['El', 'Don', 'Crack', 'Pro', 'Super', 'Mega', 'Ultra', 'Rey', 'Jefe', 'Maestro', 'Code', 'Dev', 'Cyber', 'Turbo'],
    ['Coder', 'Dev', 'Hacker', 'Bug', 'Stack', 'Code', 'Script', 'Push', 'Deploy', 'Ninja', 'Master', 'Pro', 'King'],
  ],
  pt: [
    ['O', 'Mestre', 'Br', 'Mega', 'Super', 'Top', 'Rei', 'Chefe', 'Fera', 'Monstro', 'Code', 'Dev', 'Pro'],
    ['Dev', 'Coder', 'Hacker', 'Code', 'Stack', 'Bug', 'Deploy', 'Push', 'Script', '_br', '_dev', 'Ninja', 'Pro'],
  ],
  fr: [
    ['Le', 'Monsieur', 'Maitre', 'Super', 'Mega', 'Pro', 'Chef', 'Roi', 'Grand', 'Code', 'Dev', 'Cyber'],
    ['Dev', 'Codeur', 'Hacker', 'Code', 'Bug', 'Stack', 'Script', 'Deploy', 'Push', 'Ninja', 'Pro', 'Master'],
  ],
  de: [
    ['Der', 'Herr', 'Meister', 'Super', 'Mega', 'Pro', 'Chef', 'Code', 'Dev', 'Cyber', 'Turbo', 'Nacht'],
    ['Coder', 'Entwickler', 'Hacker', 'Code', 'Bug', 'Stack', 'Script', 'Deploy', 'Ninja', 'Pro', 'Meister'],
  ],
  ja: [
    ['コード', 'プロ', 'マスター', 'ハッカー', 'デバッグ', '職人', 'スタック', 'メガ', 'ウルトラ', 'ネオ', 'サイバー'],
    ['マン', '先生', '忍者', 'キング', '侍', '勇者', '魔王', '達人', '戦士', 'プロ'],
  ],
  ru: [
    ['Код', 'Про', 'Мастер', 'Хакер', 'Мега', 'Супер', 'Нео', 'Топ', 'Царь', 'Босс', 'Кибер', 'Дарк'],
    ['Кодер', 'Дев', 'Мэн', 'Гений', 'Воин', 'Маг', 'Ниндзя', 'Про', 'Мастер', 'Волк', 'Страж'],
  ],
  ar: [
    ['مبرمج', 'ملك', 'بطل', 'سيد', 'محترف', 'خبير', 'عبقري', 'نينجا', 'ماستر', 'كود', 'ديف'],
    ['_الكود', '_برو', '_ديف', '_42', '_99', '_دمشق', '_القاهرة', '_الرياض', '_نينجا', '_ماستر'],
  ],
};

const VIEWER_COLORS = [
  '#ff4444', '#ff6b6b', '#e94560', '#ff6b9d', '#ec4899',
  '#d946ef', '#a855f7', '#8b5cf6', '#7c3aed', '#6366f1',
  '#818cf8', '#60a5fa', '#38bdf8', '#22d3ee', '#06b6d4',
  '#14b8a6', '#10b981', '#34d399', '#4ade80', '#84cc16',
  '#a3e635', '#facc15', '#fbbf24', '#f59e0b', '#fb923c',
  '#f97316', '#ef4444', '#fca5a5', '#c084fc', '#67e8f9',
];

function generateName(lang: string, usedNames: Set<string>): string {
  const pools = NAME_POOLS[lang] ?? NAME_POOLS['en'];
  const prefixes = pools[0];
  const suffixes = pools[1];

  for (let attempt = 0; attempt < 30; attempt++) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const num = Math.random() < 0.35 ? String(Math.floor(Math.random() * 999)) : '';
    const needsSep = lang === 'en' || lang === 'es' || lang === 'pt' || lang === 'fr' || lang === 'de';
    const sep = needsSep && !suffix.startsWith('_') ? (Math.random() < 0.5 ? '_' : '') : '';
    const name = `${prefix}${sep}${suffix}${num}`;

    if (!usedNames.has(name) && name.length <= 20) {
      usedNames.add(name);
      return name;
    }
  }

  return `viewer${Date.now() % 10000}`;
}

// ═══ Profile Generation ═══

const PROFILE_BIOS: Record<BasePersonality, Record<string, string[]>> = {
  hype: {
    en: ['biggest fan in the chat', 'positive vibes only', 'here every stream no cap', 'W collector since day 1', 'if you ship it I hype it'],
    he: ['הצופה הכי נאמן', 'רק אנרגיה חיובית', 'פה כל סטרים', 'אספן ניצחונות'],
    es: ['el fan número uno', 'solo buenas vibras', 'siempre presente'],
    pt: ['maior fã do chat', 'só vibes positivas', 'sempre presente'],
    fr: ['le plus grand fan', 'bonnes vibes uniquement', 'toujours là'],
    de: ['größter Fan im Chat', 'nur positive Vibes', 'immer dabei'],
    ja: ['一番のファン', 'ポジティブだけ', '毎回来てる'],
    ru: ['самый преданный зритель', 'только позитив', 'каждый стрим тут'],
    ar: ['أكبر فان في الشات', 'طاقة إيجابية فقط', 'هنا كل بث'],
  },
  troll: {
    en: ['professional backseat dev', 'full time chat comedian', 'i roast because i care', 'trolling is an art form'],
    he: ['מפתח מושב אחורי', 'קומיקאי צאט במשרה מלאה', 'טרול מלידה', 'אומר את מה שכולם חושבים'],
    es: ['troll profesional', 'comediante del chat', 'el humor es mi pasión'],
    pt: ['troll profissional', 'comediante do chat', 'humor é minha vida'],
    fr: ['troll professionnel', 'comédien du chat', 'humour noir certifié'],
    de: ['professioneller Troll', 'Chat-Komiker', 'Sarkasmus ist Liebe'],
    ja: ['プロのトロール', 'チャットコメディアン', '草の達人'],
    ru: ['профессиональный тролль', 'комик чата', 'сарказм — моя жизнь'],
    ar: ['تروللر محترف', 'كوميديان الشات', 'الترولل فن'],
  },
  noob: {
    en: ['just started coding last week', 'everything is magic to me', 'watching to learn', 'one day ill be this good'],
    he: ['רק התחלתי ללמוד', 'הכל כל כך מגניב', 'צופה כדי ללמוד', 'יום אחד אני אהיה ככה'],
    es: ['empecé a programar la semana pasada', 'todo es magia', 'mirando para aprender'],
    pt: ['comecei semana passada', 'tudo é mágica', 'assistindo pra aprender'],
    fr: ['j\'ai commencé la semaine dernière', 'tout est magique', 'je regarde pour apprendre'],
    de: ['habe letzte Woche angefangen', 'alles ist Magie', 'schaue um zu lernen'],
    ja: ['先週始めたばかり', '全部すごい', '勉強のために見てる'],
    ru: ['начал на прошлой неделе', 'всё как магия', 'смотрю чтобы учиться'],
    ar: ['بديت الأسبوع الماضي', 'كل شي سحر', 'أتفرج عشان أتعلم'],
  },
  veteran: {
    en: ['been watching since the early days', 'OG viewer certified', 'seen every error arc', 'remember when chat had 5 people'],
    he: ['צופה מהימים הראשונים', 'OG מוסמך', 'ראיתי הכל', 'זוכר כשהיו 5 בצאט'],
  },
  critic: {
    en: ['10 years in the industry', 'code review is my cardio', 'high standards only', 'i see potential here'],
    he: ['10 שנים בהייטק', 'קוד ריוויו זה הספורט שלי', 'סטנדרטים גבוהים', 'רואה פוטנציאל'],
  },
  lurker: {
    en: ['...', 'mostly watching', 'speaks when necessary'],
    he: ['...', 'בעיקר צופה', 'מדבר כשצריך'],
  },
  spammer: {
    en: ['W', 'emote energy', 'less words more vibes'],
    he: ['W', 'רק אנרגיה', 'פחות מילים'],
  },
};

const PROFILE_LOCATIONS: Record<string, string[]> = {
  en: ['California', 'New York', 'Texas', 'London', 'Toronto', 'Sydney', 'Berlin', 'Seoul', 'Chicago', 'Miami', 'Portland', 'Austin', 'Seattle', 'Vancouver', 'Dublin', 'Amsterdam', 'Singapore', 'Denver', 'LA', 'Boston'],
  he: ['תל אביב', 'ירושלים', 'חיפה', 'רמת גן', 'הרצליה', 'באר שבע', 'אשדוד', 'ראשון', 'פתח תקווה', 'נתניה', 'רעננה', 'כפר סבא', 'חולון', 'מודיעין', 'אילת'],
  es: ['Madrid', 'Barcelona', 'México DF', 'Buenos Aires', 'Bogotá', 'Lima', 'Santiago', 'Medellín'],
  pt: ['São Paulo', 'Rio', 'Lisboa', 'Porto', 'Brasília', 'Curitiba', 'Floripa', 'BH'],
  fr: ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Montréal', 'Bruxelles', 'Genève', 'Toulouse'],
  de: ['Berlin', 'München', 'Hamburg', 'Frankfurt', 'Köln', 'Wien', 'Zürich', 'Stuttgart'],
  ja: ['東京', '大阪', '名古屋', '横浜', '札幌', '福岡', '京都', '神戸'],
  ru: ['Москва', 'Питер', 'Новосибирск', 'Екатеринбург', 'Казань', 'Минск', 'Киев'],
  ar: ['القاهرة', 'الرياض', 'دبي', 'بيروت', 'عمان', 'الدار البيضاء', 'جدة', 'أبوظبي'],
};

const AGE_RANGES: Record<BasePersonality, [number, number]> = {
  hype:    [16, 25],
  troll:   [19, 30],
  noob:    [14, 22],
  veteran: [24, 35],
  critic:  [28, 42],
  lurker:  [20, 38],
  spammer: [15, 22],
};

function generateProfile(personality: BasePersonality, lang: string): ViewerProfile {
  const [minAge, maxAge] = AGE_RANGES[personality];
  const age = minAge + Math.floor(Math.random() * (maxAge - minAge + 1));

  const locations = PROFILE_LOCATIONS[lang] ?? PROFILE_LOCATIONS['en'];
  const location = locations[Math.floor(Math.random() * locations.length)];

  const bios = PROFILE_BIOS[personality]?.[lang] ?? PROFILE_BIOS[personality]?.['en'] ?? ['viewer'];
  const bio = bios[Math.floor(Math.random() * bios.length)];

  return { age, location, bio };
}

// ═══ Viewer Generation ═══

function generateId(): string {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function generateViewer(
  personality: BasePersonality,
  lang: string,
  usedNames: Set<string>,
): ViewerAgent {
  const name = generateName(lang, usedNames);
  const color = VIEWER_COLORS[Math.floor(Math.random() * VIEWER_COLORS.length)];
  const profile = generateProfile(personality, lang);
  const now = new Date().toISOString();
  const source = getPersonaSource(personality, lang);

  return {
    id: generateId(),
    name,
    color,
    personality,
    lang,
    rank: 'newcomer',
    badge: '',
    profile,
    stats: {
      watchMinutes: 0,
      messageCount: 0,
      firstSeen: now,
      lastSeen: now,
      sessionsWatched: 1,
    },
    reactions: source?.reactions ?? {},
    idleMessages: source?.idleMessages ?? [],
    streamerReactions: source?.streamerReactions ?? [],
  };
}

// ═══ Roster Persistence ═══

const ROSTER_PATH = path.join(process.env.HOME ?? '/tmp', '.vibestream-viewers.json');
const MAX_ROSTER_SIZE = 50; // prune old viewers beyond this

function loadRoster(): SavedRoster {
  try {
    const data = fs.readFileSync(ROSTER_PATH, 'utf-8');
    return JSON.parse(data) as SavedRoster;
  } catch {
    return { version: 1, viewers: [] };
  }
}

function saveRoster(roster: SavedRoster): void {
  try {
    // Prune: keep most recent viewers by lastSeen
    const sorted = [...roster.viewers].sort(
      (a, b) => new Date(b.stats.lastSeen).getTime() - new Date(a.stats.lastSeen).getTime()
    );
    roster.viewers = sorted.slice(0, MAX_ROSTER_SIZE);
    fs.writeFileSync(ROSTER_PATH, JSON.stringify(roster, null, 2));
  } catch {
    // Silent fail
  }
}

// ═══ Session Management ═══

const SESSION_SIZE = { min: 6, max: 10 };
const NEW_VIEWERS = { min: 2, max: 4 };
const RETURN_RATE = 0.6;

const PERSONALITY_WEIGHTS: Array<{ p: BasePersonality; w: number }> = [
  { p: 'hype',    w: 25 },
  { p: 'troll',   w: 20 },
  { p: 'noob',    w: 15 },
  { p: 'veteran', w: 10 },
  { p: 'critic',  w: 10 },
  { p: 'lurker',  w: 10 },
  { p: 'spammer', w: 10 },
];

function weightedRandom(): BasePersonality {
  const total = PERSONALITY_WEIGHTS.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const { p, w } of PERSONALITY_WEIGHTS) {
    r -= w;
    if (r <= 0) return p;
  }
  return 'hype';
}

export interface RankUpEvent {
  viewer: ViewerAgent;
  oldRank: ViewerRank;
  newRank: ViewerRank;
}

export interface SessionResult {
  roster: ViewerAgent[];
  newViewers: ViewerAgent[];
  rankUps: RankUpEvent[];
}

export function createSessionRoster(lang: string): SessionResult {
  const saved = loadRoster();
  const usedNames = new Set<string>();
  const rankUps: RankUpEvent[] = [];

  // Returning viewers
  const returning: ViewerAgent[] = [];
  const candidates = saved.viewers.filter(v => v.lang === lang || v.lang === 'en');

  for (const sv of candidates) {
    if (Math.random() < RETURN_RATE) {
      usedNames.add(sv.name);
      const oldRank = computeRank(sv.stats.watchMinutes);
      // Returning viewers get credit for coming back
      const bonusMinutes = 5 + Math.floor(Math.random() * 10);
      const newMinutes = sv.stats.watchMinutes + bonusMinutes;
      const newRank = computeRank(newMinutes);

      const viewer = hydrateReactions({
        ...sv,
        stats: {
          ...sv.stats,
          watchMinutes: newMinutes,
          lastSeen: new Date().toISOString(),
          sessionsWatched: sv.stats.sessionsWatched + 1,
        },
      });
      returning.push(viewer);

      if (newRank !== oldRank) {
        rankUps.push({ viewer, oldRank, newRank });
      }
    }
  }

  // Generate new viewers
  const targetCount = SESSION_SIZE.min + Math.floor(Math.random() * (SESSION_SIZE.max - SESSION_SIZE.min + 1));
  const newCount = Math.max(
    NEW_VIEWERS.min,
    Math.min(NEW_VIEWERS.max, targetCount - returning.length)
  );

  const newLangs = lang === 'en' ? ['en'] : [lang, lang, 'en'];
  const newViewers: ViewerAgent[] = [];

  for (let i = 0; i < newCount; i++) {
    const viewerLang = newLangs[Math.floor(Math.random() * newLangs.length)];
    const personality = weightedRandom();
    newViewers.push(generateViewer(personality, viewerLang, usedNames));
  }

  const roster = [...returning, ...newViewers];

  // Persist all viewers
  const unchanged = saved.viewers.filter(v => !roster.some(r => r.id === v.id));
  saveRoster({
    version: 1,
    viewers: [
      ...unchanged,
      ...roster.map(toSavedViewer),
    ],
  });

  return { roster, newViewers, rankUps };
}

function toSavedViewer(v: ViewerAgent): SavedViewer {
  return {
    id: v.id,
    name: v.name,
    color: v.color,
    personality: v.personality,
    lang: v.lang,
    profile: v.profile,
    stats: v.stats,
  };
}

export function persistRoster(roster: ViewerAgent[]): void {
  const saved = loadRoster();
  const unchanged = saved.viewers.filter(v => !roster.some(r => r.id === v.id));
  saveRoster({
    version: 1,
    viewers: [...unchanged, ...roster.map(toSavedViewer)],
  });
}

// ═══ LLM Prompt Description ═══

const PERSONALITY_DESC: Record<BasePersonality, string> = {
  hype:    'Hyper-positive fan. Everything is amazing. Pure energy.',
  troll:   'Sarcastic troll. Backseat coding. Brutal but funny.',
  noob:    'Newbie viewer. Asks naive questions. Amazed by everything.',
  veteran: 'Day-1 viewer. References past streams. Inside jokes.',
  critic:  'Senior dev. High standards. Constructive feedback.',
  lurker:  'Silent watcher. Speaks rarely. One-word responses.',
  spammer: 'Emote spammer. Max 2 words. Pure energy.',
};

const RANK_DESC: Record<ViewerRank, string> = {
  newcomer: 'Brand new, first time here',
  regular:  'Shows up sometimes',
  fan:      'Loyal viewer, keeps coming back',
  sub:      'Subscriber — dedicated fan',
  vip:      'VIP — long-time supporter',
  og:       'OG — been here from the very start',
};

const PERSONALITY_EMOJI: Record<BasePersonality, string> = {
  hype:    '🔥',
  troll:   '🃏',
  noob:    '🌱',
  veteran: '🏆',
  critic:  '🔍',
  lurker:  '👻',
  spammer: '⚡',
};

export function describeSessionViewers(roster: ViewerAgent[]): string {
  const lines = roster.map(v => {
    const badge = v.badge ? ` [${v.badge}]` : '';
    const sessions = v.stats.sessionsWatched;
    const returning = sessions > 1
      ? ` (returning viewer, ${sessions} sessions, ${v.stats.watchMinutes} min watched)`
      : ' (NEW — first time here!)';
    return `@${v.name}${badge} — ${PERSONALITY_DESC[v.personality]} ${RANK_DESC[v.rank]}.${returning} Writes in: ${v.lang}`;
  });

  return `Viewers in chat — each is a unique living person with their own personality, rank, and history.
RULE: Each viewer writes ONLY in their language. No mixing. Not even one word.
New viewers are curious and excited. Returning viewers feel at home and reference past sessions.
Higher rank viewers (SUB/VIP/OG) are more confident and opinionated.

${lines.join('\n')}`;
}

// ═══ Utility ═══

export function pickRandom(roster: ViewerAgent[], count: number): ViewerAgent[] {
  const shuffled = [...roster].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function updateWatchTime(roster: ViewerAgent[], minutes: number): RankUpEvent[] {
  const rankUps: RankUpEvent[] = [];
  for (const viewer of roster) {
    const oldRank = viewer.rank;
    viewer.stats.watchMinutes += minutes;
    const newRank = computeRank(viewer.stats.watchMinutes);
    if (newRank !== oldRank) {
      viewer.rank = newRank;
      viewer.badge = RANK_BADGES[newRank];
      rankUps.push({ viewer, oldRank, newRank });
    }
  }
  return rankUps;
}

/** Profile data for the webview (serializable) */
export interface ViewerProfileData {
  name: string;
  color: string;
  personality: BasePersonality;
  personalityEmoji: string;
  rank: ViewerRank;
  badge: string;
  profile: ViewerProfile;
  watchMinutes: number;
  messageCount: number;
  sessionsWatched: number;
  firstSeen: string;
}

export function getViewerProfiles(roster: ViewerAgent[]): ViewerProfileData[] {
  return roster.map(v => ({
    name: v.name,
    color: v.color,
    personality: v.personality,
    personalityEmoji: PERSONALITY_EMOJI[v.personality],
    rank: v.rank,
    badge: v.badge,
    profile: v.profile,
    watchMinutes: v.stats.watchMinutes,
    messageCount: v.stats.messageCount,
    sessionsWatched: v.stats.sessionsWatched,
    firstSeen: v.stats.firstSeen,
  }));
}

/** Generate a random profile for unknown viewers (from LLM / instant pool) */
export function generateAnonymousProfile(name: string): ViewerProfileData {
  const personality = weightedRandom();
  const profile = generateProfile(personality, 'en');
  return {
    name,
    color: VIEWER_COLORS[Math.abs(hashStr(name)) % VIEWER_COLORS.length],
    personality,
    personalityEmoji: PERSONALITY_EMOJI[personality],
    rank: 'newcomer',
    badge: '',
    profile,
    watchMinutes: Math.floor(Math.random() * 30),
    messageCount: Math.floor(Math.random() * 50),
    sessionsWatched: 1,
    firstSeen: new Date().toISOString(),
  };
}

function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}

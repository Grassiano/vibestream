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
  occupation: string;
}

export interface ViewerDNA {
  flavor: string;
  quirks: string[];
  description: string; // Full character description for LLM
}

export interface ViewerAgent {
  id: string;
  name: string;
  color: string;
  personality: BasePersonality;
  lang: string;
  languages: string[];
  rank: ViewerRank;
  badge: string;
  profile: ViewerProfile;
  dna: ViewerDNA;
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
  languages: string[];
  profile: ViewerProfile;
  dna: ViewerDNA;
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
    dna: viewer.dna ?? { flavor: 'unknown', quirks: [], description: `${viewer.personality} viewer` },
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

// ═══ DNA System — Flavors, Quirks, Character Descriptions ═══

interface FlavorDef {
  flavor: string;
  occupation: string;
  bio: string;
  desc: string; // Character essence for LLM (English — LLM translates behavior)
}

const FLAVORS: Record<BasePersonality, FlavorDef[]> = {
  hype: [
    { flavor: 'startup_dreamer', occupation: 'wannabe founder', bio: 'building the next big thing (for 3 years)', desc: 'Thinks every project is a billion-dollar startup. Gets unreasonably excited about features. Keeps saying "this could be huge"' },
    { flavor: 'team_player', occupation: 'junior dev', bio: 'says "we" instead of "he"', desc: 'Always says "we" — "WE shipped it", "WE fixed the bug". Treats the stream like a team sport. Feels personally invested in every win and loss' },
    { flavor: 'emotional', occupation: 'designer', bio: 'gets emotional about clean code', desc: 'Gets genuinely emotional about code. "im literally crying rn". Beautiful code makes him happy, bugs make him sad. Wears heart on sleeve' },
    { flavor: 'caps_broken', occupation: 'student', bio: 'CAPS LOCK IS A LIFESTYLE', desc: 'Types EVERYTHING in caps. Pure unfiltered energy. No indoor voice. Every message is an explosion of excitement' },
    { flavor: 'first_timer', occupation: 'curious teen', bio: 'everything is new and amazing', desc: 'Comments on everything like its the first time seeing it. "wait you can just DO that??" Genuinely amazed by normal coding stuff' },
    { flavor: 'sports_fan', occupation: 'gamer', bio: 'treats coding like a sport', desc: 'Reacts like watching a football match. Commit = GOAAAL. Error = penalty. Push = championship winning goal. Uses sports metaphors for everything' },
  ],
  troll: [
    { flavor: 'backseat_coder', occupation: 'senior dev (allegedly)', bio: 'always knows better, never codes', desc: 'Always has a better way to do it. "should have used Rust btw". Never actually shows his own code. Armchair expert supreme' },
    { flavor: 'office_refugee', occupation: 'corporate dev', bio: 'watching at work, boss might catch him', desc: 'Clearly watching during work hours. Paranoid his boss will catch him. "shhh keep it down", "brb boss behind me", types in whispers' },
    { flavor: 'prophet', occupation: 'QA engineer', bio: 'predicted every bug, trust him', desc: 'Claims he predicted every single bug. "I SAID this would happen". Will "scroll up to prove it" but never can. Deadpan delivery' },
    { flavor: 'ancient_one', occupation: 'retired dev', bio: 'everything was better before', desc: 'Everything was better in the old days. "back in my day we wrote assembly". Complains about modern tools but keeps watching. Secretly impressed' },
    { flavor: 'chaos_gremlin', occupation: 'script kiddie', bio: 'wants to watch the world burn', desc: 'Just wants to see things break. "delete node_modules and pray". Suggests the worst possible solutions. Celebrates errors. Pure chaos energy' },
    { flavor: 'competitor', occupation: 'indie dev', bio: 'also codes, lowkey jealous', desc: 'Also a developer, slightly competitive. "my version handles this better but ok". Humble brags about his own projects. Jealous but wont admit it' },
  ],
  noob: [
    { flavor: 'mind_blown', occupation: 'student', bio: 'cant believe AI coding exists', desc: 'Cannot believe AI can write code. Every Claude interaction blows his mind. "WAIT HE JUST TALKS TO IT??" Uses lots of ?? and !!' },
    { flavor: 'pretender', occupation: 'bootcamp student', bio: 'pretends to understand everything', desc: 'Nods along and pretends to understand. "yeah yeah obviously, standard practice" then whispers "(what is happening)". Never admits confusion directly' },
    { flavor: 'question_machine', occupation: 'self-taught beginner', bio: 'asks questions nobody answers', desc: 'Asks basic questions constantly. "whats a git?" "why is it red?" Questions often go unanswered and he asks again. Persistent and innocent' },
    { flavor: 'wholesome', occupation: 'high school student', bio: 'just happy to be here', desc: 'Doesnt understand anything but having the time of his life. "I have no idea whats happening but this is great". Pure positivity, zero knowledge' },
    { flavor: 'note_taker', occupation: 'CS freshman', bio: 'treating this stream like a lecture', desc: 'Treats the stream like a university lecture. "wait slow down im writing this down". Asks for the streamer to repeat things. Takes everything very seriously' },
  ],
  veteran: [
    { flavor: 'war_stories', occupation: 'tech lead', bio: 'references past sessions constantly', desc: 'References past streams like war stories. "remember the great database crash of session 12?" Has been here since the beginning and wont let you forget it' },
    { flavor: 'dad_energy', occupation: 'engineering manager', bio: 'supportive but slightly embarrassing', desc: 'Supportive like a proud dad. "thats my boy!" "so proud of you champ". Slightly embarrassing but genuinely caring. Tells other viewers to be nice' },
    { flavor: 'silent_judge', occupation: 'principal engineer', bio: 'rarely speaks, but when he does it hits', desc: 'Speaks maybe once every 5 minutes. But when he does, everyone listens. Short devastating observations. "...not bad." or "hmm." Respected by all' },
    { flavor: 'historian', occupation: 'data analyst', bio: 'keeps track of stream stats', desc: 'Tracks everything. "thats his 47th commit this month". Knows exact stats, session counts, error rates. The unofficial stream statistician' },
  ],
  critic: [
    { flavor: 'pr_reviewer', occupation: 'staff engineer', bio: 'reviews code like its a PR', desc: 'Talks like hes reviewing a pull request. "nit: that prompt could be shorter". Uses code review terminology in casual chat. Professional but funny' },
    { flavor: 'minimalist', occupation: 'architect', bio: 'less is more, always', desc: 'Everything is too much. Too many words, too many files, too many lines. "just say fix bug". Worships simplicity. Pained by complexity' },
    { flavor: 'actually_guy', occupation: 'senior dev', bio: 'well actually...', desc: 'Starts every message with "well actually" or "technically". Has to correct everything. Not mean about it but compulsive. "technically thats not a bug its undefined behavior"' },
  ],
  lurker: [
    { flavor: 'ghost', occupation: 'unknown', bio: '...', desc: 'Almost never speaks. When he does its 1-2 words max. "nice" or "hmm" or just an emote. But has been watching for hours. Mysterious presence' },
    { flavor: 'night_owl', occupation: 'freelancer', bio: 'always watching at 3am', desc: 'Its always the middle of the night wherever he is. "its 4am and im watching someone code, what is my life". Tired energy but cant stop watching' },
    { flavor: 'shy_one', occupation: 'intern', bio: 'wants to chat but too shy', desc: 'Types messages and deletes them. When he finally speaks its very carefully worded and overly polite. Gets flustered when the streamer responds to him' },
  ],
  spammer: [
    { flavor: 'emote_only', occupation: 'twitch native', bio: 'speaks only in emotes', desc: 'Communicates exclusively through emotes and emote words. PogChamp KEKW monkaS. Never uses actual sentences. Pure emote expression' },
    { flavor: 'one_word', occupation: 'minimalist zoomer', bio: 'one word per message, always', desc: 'Only says single words. "nice" "based" "W" "cope" "true" "real" "mid". Never more than one word. Its a lifestyle' },
    { flavor: 'copypasta', occupation: 'chat regular', bio: 'copies whatever was just said', desc: 'Copies the previous viewers message or a variation of it. Starts chains. If someone says "LETS GO" he says "LETS GO". The human echo' },
  ],
};

// Quirks — random behavioral traits any viewer can get
const QUIRK_POOL = [
  'mentions his side project every few messages ("my project also has this...")',
  'types on his phone, lots of typos and autocorrect fails',
  'always disagrees with whoever spoke last, on principle',
  'brags about his setup ("typing from my ultrawide btw")',
  'uses old internet slang unironically ("epic win", "for the win", "lulz")',
  'takes everything the streamer says literally',
  'replies to everything with a follow-up question',
  'thinks everything is a reference to something else ("is that a JoJo reference?")',
  'clearly eating while watching, mentions food randomly',
  'sends messages in parts, never finishes a thought in one message ("wait..." "nvm" "actually...")',
  'always arrives late and asks "what did I miss"',
  'keeps trying to get the streamer to play a game instead of coding',
  'responds to errors with conspiracy theories about the compiler',
  'uses way too many emojis in every single message',
  'quotes movies/shows to describe what is happening on stream',
  'claims to know the streamer IRL (he doesnt)',
  'keeps accidentally revealing personal info then deleting it',
  'narrates what the streamer is doing like a sports commentator',
];

function pickFlavor(personality: BasePersonality): FlavorDef {
  const pool = FLAVORS[personality];
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickQuirks(count: number): string[] {
  const shuffled = [...QUIRK_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateDNA(personality: BasePersonality, profile: ViewerProfile, lang: string): ViewerDNA {
  const flavorDef = pickFlavor(personality);
  const quirks = pickQuirks(Math.random() < 0.6 ? 1 : 2);

  profile.occupation = flavorDef.occupation;
  profile.bio = flavorDef.bio;

  const langLabel = LANG_NAMES[lang] ?? lang;
  const quirkLines = quirks.map(q => `Quirk: ${q}`).join('. ');

  const description = `${profile.age}yo ${flavorDef.occupation} from ${profile.location}. ${flavorDef.desc}. ${quirkLines}. Writes in: ${langLabel} only.`;

  return {
    flavor: flavorDef.flavor,
    quirks,
    description,
  };
}

const LANG_NAMES: Record<string, string> = {
  en: 'English', he: 'Hebrew', es: 'Spanish', pt: 'Portuguese',
  fr: 'French', de: 'German', ja: 'Japanese', ru: 'Russian', ar: 'Arabic',
};

function generateProfile(personality: BasePersonality, lang: string): ViewerProfile {
  const [minAge, maxAge] = AGE_RANGES[personality];
  const age = minAge + Math.floor(Math.random() * (maxAge - minAge + 1));

  const locations = PROFILE_LOCATIONS[lang] ?? PROFILE_LOCATIONS['en'];
  const location = locations[Math.floor(Math.random() * locations.length)];

  // Bio and occupation will be overwritten by generateDNA()
  return { age, location, bio: '', occupation: '' };
}

// ═══ Viewer Generation ═══

function generateId(): string {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// Generate languages array — what this viewer speaks
function generateLanguages(lang: string): string[] {
  if (lang === 'en') return ['en'];
  // Most non-English speakers also know some English (70% chance)
  return Math.random() < 0.7 ? [lang, 'en'] : [lang];
}

export function generateViewer(
  personality: BasePersonality,
  lang: string,
  usedNames: Set<string>,
): ViewerAgent {
  const name = generateName(lang, usedNames);
  const color = VIEWER_COLORS[Math.floor(Math.random() * VIEWER_COLORS.length)];
  const profile = generateProfile(personality, lang);
  const dna = generateDNA(personality, profile, lang);
  const now = new Date().toISOString();
  const source = getPersonaSource(personality, lang);
  const languages = generateLanguages(lang);

  return {
    id: generateId(),
    name,
    color,
    personality,
    lang,
    languages,
    rank: 'newcomer',
    badge: '',
    profile,
    dna,
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

  // Language distribution: ~90% stream language, rare international
  // 70% = 0 international, 25% = 1, 5% = 2
  const internationalRoll = Math.random();
  const internationalCount = internationalRoll < 0.70 ? 0 : internationalRoll < 0.95 ? 1 : 2;

  const newViewers: ViewerAgent[] = [];

  for (let i = 0; i < newCount; i++) {
    const isInternational = lang !== 'en' && i < internationalCount;
    const viewerLang = isInternational ? 'en' : lang;
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
    languages: v.languages,
    profile: v.profile,
    dna: v.dna,
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
      ? ` (returning, ${sessions} sessions)`
      : ' (NEW — first time!)';
    const isInternational = v.lang !== roster[0]?.lang;
    const intlNote = isInternational ? ' [INTERNATIONAL — does NOT understand stream language. Reacts to code/energy/emotes only.]' : '';

    // Use full DNA description instead of generic personality label
    return `@${v.name}${badge}${returning} — ${v.dna.description}${intlNote}`;
  });

  const streamLang = roster[0]?.lang ?? 'en';
  const streamLangName = LANG_NAMES[streamLang] ?? streamLang;

  return `This is a ${streamLangName}-language stream.

Each viewer below is a unique CHARACTER with their own personality, voice, and quirks. They are NOT code reviewers — they are FANS watching a vibe coding stream. Think Twitch chat energy.

EVERY viewer must feel DIFFERENT from every other viewer. Their DNA describes who they are — follow it closely.

RULES:
- Each viewer writes ONLY in their language. No mixing.
- "PogChamp", "KEKW", "W", "GG" are universal emotes — fine in any language.
- International viewers react to code/energy only, not conversation content.
- Short messages (1-8 words). This is chat, not a forum.

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
  languages: string[];
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
    languages: v.languages,
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
  const dna = generateDNA(personality, profile, 'en');
  return {
    name,
    color: VIEWER_COLORS[Math.abs(hashStr(name)) % VIEWER_COLORS.length],
    personality,
    personalityEmoji: PERSONALITY_EMOJI[personality],
    rank: 'newcomer',
    badge: '',
    profile,
    languages: ['en'],
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

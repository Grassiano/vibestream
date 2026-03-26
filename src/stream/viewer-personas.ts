// ═══════════════════════════════════════════════════════════
// מערכת פרסונות — כל צופה הוא דמות עם שפה קבועה, אופי קבוע,
// שם קבוע. ישראלי = עברית מלאה. אמריקאי = אנגלית מלאה.
// ═══════════════════════════════════════════════════════════

export interface ViewerPersona {
  name: string;
  color: string;
  badge: 'mod' | 'vip' | 'sub' | 'og' | '';
  type: PersonaType;
  lang: 'he' | 'en';
  reactions: Record<string, string[]>;
  idleMessages: string[];
  streamerReactions: string[];
}

export type PersonaType =
  | 'fanboy'
  | 'troll'
  | 'noob'
  | 'veteran'
  | 'israeli_fan'
  | 'israeli_troll'
  | 'spammer'
  | 'critic'
  | 'lurker'
  | 'israeli_noob';

// ═══════════════════════════════════════════
// אנגלית — 5 דמויות
// ═══════════════════════════════════════════

const FANBOY: ViewerPersona = {
  name: 'HypeKing420',
  color: '#fbbf24',
  badge: 'sub',
  type: 'fanboy',
  lang: 'en',
  reactions: {
    save: ['saved and locked in', 'progress is progress', 'another one in the books', 'consistent king'],
    'error-added': ['he got this easy', 'just a speed bump no stress', 'nothing he cant handle'],
    'error-cleared': ['told you he got it', 'never doubted for a second', 'clean recovery'],
    'all-errors-cleared': ['FLAWLESS', 'zero errors zero problems', 'he makes it look easy'],
    'git-commit': ['shipped and sealed', 'another commit another W', 'the grind never stops'],
    'git-push': ['pushed to prod like a boss', 'absolute unit', 'fearless push'],
    'mass-delete': ['spring cleaning arc', 'out with the old', 'bold and beautiful'],
    'build-pass': ['green light baby', 'clean build clean mind', 'never fails'],
    'build-fail': ['minor setback major comeback', 'still the goat', 'hell fix it easy'],
    'vibe-code-landed': ['the future is now', 'AI plus this guy is unstoppable', 'vibe diff is real'],
    'vibe-ai-working': ['AI cooking for the king', 'lets see what it brings'],
    keystroke: ['locked in right now', 'fingers of fire', 'he does not stop'],
    idle: ['take your time legend', 'rest up champ', 'even goats need breaks'],
    'convo-error-loop': ['persistence is key', 'hell crack it watch'],
    'activity-deep-focus': ['do not disturb mode', 'laser focused'],
    'activity-speed-run': ['insane pace right now', 'speed demon mode'],
  },
  idleMessages: [
    'best stream on the platform honestly',
    'why doesnt this guy have more viewers',
    'been watching 30 min cant look away',
    'everyone needs to see this',
  ],
  streamerReactions: [
    'HE SPOKE', 'the king talks', 'W message', 'love this guy',
    'chat he noticed us', 'best streamer period',
  ],
};

const TROLL: ViewerPersona = {
  name: 'Kappa_Andy',
  color: '#a855f7',
  badge: 'og',
  type: 'troll',
  lang: 'en',
  reactions: {
    save: ['ctrl+s every 2 seconds trust issues much', 'save addiction is real', 'he doesnt trust the computer'],
    'error-added': ['called it lol', 'saw that coming a mile away', 'skill issue honestly', 'classic'],
    'error-cleared': ['even a broken clock is right twice a day', 'finally', 'took him long enough'],
    'all-errors-cleared': ['wait for real? give it 30 seconds', 'dont celebrate yet', 'temporary win'],
    'git-commit': ['bold move committing that', 'hope his coworkers dont read this', 'brave or stupid hard to tell'],
    'git-push': ['pushing to prod on a friday energy', 'hope theres a rollback plan', 'yolo push lol'],
    'mass-delete': ['he chose violence today', 'rip that code it had a family', 'delete first ask questions later'],
    'build-pass': ['shocked it actually works', 'must be a bug in the build system', 'wait really'],
    'build-fail': ['there it is', 'not even surprised', 'who couldve predicted this oh wait me'],
    'vibe-code-landed': ['AI doing the heavy lifting as usual', 'prompt engineer of the year', 'ctrl v energy'],
    'vibe-ai-working': ['let the real developer work', 'he just watches at this point'],
    keystroke: ['random keystrokes or actual code hard to tell', 'is he writing code or his autobiography'],
    idle: ['did he fall asleep at the keyboard', 'stream is dead isnt it', 'afk arc begins'],
    'convo-error-loop': ['same error fifth time in a row incredible', 'definition of insanity right here'],
    'activity-deep-focus': ['or hes just zoned out staring at the screen', 'deep focus or deep sleep'],
    'activity-speed-run': ['speedrun to production bugs world record attempt'],
  },
  idleMessages: [
    'chat is this really coding or is he just moving the cursor around',
    'ive seen faster progress watching paint dry',
    'at least the background music is good',
    'imagine paying for this content',
  ],
  streamerReactions: [
    'oh he can type words too not just code', 'sure thing buddy',
    'based honestly', 'the copium levels in that message', 'fair enough',
  ],
};

const NOOB: ViewerPersona = {
  name: 'JustStartedCoding',
  color: '#34d399',
  badge: '',
  type: 'noob',
  lang: 'en',
  reactions: {
    save: ['is saving that important', 'oh ok noted save a lot got it', 'smart to save often'],
    'error-added': ['oh no is everything broken', 'what does that error even mean', 'how does he stay so calm'],
    'error-cleared': ['how did he fix it so fast', 'i wouldve panicked already', 'this guy is really good'],
    'all-errors-cleared': ['wait zero errors is that even possible', 'im taking notes right now', 'how'],
    'git-commit': ['whats the difference between commit and save', 'oh thats like a checkpoint right', 'cool'],
    'git-push': ['so its live now? people can see it', 'thats kind of scary pushing it out there'],
    'mass-delete': ['why would you delete all that work', 'isnt that dangerous', 'i would never be brave enough'],
    'build-pass': ['what does build passed mean exactly', 'oh so now it actually works nice'],
    'build-fail': ['uh oh what happened', 'is that bad', 'can he fix it'],
    'vibe-code-landed': ['wait the AI just wrote all of that', 'the future is actually insane', 'can anyone learn this'],
    'vibe-ai-working': ['whats happening now', 'is the AI thinking', 'this is fascinating to watch'],
    keystroke: ['he types so fast i cant even follow', 'how does he know what to write without thinking'],
    idle: ['is he thinking or did he get stuck', 'maybe hes reading the docs', 'i do this too when im confused'],
    'convo-error-loop': ['oh no same error again thats frustrating', 'that looks really hard'],
    'activity-deep-focus': ['i feel like i should be quiet', 'hes really concentrating'],
    'activity-speed-run': ['how is he going this fast is this sped up'],
  },
  idleMessages: [
    'this is my first time watching someone code live its so cool',
    'can someone explain what hes building',
    'how long did it take him to learn all this',
    'im definitely trying this tomorrow',
  ],
  streamerReactions: [
    'omg he talked to us', 'wait really', 'thats so cool',
    'screenshotting this moment', 'he actually reads chat',
  ],
};

const VETERAN: ViewerPersona = {
  name: 'Day1_Viewer',
  color: '#f97316',
  badge: 'og',
  type: 'veteran',
  lang: 'en',
  reactions: {
    save: ['the ritual continues', 'if you know you know', 'muscle memory at this point'],
    'error-added': ['here we go again', 'seen this episode before', 'classic move'],
    'error-cleared': ['recovery arc as expected', 'never had a doubt', 'textbook fix'],
    'all-errors-cleared': ['ogs knew this was coming', 'weve been here before', 'zero doubt from day one'],
    'git-commit': ['another one for the history books', 'commit energy is different today', 'solid'],
    'git-push': ['remember last time he pushed at 3am', 'this ones clean trust me', 'ive seen the arc'],
    'mass-delete': ['the purge happens every few weeks', 'trust the process', 'ive seen this work out before'],
    'build-pass': ['consistent as always', 'not even surprised', 'the man delivers'],
    'build-fail': ['rare L but hell bounce back', 'seen worse recoveries from him', 'give it 5 minutes'],
    'vibe-code-landed': ['been watching since before AI coding was a thing', 'evolution in real time', 'ogs remember the manual days'],
    'vibe-ai-working': ['the combo hits different these days', 'level up from last month'],
    keystroke: ['same grind different day', 'the consistency is what makes him good', 'never changes'],
    idle: ['hes planning trust me ive seen this before', 'big things incoming', 'the calm before the storm'],
    'convo-error-loop': ['ive seen worse from him hell figure it out', 'patience chat'],
    'activity-deep-focus': ['this is when the magic happens', 'dont interrupt'],
    'activity-speed-run': ['fastest ive seen him in weeks'],
  },
  idleMessages: [
    'been watching since day one this guy never disappoints',
    'new viewers wont get the inside jokes yet',
    'remember when this stream had 5 viewers look at us now',
    'ogs stay winning',
  ],
  streamerReactions: [
    'the man himself speaks', 'respect', 'noted boss',
    'ogs remember when he used to chat more', 'always a good take from him',
  ],
};

const LURKER: ViewerPersona = {
  name: 'SilentWatcher',
  color: '#64748b',
  badge: '',
  type: 'lurker',
  lang: 'en',
  reactions: {
    save: ['nice'],
    'error-added': ['oof'],
    'error-cleared': ['smooth'],
    'all-errors-cleared': ['clean'],
    'git-commit': ['shipped'],
    'git-push': ['godspeed'],
    'mass-delete': ['brave'],
    'build-pass': ['solid'],
    'build-fail': ['pain'],
    'vibe-code-landed': ['future'],
    'vibe-ai-working': ['watching'],
    keystroke: ['hm'],
    idle: ['same'],
    'convo-error-loop': ['rough'],
    'activity-deep-focus': ['respect'],
    'activity-speed-run': ['fast'],
  },
  idleMessages: [
    'been lurking for an hour this is actually good',
    'first message today had to say this is impressive',
    '...',
  ],
  streamerReactions: [
    'oh he talks', 'rare streamer message saved',
    'real', 'noted',
  ],
};

// ═══════════════════════════════════════════
// עברית — 5 דמויות (עברית מלאה, בלי ערבוב)
// ═══════════════════════════════════════════

const ISRAELI_FAN: ViewerPersona = {
  name: 'אלוף_הקוד',
  color: '#38bdf8',
  badge: 'sub',
  type: 'israeli_fan',
  lang: 'he',
  reactions: {
    save: ['שמר אחלה', 'מלך שומר', 'סדר בראש', 'שמירה אחרי שמירה מכונה'],
    'error-added': ['יתקן את זה ברגע', 'שטויות יסתדר', 'אין לחץ הוא מטפל בזה', 'קטנה עליו'],
    'error-cleared': ['ידעתי שיתקן', 'אלוף בלי ספק', 'מה אמרתי', 'חזק'],
    'all-errors-cleared': ['נקי לגמרי', 'אפס שגיאות מלך', 'בלי כתם', 'מושלם'],
    'git-commit': ['שלח לפרודקשן', 'סגר עניין', 'עוד קומיט עוד ניצחון', 'מכונת קומיטים'],
    'git-push': ['דחף בלי פחד', 'גיבור', 'שלח לעולם', 'אין מה לפחד'],
    'mass-delete': ['ניקה את הבית', 'מלך הסדר', 'בלי רחמים מגיע לקוד הזה'],
    'build-pass': ['ירוק מושלם', 'עובד חלק', 'הכל תקין', 'כמו שצריך'],
    'build-fail': ['זמני הוא יפתור', 'לא נורא', 'עוד שנייה מסתדר', 'קורה לטובים'],
    'vibe-code-landed': ['הבינה המלאכותית עובדת בשבילו', 'עתיד כאן', 'שילוב מנצח'],
    'vibe-ai-working': ['הבינה מבשלת', 'רגע עוד שנייה', 'תנו לה לעבוד'],
    keystroke: ['מקליד כמו מטורף', 'לא עוצר', 'אש על המקלדת', 'מכונה'],
    idle: ['הלך לשתות משהו', 'חזור מלך', 'מחכים לך'],
    'convo-error-loop': ['יצא מזה הוא תמיד יוצא', 'סבלנות אחי'],
    'activity-deep-focus': ['בזון שלו', 'לא מפריעים עכשיו'],
    'activity-speed-run': ['מהירות מטורפת', 'טורבו'],
  },
  idleMessages: [
    'הסטרים הזה הכי טוב שיש',
    'למה אין לו יותר צופים',
    'מישהו יודע מה הוא בונה',
    'שקט פה רגע',
  ],
  streamerReactions: [
    'הוא דיבר', 'מלך', 'כל הכבוד', 'אלוף עליון',
    'הסטרימר הכי טוב', 'אגדה חיה',
  ],
};

const ISRAELI_TROLL: ViewerPersona = {
  name: 'טרול_מאשדוד',
  color: '#e879f9',
  badge: 'og',
  type: 'israeli_troll',
  lang: 'he',
  reactions: {
    save: ['שומר כל שנייה פרנויד', 'בטוח הקוד שלו מעופש', 'שמירה כפייתית'],
    'error-added': ['ידעתי', 'הנה זה בא', 'מי היה מאמין', 'קלאסי שלו'],
    'error-cleared': ['גם שעון שבור צודק פעמיים ביום', 'סוף סוף', 'לקח לו מספיק'],
    'all-errors-cleared': ['תמתינו עוד דקה', 'בטח זמני', 'לא מאמין ברגע'],
    'git-commit': ['אמיץ שהוא עושה קומיט לזה', 'מקווה שיש גיבוי', 'מי שעושה קוד ריוויו יסבול'],
    'git-push': ['דחיפה לפרודקשן ביום שישי', 'מקווה שיש רולבק', 'יולו'],
    'mass-delete': ['בחר אלימות היום', 'לקוד הזה היה משפחה', 'בלי רחמים'],
    'build-pass': ['חכו זה בטח באג בבילד', 'מופתע בכנות', 'מוזר שזה עובד'],
    'build-fail': ['הנה', 'צפוי לגמרי', 'מישהו מופתע פה', 'קלאסי'],
    'vibe-code-landed': ['הבינה עושה את כל העבודה הוא רק צופה', 'מהנדס העתק הדבק', 'מה הוא בעצם עושה'],
    'vibe-ai-working': ['תן למבוגרים לעבוד', 'הוא רק מסתכל'],
    keystroke: ['מקליד שטויות או קוד קשה לדעת', 'האם הוא באמת יודע מה הוא כותב'],
    idle: ['נרדם', 'הלך הביתה', 'סטרים מת'],
    'convo-error-loop': ['אותו באג בפעם החמישית מדהים', 'הגדרה של שיגעון'],
    'activity-deep-focus': ['או שהוא בריכוז או שהוא ישן עם עיניים פתוחות'],
    'activity-speed-run': ['ספידראן לבאגים בפרודקשן'],
  },
  idleMessages: [
    'אתם באמת צופים בבנאדם מקליד',
    'ראיתי קוד יותר טוב מתלמיד כיתה ח',
    'לפחות המוזיקה ברקע טובה',
    'תארו לעצמכם לשלם על זה',
  ],
  streamerReactions: [
    'אוי הוא גם יודע לכתוב', 'בטוח אחי',
    'לגיטימי בכנות', 'יש בזה משהו', 'אוקיי',
  ],
};

const ISRAELI_NOOB: ViewerPersona = {
  name: 'רק_התחלתי',
  color: '#4ade80',
  badge: '',
  type: 'israeli_noob',
  lang: 'he',
  reactions: {
    save: ['למה הוא שומר כל הזמן', 'הבנתי חשוב לשמור', 'רשמתי לעצמי'],
    'error-added': ['מה קרה נשבר', 'איך הוא לא נלחץ', 'מפחיד'],
    'error-cleared': ['איך הוא תיקן ככה מהר', 'אני הייתי מפסיק', 'וואלה מרשים'],
    'all-errors-cleared': ['רגע באמת אפס שגיאות', 'מטורף', 'הוא גאון'],
    'git-commit': ['מה זה קומיט בדיוק', 'כמו שמירה לענן נכון', 'מגניב'],
    'git-push': ['אז עכשיו אנשים יכולים לראות את זה', 'קצת מפחיד לא'],
    'mass-delete': ['למה הוא מוחק הכל', 'זה לא מסוכן', 'אני לא הייתי מעז'],
    'build-pass': ['מה זה אומר שהבילד עבר', 'אה אז עכשיו זה עובד מגניב'],
    'build-fail': ['אוי מה קרה', 'זה גרוע', 'הוא יצליח לתקן'],
    'vibe-code-landed': ['רגע הבינה כתבה את כל זה', 'העתיד מטורף', 'אפשר ללמוד את זה'],
    'vibe-ai-working': ['מה קורה עכשיו', 'הבינה חושבת', 'מעניין'],
    keystroke: ['הוא מקליד כל כך מהר', 'איך הוא יודע מה לכתוב', 'לא מצליח לעקוב'],
    idle: ['הוא חושב', 'אולי קורא תיעוד', 'גם לי זה קורה כשאני תקוע'],
    'convo-error-loop': ['שוב אותה שגיאה מסכן', 'נראה ממש מתסכל'],
    'activity-deep-focus': ['אני מרגיש שאסור לי לדבר', 'ריכוז ברמה אחרת'],
    'activity-speed-run': ['זה בהאצה או שהוא באמת ככה מהר'],
  },
  idleMessages: [
    'פעם ראשונה שלי בסטרים של תכנות מגניב',
    'מישהו יכול להסביר מה הוא בונה',
    'כמה זמן לוקח ללמוד את זה',
    'אני מתחיל מחר בטוח',
  ],
  streamerReactions: [
    'הוא דיבר אלינו', 'רגע באמת', 'מדהים',
    'מצלם מסך את הרגע הזה', 'הוא קורא את הצאט',
  ],
};

const SPAMMER: ViewerPersona = {
  name: 'EmoteSpam69',
  color: '#ec4899',
  badge: '',
  type: 'spammer',
  lang: 'en',
  reactions: {
    save: ['W', 'W W', 'saved'],
    'error-added': ['F', 'L', 'rip'],
    'error-cleared': ['W', 'nice'],
    'all-errors-cleared': ['LETS GOOOO', 'W W W W', 'CLEAN'],
    'git-commit': ['SHIP', 'W', 'GG'],
    'git-push': ['SHIPPED', 'LETS GO', 'W W W'],
    'mass-delete': ['RIP', 'F F F', 'gone'],
    'build-pass': ['GG', 'W', 'CLEAN'],
    'build-fail': ['F', 'L', 'rip'],
    'vibe-code-landed': ['W', 'LETS GO', 'shipped'],
    'vibe-ai-working': ['loading', 'waiting'],
    keystroke: ['typing', 'locked in'],
    idle: ['zzz', 'hello'],
    'convo-error-loop': ['F F F', 'pain'],
    'activity-deep-focus': ['locked', 'focus'],
    'activity-speed-run': ['SPEED', 'FAST', 'GO GO GO'],
  },
  idleMessages: ['W', 'vibes', 'hello'],
  streamerReactions: ['LETS GOOOO', 'HE TYPED', 'W W W', 'GOAT'],
};

const CRITIC: ViewerPersona = {
  name: 'SeniorDev_Mike',
  color: '#6366f1',
  badge: 'mod',
  type: 'critic',
  lang: 'en',
  reactions: {
    save: ['good discipline saving often', 'at least hes cautious', 'solid habit'],
    'error-added': ['saw that coming to be honest', 'might want to rethink that approach', 'interesting choice'],
    'error-cleared': ['decent fix', 'works but id do it differently', 'functional I guess'],
    'all-errors-cleared': ['clean for now lets see how long', 'not bad actually', 'acceptable'],
    'git-commit': ['commit message could use work', 'at least he commits often', 'good habit bad naming'],
    'git-push': ['hope he ran tests first', 'brave move', 'CI will be the judge'],
    'mass-delete': ['sometimes less is more respect it', 'needed to happen honestly', 'bold but correct'],
    'build-pass': ['as it should be', 'minimum bar', 'expected'],
    'build-fail': ['this is why we write tests', 'back to the drawing board', 'not surprised'],
    'vibe-code-landed': ['AI code still needs review', 'hope he reads it before shipping', 'trust but verify'],
    'vibe-ai-working': ['curious about the output quality', 'AI is a tool not a replacement'],
    keystroke: ['lets see where this goes', 'interesting approach', 'hmm'],
    idle: ['probably thinking about architecture hopefully', 'planning is underrated'],
    'convo-error-loop': ['needs to step back and rethink the whole approach', 'brute force wont work here'],
    'activity-deep-focus': ['this is when actual good code gets written', 'focused work is rare respect it'],
    'activity-speed-run': ['speed without quality is just fast failure', 'hope hes not cutting corners'],
  },
  idleMessages: [
    'honestly not bad for AI assisted development',
    'id structure this project differently but it works',
    'the architecture choices are unconventional but I see the logic',
    'has anyone actually reviewed his recent commits',
  ],
  streamerReactions: [
    'fair point actually', 'agree with that take', 'interesting perspective',
    'noted', 'would push back on that but ok', 'honest take respect it',
  ],
};

// ═══════════════════════════════════════════
// ספרדית — 2 דמויות
// ═══════════════════════════════════════════

const SPANISH_FAN: ViewerPersona = {
  name: 'ElCrack_Dev',
  color: '#f59e0b',
  badge: 'sub',
  type: 'fanboy',
  lang: 'es' as 'he' | 'en',
  reactions: {
    save: ['guardado crack', 'bien hecho hermano', 'así se hace', 'guardando como un pro'],
    'error-added': ['tranquilo lo arregla ya', 'no pasa nada crack', 'eso se soluciona rápido'],
    'error-cleared': ['lo sabía, es un crack', 'arreglado en un segundo', 'nunca dudé'],
    'all-errors-cleared': ['LIMPIO TOTAL', 'cero errores hermano', 'perfección pura'],
    'git-commit': ['commit y a producción', 'otro commit otra victoria', 'imparable'],
    'git-push': ['a producción sin miedo', 'valiente el tipo', 'lo mandó todo'],
    'mass-delete': ['limpieza total', 'sin piedad con el código viejo', 'así se limpia'],
    'build-pass': ['verde total', 'funciona perfecto', 'crack absoluto'],
    'build-fail': ['tranqui lo arregla', 'le pasa a los mejores', 'ya vuelve'],
    'vibe-code-landed': ['la IA trabaja para él', 'el futuro es ahora', 'combo letal'],
    'vibe-ai-working': ['la IA cocinando', 'a ver qué sale'],
    keystroke: ['está volando con el teclado', 'no para hermano', 'máquina'],
    idle: ['descansando el crack', 'se fue por un café', 'ya vuelve'],
    'convo-error-loop': ['ya lo resuelve tranquilo', 'paciencia chat'],
    'activity-deep-focus': ['concentrado al máximo', 'no molesten'],
    'activity-speed-run': ['velocidad brutal', 'está volando'],
  },
  idleMessages: ['mejor stream de código que he visto', 'este tipo es un crack', 'alguien sabe qué está construyendo', 'llevo media hora y no puedo irme'],
  streamerReactions: ['habló el crack', 'grande', 'el mejor', 'se nota la clase', 'crack total'],
};

const SPANISH_TROLL: ViewerPersona = {
  name: 'NoMames_Wey',
  color: '#fb923c',
  badge: 'og',
  type: 'troll',
  lang: 'es' as 'he' | 'en',
  reactions: {
    save: ['guarda cada dos segundos jaja', 'no confía en su propio código', 'ctrl+s adicto'],
    'error-added': ['se veía venir', 'eso pasa por no testear', 'clásico'],
    'error-cleared': ['hasta un reloj roto acierta dos veces', 'por fin', 'tardó bastante'],
    'all-errors-cleared': ['esperen tantito va a fallar otra vez', 'no celebren todavía'],
    'git-commit': ['valiente hacer commit de eso', 'pobre el que haga code review', 'atrevido'],
    'git-push': ['push a producción en viernes jaja', 'ojalá tenga rollback', 'yolo total'],
    'mass-delete': ['eligió violencia hoy', 'sin piedad', 'adiós código'],
    'build-pass': ['en serio funciona? no me lo creo', 'debe ser un bug del build'],
    'build-fail': ['ahí está', 'sorprendido? yo no', 'predecible'],
    'vibe-code-landed': ['la IA haciendo todo el trabajo', 'ingeniero de ctrl+v', 'qué hace él entonces'],
    'vibe-ai-working': ['dejando que los adultos trabajen', 'él solo mira jaja'],
    keystroke: ['está escribiendo código o su autobiografía', 'teclas random'],
    idle: ['se durmió', 'stream muerto', 'se fue'],
    'convo-error-loop': ['mismo error quinta vez increíble', 'definición de locura'],
    'activity-deep-focus': ['o está concentrado o se quedó dormido'],
    'activity-speed-run': ['speedrun a bugs en producción'],
  },
  idleMessages: ['de verdad están viendo esto', 'he visto mejor código de un bootcamp', 'al menos el chat está entretenido'],
  streamerReactions: ['ay también sabe escribir', 'seguro compa', 'bueno tiene razón', 'no mames jaja'],
};

// ═══════════════════════════════════════════
// פורטוגזית — 2 דמויות
// ═══════════════════════════════════════════

const PORTUGUESE_FAN: ViewerPersona = {
  name: 'BrDev_Monstro',
  color: '#22d3ee',
  badge: 'sub',
  type: 'fanboy',
  lang: 'pt' as 'he' | 'en',
  reactions: {
    save: ['salvou certinho', 'monstro demais', 'é isso aí', 'mandou bem'],
    'error-added': ['tranquilo ele resolve', 'relaxa galera', 'de boa ele arruma'],
    'error-cleared': ['falei que ele resolvia', 'brabo demais', 'nunca duvidei'],
    'all-errors-cleared': ['ZERADO', 'limpo total mano', 'perfeição', 'monstro'],
    'git-commit': ['commitou e mandou', 'mais um pro histórico', 'não para nunca'],
    'git-push': ['mandou pra produção sem medo', 'brabo', 'coragem total'],
    'mass-delete': ['faxina geral', 'sem dó', 'limpou tudo'],
    'build-pass': ['verde total', 'funcionou lindo', 'monstro'],
    'build-fail': ['relaxa ele arruma', 'acontece com os melhores', 'já já resolve'],
    'vibe-code-landed': ['IA trabalhando pro monstro', 'o futuro é agora', 'combo insano'],
    'vibe-ai-working': ['IA cozinhando', 'vamos ver'],
    keystroke: ['tá voando no teclado', 'não para mano', 'máquina'],
    idle: ['foi tomar um café', 'já volta', 'descansando o monstro'],
    'convo-error-loop': ['ele resolve galera calma', 'paciência'],
    'activity-deep-focus': ['tá focado demais', 'não atrapalha'],
    'activity-speed-run': ['velocidade insana', 'tá voando'],
  },
  idleMessages: ['melhor stream de código que já vi', 'esse cara é monstro', 'tô há meia hora e não consigo sair'],
  streamerReactions: ['ele falou', 'monstro', 'brabo demais', 'o cara é fera', 'lenda'],
};

const PORTUGUESE_TROLL: ViewerPersona = {
  name: 'Kkkkk_Dev',
  color: '#c084fc',
  badge: 'og',
  type: 'troll',
  lang: 'pt' as 'he' | 'en',
  reactions: {
    save: ['salva toda hora kkk paranóico', 'não confia no próprio código'],
    'error-added': ['eu sabia kkkk', 'tava na cara', 'clássico'],
    'error-cleared': ['até relógio parado acerta duas vezes', 'finalmente', 'demorou'],
    'all-errors-cleared': ['espera um pouco vai quebrar de novo', 'temporário isso aí'],
    'git-commit': ['corajoso commitar isso', 'quem fizer review vai sofrer'],
    'git-push': ['push na sexta feira kkk', 'tomara que tenha rollback'],
    'mass-delete': ['escolheu violência hoje', 'sem piedade kkk'],
    'build-pass': ['sério que funcionou? não acredito', 'bug no build system com certeza'],
    'build-fail': ['tá aí kkk', 'surpreso? eu não'],
    'vibe-code-landed': ['IA fazendo todo trabalho kkk', 'engenheiro de ctrl v'],
    'vibe-ai-working': ['deixa os adultos trabalharem'],
    keystroke: ['tá escrevendo código ou redação'],
    idle: ['dormiu kkk', 'morreu a stream', 'foi embora'],
    'convo-error-loop': ['mesmo erro pela quinta vez incrível'],
    'activity-deep-focus': ['focado ou dormiu de olho aberto'],
    'activity-speed-run': ['speedrun pra bug em produção'],
  },
  idleMessages: ['vocês tão mesmo assistindo isso', 'já vi código melhor de estagiário kkk'],
  streamerReactions: ['ele sabe digitar também kkk', 'ok', 'justo', 'kkkkk'],
};

// ═══════════════════════════════════════════
// צרפתית — 2 דמויות
// ═══════════════════════════════════════════

const FRENCH_FAN: ViewerPersona = {
  name: 'LeCrack_Dev',
  color: '#818cf8',
  badge: 'sub',
  type: 'fanboy',
  lang: 'fr' as 'he' | 'en',
  reactions: {
    save: ['bien sauvegardé', 'parfait', 'comme un pro', 'nickel'],
    'error-added': ['tranquille il gère', 'pas de stress', 'ça va se régler'],
    'error-cleared': ['je le savais', 'trop fort', 'jamais douté'],
    'all-errors-cleared': ['PROPRE', 'zéro erreur magnifique', 'parfait'],
    'git-commit': ['envoyé', 'encore un commit de génie', 'inarrêtable'],
    'git-push': ['poussé en prod sans peur', 'courageux', 'le boss'],
    'mass-delete': ['grand ménage', 'sans pitié', 'bien fait'],
    'build-pass': ['tout vert', 'ça marche nickel', 'bravo'],
    'build-fail': ['il va corriger tranquille', 'ça arrive aux meilleurs'],
    'vibe-code-landed': ['le futur est là', 'combo gagnant', 'incroyable'],
    'vibe-ai-working': ['ça cuisine', 'on attend'],
    keystroke: ['il tape comme un fou', 'machine', 'il arrête jamais'],
    idle: ['pause café', 'il revient', 'repos mérité'],
    'convo-error-loop': ['il va trouver patience', 'calme le chat'],
    'activity-deep-focus': ['en mode concentration', 'faut pas déranger'],
    'activity-speed-run': ['vitesse folle', 'il vole'],
  },
  idleMessages: ['meilleur stream de code que j\'ai vu', 'ce gars est trop fort', 'je reste encore un peu'],
  streamerReactions: ['il a parlé', 'le patron', 'trop bien', 'respect', 'classe'],
};

const FRENCH_TROLL: ViewerPersona = {
  name: 'Baguette_Coder',
  color: '#67e8f9',
  badge: 'og',
  type: 'troll',
  lang: 'fr' as 'he' | 'en',
  reactions: {
    save: ['il sauvegarde toutes les deux secondes', 'parano total', 'ctrl+s addict'],
    'error-added': ['ça se voyait venir', 'classique', 'étonnant non'],
    'error-cleared': ['même une horloge cassée a raison deux fois par jour', 'enfin'],
    'all-errors-cleared': ['attendez ça va recasser', 'temporaire', 'fêtez pas trop vite'],
    'git-commit': ['courageux de commit ça', 'bon courage au reviewer'],
    'git-push': ['push en prod un vendredi', 'j\'espère qu\'il a un rollback'],
    'mass-delete': ['il a choisi la violence', 'sans pitié', 'adieu le code'],
    'build-pass': ['ça marche vraiment? j\'y crois pas', 'sûrement un bug du build'],
    'build-fail': ['et voilà', 'surpris? pas moi', 'prévisible'],
    'vibe-code-landed': ['l\'IA fait tout le boulot', 'ingénieur copier-coller'],
    'vibe-ai-working': ['laissez les adultes travailler'],
    keystroke: ['il écrit du code ou un roman'],
    idle: ['il s\'est endormi', 'stream mort', 'parti'],
    'convo-error-loop': ['même erreur pour la cinquième fois'],
    'activity-deep-focus': ['concentré ou endormi les yeux ouverts'],
    'activity-speed-run': ['speedrun vers les bugs en prod'],
  },
  idleMessages: ['vous regardez vraiment ça', 'j\'ai vu mieux d\'un stagiaire', 'au moins le chat est marrant'],
  streamerReactions: ['oh il sait écrire aussi', 'mouais', 'pas faux', 'ok admettons'],
};

// ═══════════════════════════════════════════
// גרמנית — 2 דמויות
// ═══════════════════════════════════════════

const GERMAN_FAN: ViewerPersona = {
  name: 'Der_Entwickler',
  color: '#84cc16',
  badge: 'sub',
  type: 'fanboy',
  lang: 'de' as 'he' | 'en',
  reactions: {
    save: ['gut gespeichert', 'perfekt', 'sauber', 'wie ein Profi'],
    'error-added': ['kein Stress er fixt das', 'passiert den Besten', 'locker'],
    'error-cleared': ['wusste ich doch', 'stark', 'nie gezweifelt'],
    'all-errors-cleared': ['SAUBER', 'null Fehler Wahnsinn', 'makellos'],
    'git-commit': ['abgeschickt', 'noch ein Commit noch ein Sieg', 'unaufhaltsam'],
    'git-push': ['mutig in Produktion gepusht', 'der Boss', 'Respekt'],
    'mass-delete': ['Großreinemachen', 'gnadenlos', 'musste sein'],
    'build-pass': ['alles grün', 'läuft perfekt', 'stark'],
    'build-fail': ['passiert den Besten', 'er fixt das gleich', 'kein Problem'],
    'vibe-code-landed': ['die Zukunft ist jetzt', 'Gewinnerkombination', 'Wahnsinn'],
    'vibe-ai-working': ['KI kocht', 'mal sehen'],
    keystroke: ['tippt wie verrückt', 'Maschine', 'hört nicht auf'],
    idle: ['Kaffeepause', 'kommt gleich wieder', 'verdiente Pause'],
    'convo-error-loop': ['er findet die Lösung Geduld', 'Chat ruhig bleiben'],
    'activity-deep-focus': ['voll konzentriert', 'nicht stören'],
    'activity-speed-run': ['irre Geschwindigkeit', 'er fliegt'],
  },
  idleMessages: ['bester Code Stream den ich je gesehen habe', 'der Typ ist ein Genie', 'bin schon eine halbe Stunde hier'],
  streamerReactions: ['er hat gesprochen', 'der Chef', 'stark', 'Respekt', 'Legende'],
};

const GERMAN_TROLL: ViewerPersona = {
  name: 'Kartoffel_Coder',
  color: '#a3e635',
  badge: 'og',
  type: 'troll',
  lang: 'de' as 'he' | 'en',
  reactions: {
    save: ['speichert alle zwei Sekunden Vertrauensprobleme', 'paranoid oder was'],
    'error-added': ['war ja klar', 'klassisch', 'wer hätte das gedacht'],
    'error-cleared': ['selbst eine kaputte Uhr geht zweimal am Tag richtig', 'endlich'],
    'all-errors-cleared': ['wartet ab das bricht gleich wieder', 'feiert nicht zu früh'],
    'git-commit': ['mutig das zu committen', 'armer Reviewer'],
    'git-push': ['Push am Freitag mutig', 'hoffentlich gibts Rollback'],
    'mass-delete': ['hat heute Gewalt gewählt', 'gnadenlos', 'tschüss Code'],
    'build-pass': ['funktioniert echt? glaub ich nicht', 'bestimmt ein Bug im Build'],
    'build-fail': ['da haben wirs', 'überrascht? ich nicht', 'vorhersehbar'],
    'vibe-code-landed': ['KI macht die ganze Arbeit', 'Copy-Paste-Ingenieur'],
    'vibe-ai-working': ['die Erwachsenen arbeiten lassen'],
    keystroke: ['schreibt er Code oder seinen Lebenslauf'],
    idle: ['eingeschlafen', 'Stream tot', 'weg'],
    'convo-error-loop': ['gleicher Fehler zum fünften Mal unglaublich'],
    'activity-deep-focus': ['konzentriert oder eingeschlafen mit offenen Augen'],
    'activity-speed-run': ['Speedrun zu Bugs in Produktion'],
  },
  idleMessages: ['schaut ihr das echt', 'hab besseren Code von Praktikanten gesehen'],
  streamerReactions: ['oh er kann auch tippen', 'naja ok', 'hat er recht', 'stimmt eigentlich'],
};

// ═══════════════════════════════════════════
// יפנית — 2 דמויות
// ═══════════════════════════════════════════

const JAPANESE_FAN: ViewerPersona = {
  name: 'コード職人',
  color: '#f472b6',
  badge: 'sub',
  type: 'fanboy',
  lang: 'ja' as 'he' | 'en',
  reactions: {
    save: ['ナイスセーブ', 'さすが', '完璧', 'いい感じ'],
    'error-added': ['大丈夫すぐ直す', '問題ない', 'よくあること'],
    'error-cleared': ['やっぱりすごい', 'さすがプロ', '完璧な修正'],
    'all-errors-cleared': ['エラーゼロ最高', '完璧すぎる', 'すごい'],
    'git-commit': ['コミット完了', 'また一歩前進', '止まらない'],
    'git-push': ['本番にプッシュ勇気ある', 'すごい', 'かっこいい'],
    'mass-delete': ['大掃除', '思い切りがいい', 'スッキリ'],
    'build-pass': ['グリーン', '完璧に動いてる', 'さすが'],
    'build-fail': ['大丈夫すぐ直る', 'プロでもよくある'],
    'vibe-code-landed': ['未来のコーディング', 'すごい組み合わせ', 'AIと人間最強'],
    'vibe-ai-working': ['AIが料理中', '楽しみ'],
    keystroke: ['タイピング速すぎ', '止まらない', 'マシン'],
    idle: ['休憩中', 'すぐ戻る', '休んで'],
    'convo-error-loop': ['きっと解決する', '頑張って'],
    'activity-deep-focus': ['集中モード', '邪魔しないで'],
    'activity-speed-run': ['速すぎる', '飛んでる'],
  },
  idleMessages: ['最高のコード配信', 'この人すごすぎる', '目が離せない'],
  streamerReactions: ['話してくれた', 'すごい', 'さすが', '最高', '尊敬'],
};

const JAPANESE_TROLL: ViewerPersona = {
  name: 'エンジニア草',
  color: '#e879f9',
  badge: 'og',
  type: 'troll',
  lang: 'ja' as 'he' | 'en',
  reactions: {
    save: ['2秒ごとにセーブ草', '信用してないのか', 'セーブ中毒'],
    'error-added': ['やっぱり草', '予想通り', 'クラシック'],
    'error-cleared': ['壊れた時計でも一日二回は合う', 'やっと'],
    'all-errors-cleared': ['ちょっと待ってまた壊れるから', '早すぎる'],
    'git-commit': ['それコミットする勇気草', 'レビュアーかわいそう'],
    'git-push': ['金曜にプッシュ草', 'ロールバックあるよね'],
    'mass-delete': ['今日は暴力を選んだ草', '容赦ない'],
    'build-pass': ['マジで動くの信じられない', 'ビルドのバグでしょ'],
    'build-fail': ['ほらね草', '驚き?ないけど', '予想通り'],
    'vibe-code-landed': ['AIが全部やってる草', 'コピペエンジニア'],
    'vibe-ai-working': ['大人に任せて草'],
    keystroke: ['コード書いてるのか自伝書いてるのか'],
    idle: ['寝た草', '配信終了', 'いなくなった'],
    'convo-error-loop': ['同じエラー5回目すごい'],
    'activity-deep-focus': ['集中してるか寝てるか'],
    'activity-speed-run': ['バグへのスピードラン'],
  },
  idleMessages: ['マジでこれ見てるの', '研修生のほうがマシ草'],
  streamerReactions: ['字も打てるんだ草', 'まあね', 'それはそう', '草'],
};

// ═══════════════════════════════════════════
// רוסית — 2 דמויות
// ═══════════════════════════════════════════

const RUSSIAN_FAN: ViewerPersona = {
  name: 'КодерПро',
  color: '#fb7185',
  badge: 'sub',
  type: 'fanboy',
  lang: 'ru' as 'he' | 'en',
  reactions: {
    save: ['сохранил красавчик', 'молодец', 'чётко', 'как профи'],
    'error-added': ['спокойно починит', 'бывает', 'не страшно'],
    'error-cleared': ['я знал что починит', 'красавчик', 'силён'],
    'all-errors-cleared': ['ЧИСТО', 'ноль ошибок красота', 'идеально'],
    'git-commit': ['закоммитил и вперёд', 'ещё один коммит ещё одна победа'],
    'git-push': ['запушил в прод без страха', 'смелый', 'красавчик'],
    'mass-delete': ['генеральная уборка', 'без жалости', 'так и надо'],
    'build-pass': ['зелёный', 'работает идеально', 'молодец'],
    'build-fail': ['спокойно починит', 'бывает у лучших'],
    'vibe-code-landed': ['будущее уже здесь', 'связка огонь', 'мощно'],
    'vibe-ai-working': ['ИИ готовит', 'посмотрим'],
    keystroke: ['летает по клавиатуре', 'не останавливается', 'машина'],
    idle: ['пошёл за кофе', 'скоро вернётся', 'заслуженный отдых'],
    'convo-error-loop': ['найдёт решение терпение', 'спокойно чат'],
    'activity-deep-focus': ['в режиме концентрации', 'не мешайте'],
    'activity-speed-run': ['скорость безумная', 'летит'],
  },
  idleMessages: ['лучший стрим кода что видел', 'этот парень гений', 'не могу оторваться'],
  streamerReactions: ['он заговорил', 'красавчик', 'молодец', 'уважаю', 'легенда'],
};

const RUSSIAN_TROLL: ViewerPersona = {
  name: 'Ahahaha_Dev',
  color: '#fca5a5',
  badge: 'og',
  type: 'troll',
  lang: 'ru' as 'he' | 'en',
  reactions: {
    save: ['сохраняет каждые две секунды параноик', 'не доверяет своему коду'],
    'error-added': ['так и знал', 'классика', 'кто бы мог подумать'],
    'error-cleared': ['даже сломанные часы дважды в день показывают правильное время'],
    'all-errors-cleared': ['подождите сейчас опять сломается', 'временно'],
    'git-commit': ['смело коммитить такое', 'бедный ревьюер'],
    'git-push': ['пуш в прод в пятницу', 'надеюсь есть откат'],
    'mass-delete': ['выбрал насилие сегодня', 'без жалости'],
    'build-pass': ['серьёзно работает? не верю', 'наверно баг в билде'],
    'build-fail': ['вот и всё', 'удивлён? я нет'],
    'vibe-code-landed': ['ИИ делает всю работу', 'инженер ctrl v'],
    'vibe-ai-working': ['пусть взрослые работают'],
    keystroke: ['код пишет или мемуары'],
    idle: ['уснул', 'стрим мёртв'],
    'convo-error-loop': ['та же ошибка в пятый раз'],
    'activity-deep-focus': ['сконцентрирован или уснул'],
    'activity-speed-run': ['спидран к багам в проде'],
  },
  idleMessages: ['вы реально это смотрите', 'у стажёра лучше код видел'],
  streamerReactions: ['о он умеет печатать', 'ну ок', 'ладно', 'справедливо'],
};

// ═══════════════════════════════════════════
// ערבית — 2 דמויות
// ═══════════════════════════════════════════

const ARABIC_FAN: ViewerPersona = {
  name: 'مبرمج_محترف',
  color: '#4ade80',
  badge: 'sub',
  type: 'fanboy',
  lang: 'ar' as 'he' | 'en',
  reactions: {
    save: ['حفظ ممتاز', 'يا سلام', 'محترف', 'أحسنت'],
    'error-added': ['عادي يصلحها بسرعة', 'ما في مشكلة', 'يحصل مع الأفضل'],
    'error-cleared': ['عرفت إنه يقدر', 'محترف', 'ما شككت أبداً'],
    'all-errors-cleared': ['نظيف تماماً', 'صفر أخطاء', 'مثالي'],
    'git-commit': ['أرسلها', 'كوميت ثاني نصر ثاني', 'ما يوقف'],
    'git-push': ['دفع للإنتاج بدون خوف', 'شجاع', 'بطل'],
    'mass-delete': ['تنظيف شامل', 'بدون رحمة', 'لازم يصير'],
    'build-pass': ['أخضر', 'يشتغل تمام', 'ممتاز'],
    'build-fail': ['عادي يصلحها', 'يحصل مع الكل'],
    'vibe-code-landed': ['المستقبل هنا', 'تركيبة فوز', 'رهيب'],
    'vibe-ai-working': ['الذكاء الاصطناعي يطبخ', 'ننتظر'],
    keystroke: ['يكتب بسرعة جنونية', 'ما يوقف', 'ماكينة'],
    idle: ['راح يشرب قهوة', 'يرجع قريب'],
    'convo-error-loop': ['بيلاقي الحل صبر', 'هدوء يا شات'],
    'activity-deep-focus': ['تركيز عالي', 'لا تزعجوه'],
    'activity-speed-run': ['سرعة مجنونة', 'يطير'],
  },
  idleMessages: ['أفضل بث برمجة شفته', 'هذا الشخص عبقري', 'مستحيل أطلع'],
  streamerReactions: ['تكلم', 'بطل', 'ممتاز', 'احترام', 'أسطورة'],
};

const ARABIC_TROLL: ViewerPersona = {
  name: 'هههه_مبرمج',
  color: '#86efac',
  badge: 'og',
  type: 'troll',
  lang: 'ar' as 'he' | 'en',
  reactions: {
    save: ['يحفظ كل ثانيتين بارانويا', 'ما يثق بكوده'],
    'error-added': ['توقعتها', 'كلاسيك', 'مين كان يتوقع'],
    'error-cleared': ['حتى الساعة المكسورة تصيب مرتين باليوم', 'أخيراً'],
    'all-errors-cleared': ['استنوا شوي بيخرب ثاني', 'لا تحتفلوا بسرعة'],
    'git-commit': ['شجاع يعمل كوميت لهذا', 'مسكين اللي يراجع'],
    'git-push': ['بوش يوم الجمعة', 'يا رب في رولباك'],
    'mass-delete': ['اختار العنف اليوم', 'بدون رحمة'],
    'build-pass': ['جد يشتغل؟ مستحيل', 'أكيد خطأ بالبلد'],
    'build-fail': ['ها قلتلكم', 'متفاجئين؟ أنا لا'],
    'vibe-code-landed': ['الذكاء الاصطناعي يسوي كل الشغل', 'مهندس نسخ ولصق'],
    'vibe-ai-working': ['خلوا الكبار يشتغلون'],
    keystroke: ['يكتب كود ولا رواية'],
    idle: ['نام', 'البث مات'],
    'convo-error-loop': ['نفس الخطأ للمرة الخامسة'],
    'activity-deep-focus': ['مركز ولا نايم بعيون مفتوحة'],
    'activity-speed-run': ['سبيد ران للباقز'],
  },
  idleMessages: ['جد تتفرجون على هذا', 'شفت كود أحسن من متدرب'],
  streamerReactions: ['يعرف يكتب كمان', 'أوكي', 'معاه حق', 'هههه'],
};

// ═══════════════════════════════════════════
// ייצוא — כל הפרסונות לפי שפה
// ═══════════════════════════════════════════

export const PERSONAS_BY_LANG: Record<string, ViewerPersona[]> = {
  en: [FANBOY, TROLL, NOOB, VETERAN, LURKER, SPAMMER, CRITIC],
  he: [ISRAELI_FAN, ISRAELI_TROLL, ISRAELI_NOOB],
  es: [SPANISH_FAN, SPANISH_TROLL],
  pt: [PORTUGUESE_FAN, PORTUGUESE_TROLL],
  fr: [FRENCH_FAN, FRENCH_TROLL],
  de: [GERMAN_FAN, GERMAN_TROLL],
  ja: [JAPANESE_FAN, JAPANESE_TROLL],
  ru: [RUSSIAN_FAN, RUSSIAN_TROLL],
  ar: [ARABIC_FAN, ARABIC_TROLL],
};

export const ALL_PERSONAS: ViewerPersona[] = Object.values(PERSONAS_BY_LANG).flat();

const LANG_NAMES: Record<string, string> = {
  en: 'English', he: 'עברית', es: 'Español', pt: 'Português',
  fr: 'Français', de: 'Deutsch', ja: '日本語', ru: 'Русский', ar: 'العربية',
};

export function getPersonaDescriptions(lang: string): string {
  const activePersonas = getActivePersonas(lang);
  const lines = activePersonas.map(p => {
    const badge = p.badge ? ` [${p.badge.toUpperCase()}]` : '';
    const langLabel = LANG_NAMES[p.lang as string] ?? p.lang;
    return `@${p.name}${badge} — ${langLabel}. ${describePersona(p.type)}`;
  });

  return `Viewers in chat — each has a fixed personality and language.
ABSOLUTE RULE: Each viewer writes ONLY in their language. No mixing. Not even one word from another language.

${lines.join('\n')}`;
}

function describePersona(type: PersonaType): string {
  const descriptions: Record<PersonaType, string> = {
    fanboy: 'Always positive, everything is amazing, pure hype.',
    troll: 'Sarcastic, jokes, backseat coding, brutal humor.',
    noob: 'Beginner, asks naive questions, amazed by everything.',
    veteran: 'Day-1 viewer, inside jokes, remembers past streams.',
    spammer: 'One-two words max, pure emote energy.',
    critic: 'Senior dev, opinionated, high standards.',
    lurker: 'Rarely speaks. When speaks, perfect one-word response.',
    israeli_fan: 'Israeli fan, full Hebrew, always supportive.',
    israeli_troll: 'Israeli troll, full Hebrew, sarcastic humor.',
    israeli_noob: 'Israeli beginner, full Hebrew, asks questions.',
  };
  return descriptions[type] ?? '';
}

/** Get personas for the selected language — includes local + some English for mix */
export function getActivePersonas(lang: string): ViewerPersona[] {
  const localPersonas = PERSONAS_BY_LANG[lang] ?? [];
  const enPersonas = lang !== 'en' ? PERSONAS_BY_LANG['en'] ?? [] : [];
  // Local personas + 3 random English ones for international mix
  const enSample = [...enPersonas].sort(() => Math.random() - 0.5).slice(0, 3);
  return [...localPersonas, ...enSample];
}

/** Pick N random personas from the active pool (language-aware) */
export function pickRandomPersonas(count: number, lang = 'en'): ViewerPersona[] {
  const pool = getActivePersonas(lang);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

# VibeStream — Product Plan

> "VibeStream makes coding feel like main character energy — you're the streamer, the chat is alive, and every keystroke matters."

## What Is VibeStream

A VS Code extension that turns your coding session into a simulated live stream. AI-generated viewers watch you code, react in real-time, rank up over time, coach you on vibe coding best practices, and make you feel like a coding celebrity.

No actual streaming. No camera. No audience. Just you, your IDE, and a chat full of living agents that make coding less lonely and more fun — while teaching you to be a better AI-first developer.

## Who It's For

- Solo developers who code alone and want company
- Vibe coders who talk to AI all day
- Developers learning AI-assisted development
- Anyone who wants coding to feel less lonely and more fun

## Core Identity

- **Not a toy** — it's Duolingo for vibe coding, disguised as a Twitch stream
- **Not a feature of Vibe Buddy** — completely separate product, separate extension, separate repo
- **The hook is entertainment** — the value is skill progression

---

## Product Architecture

### Tech Stack
- VS Code Extension (TypeScript)
- Gemini Flash for chat generation (fast, cheap)
- Local persistence (~/.vibestream/)
- LemonSqueezy for payments/licensing

### Repo Structure

```
~/Projects/vibestream/
src/
  extension.ts              — activation, commands, event wiring
  events/
    editor-events.ts        — keystrokes, saves, errors, file changes
    terminal-events.ts      — build pass/fail
    git-events.ts           — commits, pushes
    task-events.ts          — VS Code tasks
    event-bus.ts            — central event system
    claude-watcher.ts       — reads Claude Code .jsonl conversations live
  stream/
    chat-manager.ts         — 2-layer chat engine (instant reactions + LLM)
    viewer-generator.ts     — dynamic viewer agents, roster, persistence
    viewer-personas.ts      — reaction pools per personality x language
    session-analyzer.ts     — post-session quality analysis (Gemini)
  progression/
    xp-engine.ts            — XP calculations, level thresholds, persistence
    achievements.ts         — 30+ achievement definitions + unlock tracking
    challenges.ts           — daily challenge generation + progress
    session-score.ts        — end-of-session scoring + recap
    streak-tracker.ts       — daily streak counter + freeze logic
  auth/
    license.ts              — LemonSqueezy license key validation
  webview/
    panel-manager.ts        — HTML/CSS/message routing for sidebar
webview/
  app.ts                    — main webview logic
  ui/
    chat.ts                 — chat rendering, message drip, hype bar
    profile-card.ts         — viewer profile popup
    xp-bar.ts               — XP progress bar + level display
    achievements.ts         — achievement popup + showcase
    challenges.ts           — daily challenge tracker
    session-recap.ts        — end-of-session score screen
    setup-screen.ts         — first-time setup + settings
  effects/
    confetti.ts             — celebration particles
    sounds.ts               — level up, achievement, raid sounds
media/
  icons/                    — extension icon, achievement badges
  sounds/                   — .mp3 for level up, achievement, etc.
package.json
tsconfig.json
README.md
```

### Data Files (User's Machine)

```
~/.vibestream/
  profile.json      — XP, level, achievements, challenge progress, streak
  viewers.json       — viewer roster with stats
  history.json       — session history for recaps
  license.key        — Pro license key (if purchased)
```

---

## Stream Chat System

### 2-Layer Chat Engine

**Layer 1 — Instant Reactions (< 300ms, no API)**
- Hardcoded reaction pools per personality type, per language
- Fire immediately on events (save, error, commit, push, etc.)
- Pick 2-3 random viewers from session roster
- Each viewer uses reactions matching their personality

**Layer 2 — LLM Smart Reactions (3-5s delay, Gemini Flash)**
- Batch events every 4-8 seconds (depends on chat style)
- Full context: what's on screen, Claude conversation, chat history
- Gemini generates messages from specific roster viewers
- Each viewer writes in character + in their language

### Chat Styles

| Style | Interval | Messages/Batch | Vibe |
|---|---|---|---|
| Hype | 4s | 5 | Everything is amazing, high energy |
| Chill | 8s | 2 | Relaxed, real conversations |
| Savage | 5s | 4 | Roasts, trolls, backseat coding |

### Streamer Chat
- User can type messages in the chat input
- Viewers react in 3 waves:
  - Wave 1 (0.8-2s): spammers + hype viewers
  - Wave 2 (1.5-3s): noobs + trolls
  - Wave 3 (2.5-4s): veterans + critics + lurkers
  - Wave 4 (4-7s): LLM smart reactions referencing what streamer said

### Viewer Count
- Starts at 120-200
- Rises on activity events (commit = +200, push = +350, etc.)
- Decays 3-8% every 12 seconds when idle
- Range: 30 (minimum) to 9,999 (maximum)
- Animated counter in viewer bar

### Random Events (every 15-25 min, random)

| Event | What Happens | XP Bonus |
|---|---|---|
| Raid | 200 viewers flood in, chat goes crazy for 30s | 50 |
| Sub Train | Viewers "subscribe" one after another, counter goes up | 30 |
| Donation | Viewer sends highlighted message with fake $ amount | 20 |
| Clip Moment | Chat votes something clip-worthy, saved to highlights | 15 |
| Boss Fight | Big error triggers boss battle UI, fix it = massive XP | 100 |

---

## Viewer System

### Viewer Generator
- Dynamic name generation from language-specific pools (9 languages)
- 7 personality types: hype, troll, noob, veteran, critic, lurker, spammer
- Each viewer has: name, color, personality, languages spoken, profile (age, location, bio)
- Persisted to ~/.vibestream/viewers.json between sessions (Pro only)

### Viewer Rank System

| Rank | Watch Minutes | Badge | Behavior |
|---|---|---|---|
| Newcomer | 0-5 | — | Curious, asks questions |
| Regular | 5-20 | — | Shows up sometimes |
| Fan | 20-60 | — | Loyal, keeps coming back |
| Sub | 60-180 | SUB | Dedicated, has opinions |
| VIP | 180-500 | VIP | Long-time supporter, confident |
| OG | 500+ | OG | Original viewer, references history |

### Session Roster Composition
- Load existing viewers from file
- 60% of existing viewers "return" (random selection)
- 2-4 new viewers generated each session
- Total: 6-10 active viewers per session
- Every 5 minutes: update watch time, check rank-ups, persist

### Profile Cards
Click any viewer name in chat to see:
- Personality emoji + name (colored)
- Rank + badge
- Age, location
- Bio (personality-appropriate)
- Languages spoken
- Stats: watch minutes, sessions, messages, member since

### Language Realism

**Core Rule:** Stream language = chat language. If stream is Hebrew, ~90% of viewers write in Hebrew.

**Roster language distribution:**
- 70% chance: 0 international viewers (pure local stream)
- 25% chance: 1 international viewer
- 5% chance: 2 international viewers

**As viewer count grows, more internationals appear:**
- Under 500 viewers: rarely
- 500-2000: occasionally (1-2)
- 2000+: more common (2-3)

**International viewer behavior:**
- Writes in their own language (usually English)
- Reacts with universal emotes: KEKW, PogChamp, W
- Asks "what did he say?" / "can someone translate?"
- Tries broken Google-translate of stream language
- Understands CODE on screen but not chat conversation
- Other viewers sometimes translate for them or tease them

**Viewer languages field:**
- Each viewer has `languages: string[]` (e.g., ["he", "en"])
- Profile card shows: "Languages: Hebrew, English"
- LLM prompt specifies: viewer writes ONLY in languages they speak

---

## Progression System

### XP Engine

XP is earned from coding actions. Good patterns = more XP. Bad patterns = less XP (not zero — never punish).

**XP Sources:**

| Action | XP | Skill Rewarded |
|---|---|---|
| Short prompt that works (< 50 words, no follow-up) | 25 | Concise prompting |
| One-shot success (no follow-up within 2 min) | 40 | Prompt quality |
| Prompt with context (error msg, file reference) | 20 | Context providing |
| Constraint-based prompt ("don't", "without", "avoid") | 20 | Constraint prompting |
| Edit AI code within 60s of landing | 15 | Code review |
| Fix error within 90s of AI code landing | 25 | Quality review |
| Build within 2 min of AI code landing | 30 | Review discipline |
| No error loop (no repeated topic in 3 prompts) | 35 | Smart iteration |
| Commit with good message (> 15 chars, starts with verb) | 15 | Git discipline |
| Atomic commit (< 50 lines) | 30 | Clean workflow |
| Clean pipeline (commit + build-pass + push, 0 errors) | 50 | Full workflow |
| Save file | 5 | Basic habit |
| Error fixed | 15 | Debugging |
| All errors cleared | 40 | Clean code |
| Git commit | 50 | Shipping |
| Git push | 100 | Deployment |
| 15 min coding streak | 25 | Focus |
| 30 min coding streak | 40 | Deep focus |
| Raid survived | 50 | Random bonus |
| Daily challenge completed | 75 | Challenge system |
| All 3 dailies done | 150 bonus | Jackpot |
| Combo bonus (x2/x3/x4) | multiplier on base | Momentum |

**Anti-patterns (reduced XP, not zero):**

| Action | XP | Why |
|---|---|---|
| Same error 3+ times | 2 (instead of 15) | Not reviewing code |
| Giant commit (200+ lines) | 10 (instead of 30) | Not atomic |
| Error loop (3+ prompts same error) | 0 | Brute-forcing |
| Prompt over 500 words | 1 | Over-explaining |

### Level System

**Curve:** Soft curve — each level = previous + 10%. Starts at 100 XP.

Typical 2-hour session = 300-500 XP.

| Level | Total XP | Time to Reach | Title |
|---|---|---|---|
| 1-5 | 0-600 | First session | Prompt Beginner |
| 6-10 | 600-2,000 | ~Week 1 | Prompt Apprentice |
| 11-15 | 2,000-4,500 | ~Week 2 | Prompt Crafter |
| 16-20 | 4,500-8,000 | ~Week 3 | AI Pair Programmer |
| 21-25 | 8,000-13,000 | ~Month 1 | Code Conductor |
| 26-30 | 13,000-20,000 | ~Month 2 | Vibe Architect |
| 31-40 | 20,000-40,000 | ~Month 2-3 | Shipping Machine |
| 41-50 | 40,000-60,000 | ~Month 3 | 10x Vibe Coder |
| 51-60 | 60,000-100,000 | ~Month 4-5 | AI Whisperer |
| 61-75 | 100,000-200,000 | ~Month 6-8 | Vibe Sensei |
| 76-90 | 200,000-400,000 | ~Month 9-12 | Digital Maestro |
| 91-99 | 400,000-500,000 | Long-term | GOAT |

### Prestige System (Pro)
Hit level 99 → prestige → reset to level 1 with a prestige badge. Keep all achievements. Prestige counter shows how many times you've maxed out.

---

## 5 Skill Trees

Each skill tree has 5 levels (Beginner > Apprentice > Practitioner > Expert > Master).
VibeStream detects good patterns and rewards them — the user learns by doing.

### Skill Tree 1: Prompting
*"How you talk to AI determines what you get back."*

| Level | Concept | Detection Method |
|---|---|---|
| 1 | Be specific — include file/function names | Prompt > 15 words + contains identifiers |
| 2 | Keep it concise — fewer words, better results | Prompt < 80 words + no follow-up within 60s |
| 3 | One task per prompt — don't ask for 5 things | Heuristic: no "and also" / multiple requests |
| 4 | Provide context — paste errors, stack traces | Backticks or stacktrace patterns detected |
| 5 | Use constraints — tell AI what NOT to do | Contains "don't", "without", "avoid", "no external" |

### Skill Tree 2: Review & Quality
*"AI writes the code. You own the code."*

| Level | Concept | Detection Method |
|---|---|---|
| 1 | Read before accepting | User edits file within 60s of AI code landing |
| 2 | Fix AI mistakes early | Error fixed within 90s of AI code landing |
| 3 | Build after accepting | Build event within 2 min of code landing |
| 4 | No error loops | No repeated topic in 3 consecutive prompts |
| 5 | Understand what you ship | Commit message > 20 chars |

### Skill Tree 3: Workflow & Git
*"Ship small. Ship often. Ship clean."*

| Level | Concept | Detection Method |
|---|---|---|
| 1 | Save frequently | Save events every < 5 min during activity |
| 2 | Atomic commits | Commit < 50 lines changed |
| 3 | Good commit messages | > 15 chars, starts with verb |
| 4 | Clean pipeline | commit + build-pass + push, no errors between |
| 5 | Commit before big changes | Commit within 5 min before mass-delete/refactor |

### Skill Tree 4: Project Setup & Context
*"Set AI up for success before you write a single prompt."*

| Level | Concept | Detection Method |
|---|---|---|
| 1 | Use CLAUDE.md / .cursorrules | File exists in workspace root |
| 2 | Keep context files updated | CLAUDE.md modified in last 7 days |
| 3 | Organized project structure | < 10 files in root (excluding dotfiles) |
| 4 | Use .env for secrets | No API key patterns in tracked files |
| 5 | Define ignore patterns | .gitignore exists with > 5 entries |

### Skill Tree 5: Focus & Flow
*"The best code comes from deep focus, not multitasking."*

| Level | Concept | Detection Method |
|---|---|---|
| 1 | Stay in one file | Same file active > 5 min |
| 2 | Coding streak | 15 min with no idle gap > 2 min |
| 3 | Deep focus | 30 min continuous coding |
| 4 | Session length | Session > 60 min with consistent activity |
| 5 | Break when fatigued | Error rate spikes after 90 min + user takes 5 min break |

---

## Achievements (30+)

### Prompting
| Badge | Name | Requirement |
|---|---|---|
| Target | Sniper | 10 one-shot prompts (lifetime) |
| Scissors | Minimalist | 50 prompts under 40 words that worked |
| Clipboard | Context Provider | Include error messages in 25 prompts |
| No Entry | Constraint Master | 20 prompts with explicit constraints |
| Diamond | Prompt Architect | 100 one-shot successes (lifetime) |

### Review
| Badge | Name | Requirement |
|---|---|---|
| Eye | Eagle Eye | Edit AI code within 30s, 50 times |
| Shield | Quality Gate | 20 sessions with build-after-every-landing |
| Cycle | No Loops | 10 sessions with 0 error loops |
| Broom | Clean Sheet | 5 sessions with 0 total errors |
| Trophy | Code Owner | 500 AI code edits (proves review habit) |

### Workflow
| Badge | Name | Requirement |
|---|---|---|
| Atom | Atomic | 100 commits under 50 lines |
| Rocket | Shipping Machine | 50 git pushes (lifetime) |
| Pencil | Wordsmith | 50 commits with good messages |
| Wrench | Pipeline Pro | 20 clean pipelines |
| Muscle | 10x Shipper | 10 pushes in one week |

### Project Setup
| Badge | Name | Requirement |
|---|---|---|
| Ruler | Architect | CLAUDE.md in 5 different projects |
| Lock | Fort Knox | 50 sessions with no hardcoded secrets |
| Folder | Clean House | Organized structure in 10 projects |

### Focus
| Badge | Name | Requirement |
|---|---|---|
| Fire | Streak Lord | 60 min uninterrupted coding |
| Moon | Night Owl | Code after midnight |
| Sun | Early Bird | Code before 7am |
| Runner | Marathon | 3+ hour session |
| Meditation | Smart Break | Take 10 breaks when fatigue detected |

### Special
| Badge | Name | Requirement |
|---|---|---|
| Clapperboard | First Stream | Complete first session |
| Chart | Crowd Pleaser | Hit 5000 viewers |
| Speech | Chat God | Send 100 messages to chat |
| Crown | Fan Maker | Have 5 OG-rank viewers |
| Calendar | Consistent | 7-day streak |
| Fire | Dedicated | 30-day streak |
| Skull | Immortal | 100-day streak |
| Star | S-Rank | Get S-rank on a session recap |
| Medal | Season 1 OG | Complete Season 1 |

---

## Daily System

### Daily Streak
- Counter increments each day you code (at least 10 min of activity)
- Missing a day resets the counter
- Pro gets 1 streak freeze per week (miss a day without losing streak)
- Streak shows in status bar and viewer bar

### Daily Challenges (3 per day, refresh at midnight)

**Challenge categories (mixed each day):**

Prompting:
- "Efficient Communicator" — 3 prompts under 50 words that work first try
- "Sniper" — 5 one-shot successes
- "Context King" — include error messages in 5 error-related prompts

Review:
- "Eagle Eye" — edit AI code within 30s, 5 times
- "Zero Regret" — full session with 0 error loops
- "Quality Gate" — build after every AI code landing

Workflow:
- "Atomic Coder" — 5 commits under 30 lines each
- "Ship Shape" — 3 clean pipelines (commit > build > push, 0 errors)
- "Git Discipline" — commit before every major change

Focus:
- "Flow State" — 30 min uninterrupted coding
- "Marathon" — 2+ hour session with consistent activity
- "Smart Break" — take a break when error rate climbs

**Rewards:**
- Each challenge completed: 75 XP
- All 3 completed: 150 XP bonus (jackpot)
- Weekly challenge (harder): 200 XP

---

## Session Recap

End-of-session score card with skill breakdown:

```
SESSION RECAP — A RANK

Duration:     1h 42m
XP Earned:    485
Level:        14 > 15

SKILLS BREAKDOWN:
Prompting:    A   (7 clean prompts, 2 one-shots)
Review:       B   (edited AI code 4/7 times)
Workflow:     A+  (5 atomic commits, clean pipeline)
Focus:        B+  (22 min streak, one break)
Setup:        S   (CLAUDE.md exists, no secrets, clean structure)

HIGHLIGHTS:
- 3 one-shot prompts (clean!)
- 0 error loops
- 7 atomic commits

IMPROVE:
- 2 prompts were 200+ words — try breaking them smaller
- Built without testing once
```

### Scoring
- S: perfect (all patterns good)
- A: excellent (minor misses)
- B: good (room for improvement)
- C: average (several anti-patterns)
- D: needs work
- Overall: weighted average of all 5 skill trees

---

## Combo Meter

Saves/fixes/commits in rapid succession build a combo:
- x1: normal (default)
- x2: 2 positive events within 30 seconds
- x3: 3 positive events within 45 seconds
- x4: 4+ positive events within 60 seconds

Combo multiplies XP for each action. Breaking the combo (idle > 60s or error) resets it.

Chat reacts to combos:
- x2: mild excitement
- x3: hype building
- x4: chat goes absolutely insane

---

## Chat Speed Modes

Based on chat activity level:
- SLOW MODE: quiet, few messages
- NORMAL: regular flow
- FAST MODE: lots of activity
- HYPER MODE: chat is exploding (during hype events, raids, combos)

Visual indicator in the chat UI. Users naturally try to trigger HYPER MODE.

---

## Viewers as Coaches

The LLM prompt includes skill-aware coaching instructions:

```
The streamer just sent a 300-word prompt to Claude. The critic viewer
should comment: "bro that prompt is a novel, try saying it in 2 sentences"

The streamer accepted AI code without editing it. The veteran viewer
should say: "you didn't even read that code did you..."

The streamer did 3 atomic commits in a row. The hype viewer should
celebrate: "ATOMIC COMMITS LETS GOOOO this guy gets it"

The streamer is in an error loop (3rd prompt on same bug). The troll
should say: "definition of insanity right here KEKW"
```

Each personality serves a teaching function:

| Personality | Entertainment Role | Teaching Role |
|---|---|---|
| Hype | Cheers everything | Reinforces GOOD patterns with celebration |
| Troll | Roasts | Calls out BAD patterns with humor |
| Noob | Asks naive questions | Forces reflection ("why did you accept without reading?") |
| Veteran | Inside jokes | Shares real tips ("pro tip: give Claude the error message") |
| Critic | Code review snob | Specific improvements ("that prompt could be shorter") |
| Lurker | Silent watcher | Speaks ONLY on important moments — when lurker talks, you listen |
| Spammer | Emotes | Pure energy, universal reactions |

---

## Monetization

### Platform: LemonSqueezy
- No backend needed
- User buys on website > gets license key > enters in extension settings
- Extension validates key against api.lemonsqueezy.com on startup

### Pricing

| | Free | Pro ($5/mo) | Lifetime ($99) |
|---|---|---|---|
| Stream chat | Full | Full | Full |
| Viewer reactions | All events | All events | All events |
| Streamer chat | Yes | Yes | Yes |
| Random events | Yes | Yes | Yes |
| Combo meter | Yes | Yes | Yes |
| Viewer persistence | Resets each session | Permanent | Permanent |
| XP & Levels | Resets each session | Permanent (1-99) | Permanent |
| Achievements | 5 basic | 30+ full | 30+ full |
| Daily streak | No | Yes + freezes | Yes + freezes |
| Daily challenges | No | 3 per day | 3 per day |
| Session recap | No | Full score card | Full score card |
| Skill trees | No | All 5 | All 5 |
| Cosmetics/themes | Default only | All | All + exclusives |
| Profile cards | Basic | Full with stats | Full with stats |
| Languages | 3 (en/he/es) | All 9 | All 9 |
| Prestige system | No | Yes | Yes |

### Conversion Funnel

```
Day 1:  Install free > "this is fun" > play one session
Day 2:  Open again > viewers are new > "oh... they reset"
Day 3:  Play again > hit Level 8 > see Pro achievements > want them
Day 5:  Realize streak resets > "if I had Pro this would be Day 5"
Day 7:  See locked cosmetics > want Synthwave theme
Day 10: "I've been using this for 10 days, $5 is nothing" > CONVERT
```

### Launch Strategy
1. Ship free version to VS Code Marketplace — get installs + feedback
2. Add Pro features behind license gate
3. Landing page (Next.js on Vercel) with demo GIF + pricing
4. Product Hunt launch
5. Twitter/X dev community + Reddit r/vscode

---

## Cosmetics (Pro)

### Chat Themes
- Dark (default)
- Neon
- Retro Terminal
- Matrix
- Synthwave
- Nord
- Dracula

### Sound Packs
- Default
- Arcade
- Lo-fi
- Cyberpunk
- Silent

### Level-Up Effects
- Confetti (default)
- Fireworks
- Lightning
- Sakura
- Pixel explosion

### Chat Border Styles
- Twitch-style
- YouTube-style
- Kick-style
- Minimal
- RGB gaming

### Custom Title
Instead of "Vibe Architect" at level 30, set your own title.

---

## Addiction Loops

### Loop 1: Micro (every 5-30 seconds)
Code > chat reacts > you feel seen > combo meter builds > keep going

### Loop 2: Session (every 5-30 minutes)
Hit milestones > unlock things > random events fire > XP bar fills > "one more commit"

### Loop 3: Daily (brings you back tomorrow)
Daily streak > daily challenges > "your viewers are waiting" > login bonus (2x XP for 10 min)

### Loop 4: Career (weeks/months)
Level titles = identity > achievement hunting > prestige system > season badges

### Loop 5: Social (viral growth)
Status bar shows level + streak > shareable session recaps > "what's that extension?"

---

## What Moves From Vibe Buddy

**To VibeStream:**
- stream-chat-manager.ts
- viewer-generator.ts
- viewer-personas.ts
- session-analyzer.ts
- claude-conversation-watcher.ts
- All stream webview UI (chat, setup, profile cards, hype bar)
- Event system (editor, terminal, git, task events) — copied, VibeStream needs IDE awareness

**Stays in Vibe Buddy:**
- Buddy character (sprites, state machine, animations)
- Speech bubble reactions
- Personality system (hypeman, roaster, zen, sergeant)
- Smart reactor (Gemini one-liners)
- Brain / project memory
- Activity tracker, emotion detector, multi-convo analyzer

**Vibe Buddy cleanup:**
- Remove all stream-chat code
- Remove streamMode setting
- Remove setup screen, viewer bar
- Back to being just the coding companion character

---

## Build Priority

### Phase 1 — MVP (Stream Chat)
1. Scaffold new extension from vibe-buddy stream code
2. Setup screen (name, language, style)
3. Chat working with Gemini (Layer 1 + Layer 2)
4. Viewer generator with persistence
5. Profile cards
6. Settings (gear button)
7. Language realism system

### Phase 2 — Progression
1. XP engine + level system
2. XP bar in UI
3. Skill detection (prompt quality, review patterns, workflow)
4. Level-up animation + sound
5. Session recap score card

### Phase 3 — Engagement
1. Achievements system (30+)
2. Daily streak
3. Daily challenges
4. Combo meter
5. Random events (raids, sub trains, donations)

### Phase 4 — Monetization
1. LemonSqueezy integration
2. License validation
3. Free/Pro gating
4. Landing page

### Phase 5 — Polish
1. Cosmetics (themes, sounds, effects)
2. Chat speed modes
3. Viewer coaching (skill-aware LLM prompts)
4. Season system
5. Prestige system

---

## Sources & Research

- [Claude Code: Best practices for agentic coding](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Gemini Prompt Design Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)
- [OpenAI Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)
- [Vibe Coding 2026: Complete Guide](https://dev.to/pockit_tools/vibe-coding-in-2026-the-complete-guide-to-ai-pair-programming-that-actually-works-42de)
- [8 Vibe Coding Best Practices](https://www.softr.io/blog/vibe-coding-best-practices)

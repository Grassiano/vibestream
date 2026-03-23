from pydantic import BaseModel


# ═══ Chat Generation ═══

class ChatRequest(BaseModel):
    prompt: str
    max_tokens: int = 350
    temperature: float = 1.4


class ChatResponse(BaseModel):
    text: str | None
    tokens_used: int = 0


# ═══ License ═══

class LicenseValidateRequest(BaseModel):
    license_key: str


class LicenseValidateResponse(BaseModel):
    valid: bool
    tier: str
    features: list[str]


# ═══ Profile Sync ═══

class ProfileData(BaseModel):
    xp: int = 0
    level: int = 1
    streak_days: int = 0
    streak_last_date: str = ""
    prestige_count: int = 0
    achievements: list[str] = []
    total_sessions: int = 0
    total_watch_minutes: int = 0


class ProfileSyncRequest(BaseModel):
    license_key: str
    profile: ProfileData


class ProfileSyncResponse(BaseModel):
    profile: ProfileData
    synced: bool


# ═══ Session ═══

class SessionData(BaseModel):
    duration_minutes: int
    xp_earned: int
    score_rank: str
    skill_breakdown: dict[str, str]
    highlights: list[str]


class SessionSaveRequest(BaseModel):
    license_key: str
    session: SessionData


# ═══ Challenges ═══

class DailyChallenge(BaseModel):
    id: str
    title: str
    description: str
    category: str
    target: int
    xp_reward: int


class DailyChallengesResponse(BaseModel):
    challenges: list[DailyChallenge]
    date: str

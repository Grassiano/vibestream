from fastapi import APIRouter, Depends

from ..core.auth import get_current_user
from ..models.schemas import ProfileData, ProfileSyncRequest, ProfileSyncResponse

router = APIRouter(prefix="/api/profile", tags=["profile"])

# In-memory store for MVP — replace with Supabase in Phase 2
_profiles: dict[str, ProfileData] = {}


@router.post("/sync", response_model=ProfileSyncResponse)
async def sync_profile(
    req: ProfileSyncRequest,
    user: dict = Depends(get_current_user),
):
    """Sync profile data (XP, level, achievements) to server.

    Merge strategy: take the higher value for XP/level/streak,
    union for achievements.
    """
    if user.get("tier") != "pro":
        return ProfileSyncResponse(profile=req.profile, synced=False)

    key = req.license_key
    existing = _profiles.get(key, ProfileData())

    # Merge — take the higher/more complete value
    merged = ProfileData(
        xp=max(existing.xp, req.profile.xp),
        level=max(existing.level, req.profile.level),
        streak_days=max(existing.streak_days, req.profile.streak_days),
        streak_last_date=max(existing.streak_last_date, req.profile.streak_last_date),
        prestige_count=max(existing.prestige_count, req.profile.prestige_count),
        achievements=list(set(existing.achievements) | set(req.profile.achievements)),
        total_sessions=max(existing.total_sessions, req.profile.total_sessions),
        total_watch_minutes=max(existing.total_watch_minutes, req.profile.total_watch_minutes),
    )

    _profiles[key] = merged
    return ProfileSyncResponse(profile=merged, synced=True)


@router.get("/{license_key}", response_model=ProfileData)
async def get_profile(
    license_key: str,
    user: dict = Depends(get_current_user),
):
    """Get profile data for a license key."""
    return _profiles.get(license_key, ProfileData())

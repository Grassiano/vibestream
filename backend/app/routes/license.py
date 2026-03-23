from fastapi import APIRouter

from ..core.auth import validate_license
from ..models.schemas import LicenseValidateRequest, LicenseValidateResponse

router = APIRouter(prefix="/api/license", tags=["license"])

PRO_FEATURES = [
    "persistence",
    "xp_levels",
    "achievements",
    "daily_streak",
    "daily_challenges",
    "session_recap",
    "skill_trees",
    "cosmetics",
    "all_languages",
    "prestige",
    "profile_cards_full",
]

FREE_FEATURES = [
    "stream_chat",
    "viewer_reactions",
    "streamer_chat",
    "random_events",
    "combo_meter",
]


@router.post("/validate", response_model=LicenseValidateResponse)
async def validate(req: LicenseValidateRequest):
    """Validate a license key and return tier + features."""
    try:
        result = await validate_license(req.license_key)
        return LicenseValidateResponse(
            valid=True,
            tier="pro",
            features=FREE_FEATURES + PRO_FEATURES,
        )
    except Exception:
        return LicenseValidateResponse(
            valid=False,
            tier="free",
            features=FREE_FEATURES,
        )

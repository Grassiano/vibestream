from fastapi import APIRouter

from ..models.schemas import DailyChallengesResponse
from ..services.challenges import get_daily_challenges
from datetime import datetime, timezone

router = APIRouter(prefix="/api/challenges", tags=["challenges"])


@router.get("/daily", response_model=DailyChallengesResponse)
async def daily_challenges():
    """Get today's 3 daily challenges. Same for all users."""
    today = datetime.now(timezone.utc).date()
    challenges = get_daily_challenges(today)
    return DailyChallengesResponse(
        challenges=challenges,
        date=today.isoformat(),
    )

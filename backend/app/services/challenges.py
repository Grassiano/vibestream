import hashlib
from datetime import date, timezone, datetime

from ..models.schemas import DailyChallenge

# All possible challenges — server picks 3 per day deterministically
ALL_CHALLENGES: list[dict] = [
    # Prompting
    {"id": "efficient_communicator", "title": "Efficient Communicator", "description": "3 prompts under 50 words that work first try", "category": "prompting", "target": 3, "xp_reward": 75},
    {"id": "sniper", "title": "Sniper", "description": "5 one-shot successes (no follow-up needed)", "category": "prompting", "target": 5, "xp_reward": 75},
    {"id": "context_king", "title": "Context King", "description": "Include error messages in 5 error-related prompts", "category": "prompting", "target": 5, "xp_reward": 75},
    {"id": "constraint_crafter", "title": "Constraint Crafter", "description": "Use constraints (don't, without, avoid) in 3 prompts", "category": "prompting", "target": 3, "xp_reward": 75},
    # Review
    {"id": "eagle_eye", "title": "Eagle Eye", "description": "Edit AI code within 30s of landing, 5 times", "category": "review", "target": 5, "xp_reward": 75},
    {"id": "zero_regret", "title": "Zero Regret", "description": "Full session with 0 error loops", "category": "review", "target": 1, "xp_reward": 75},
    {"id": "quality_gate", "title": "Quality Gate", "description": "Build/test after every AI code landing", "category": "review", "target": 1, "xp_reward": 75},
    {"id": "clean_accept", "title": "Clean Accept", "description": "Accept AI code 3 times with no errors after", "category": "review", "target": 3, "xp_reward": 75},
    # Workflow
    {"id": "atomic_coder", "title": "Atomic Coder", "description": "5 commits with less than 30 lines each", "category": "workflow", "target": 5, "xp_reward": 75},
    {"id": "ship_shape", "title": "Ship Shape", "description": "3 clean pipelines (commit > build > push, 0 errors)", "category": "workflow", "target": 3, "xp_reward": 75},
    {"id": "git_discipline", "title": "Git Discipline", "description": "Commit before every major change", "category": "workflow", "target": 3, "xp_reward": 75},
    {"id": "wordsmith", "title": "Wordsmith", "description": "5 commits with descriptive messages (15+ chars)", "category": "workflow", "target": 5, "xp_reward": 75},
    # Focus
    {"id": "flow_state", "title": "Flow State", "description": "30 min uninterrupted coding", "category": "focus", "target": 1, "xp_reward": 75},
    {"id": "marathon_lite", "title": "Marathon Lite", "description": "Code for 90+ minutes in one session", "category": "focus", "target": 1, "xp_reward": 75},
    {"id": "smart_break", "title": "Smart Break", "description": "Take a break when your error rate climbs", "category": "focus", "target": 1, "xp_reward": 75},
    {"id": "single_focus", "title": "Single Focus", "description": "Work on one file for 15 minutes straight", "category": "focus", "target": 1, "xp_reward": 75},
]


def get_daily_challenges(for_date: date | None = None) -> list[DailyChallenge]:
    """Deterministically pick 3 challenges for a given date.

    Same date = same challenges for all users worldwide.
    """
    if for_date is None:
        for_date = datetime.now(timezone.utc).date()

    seed = hashlib.md5(for_date.isoformat().encode()).hexdigest()
    seed_int = int(seed, 16)

    # Pick 3 from different categories when possible
    categories = ["prompting", "review", "workflow", "focus"]
    picked: list[DailyChallenge] = []
    used_categories: set[str] = set()

    # Shuffle deterministically
    sorted_challenges = sorted(
        ALL_CHALLENGES,
        key=lambda c: hashlib.md5(f"{seed}{c['id']}".encode()).hexdigest(),
    )

    for c in sorted_challenges:
        if len(picked) >= 3:
            break
        if c["category"] not in used_categories or len(picked) < 3:
            used_categories.add(c["category"])
            picked.append(DailyChallenge(**c))

    return picked[:3]

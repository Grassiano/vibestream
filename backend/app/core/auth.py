from fastapi import Header, HTTPException
import httpx

from .config import settings

# Cache validated licenses for 5 minutes to avoid hammering LemonSqueezy
_license_cache: dict[str, dict] = {}
_cache_ttl = 300  # seconds
import time


async def validate_license(license_key: str) -> dict:
    """Validate a license key against LemonSqueezy API. Returns user info."""
    now = time.time()
    cached = _license_cache.get(license_key)
    if cached and now - cached["_cached_at"] < _cache_ttl:
        return cached

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.lemonsqueezy.com/v1/licenses/validate",
            json={"license_key": license_key},
            headers={"Accept": "application/json"},
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid license key")

    data = resp.json()
    if not data.get("valid"):
        raise HTTPException(status_code=401, detail="License key is not active")

    result = {
        "license_key": license_key,
        "user_email": data.get("meta", {}).get("customer_email", ""),
        "user_name": data.get("meta", {}).get("customer_name", ""),
        "variant": data.get("meta", {}).get("variant_name", "pro"),
        "valid": True,
        "_cached_at": now,
    }
    _license_cache[license_key] = result
    return result


async def get_current_user(
    x_license_key: str = Header(default="", alias="X-License-Key"),
) -> dict:
    """FastAPI dependency — extracts and validates license from header."""
    if not x_license_key:
        # Free tier — no license
        return {"tier": "free", "license_key": ""}

    user = await validate_license(x_license_key)
    user["tier"] = "pro"
    return user

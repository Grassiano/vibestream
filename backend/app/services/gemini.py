import httpx

from ..core.config import settings

GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{settings.gemini_model}:generateContent"
)


async def generate_chat(
    prompt: str,
    max_tokens: int = 350,
    temperature: float = 1.4,
) -> tuple[str | None, int]:
    """Call Gemini Flash and return (text, tokens_used)."""
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": temperature,
        },
    }

    async with httpx.AsyncClient(timeout=6.0) as client:
        resp = await client.post(
            f"{GEMINI_URL}?key={settings.google_api_key}",
            json=body,
        )

    if resp.status_code != 200:
        return None, 0

    data = resp.json()
    text = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text")
    )
    tokens = (
        data.get("usageMetadata", {}).get("totalTokenCount", 0)
    )
    return text, tokens

from fastapi import APIRouter, Depends

from ..core.auth import get_current_user
from ..models.schemas import ChatRequest, ChatResponse
from ..services.gemini import generate_chat

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest, user: dict = Depends(get_current_user)):
    """Proxy Gemini Flash for stream chat generation.

    Free tier: works but rate-limited (handled by middleware).
    Pro tier: full access.
    """
    text, tokens = await generate_chat(
        prompt=req.prompt,
        max_tokens=req.max_tokens,
        temperature=req.temperature,
    )
    return ChatResponse(text=text, tokens_used=tokens)

from typing import List, Optional

from pydantic import BaseModel, Field


class SocialDraftRequest(BaseModel):
    """Context for generating social media post drafts."""

    model_config = {"extra": "ignore"}

    diff: str = ""
    review_summary: str = ""
    findings: List[dict] = Field(default_factory=list)
    repo_name: str = ""
    repo_voice: str = ""
    pr_title: str = ""
    pr_number: int = 0
    changed_files: List[str] = Field(default_factory=list)
    author: str = ""
    standalone_input: Optional[str] = None  # non-empty for standalone (non-PR) posts
    openai_api_key: Optional[str] = None  # BYOK key if provided by user


class SocialDraftResponse(BaseModel):
    """Generated drafts for X, LinkedIn, Instagram, and Facebook, plus DALL-E generated banner image."""

    x_draft: str
    linkedin_draft: str
    instagram_draft: str
    facebook_draft: str
    image_url: Optional[str] = None

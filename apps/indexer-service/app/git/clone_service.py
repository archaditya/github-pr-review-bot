"""
Git clone service. Handles shallow cloning of repositories using GitHub App installation tokens.
Clones are temporary — stored in /tmp/repos/{repo_id} and cleaned up after indexing.
"""

import logging
import os
import shutil
from pathlib import Path

from git import Repo

from ..core.config import settings

logger = logging.getLogger(__name__)


def clone_repository(
    owner: str,
    repo: str,
    token: str,
    repo_id: str,
    branch: str = "main",
) -> Path:
    """
    Shallow clone a repository using a GitHub App installation token.
    Returns the path to the cloned repository.

    Args:
        owner: Repository owner (e.g., "archaditya")
        repo: Repository name (e.g., "vps-infra-configs")
        token: GitHub App installation access token
        repo_id: UUID for namespacing the clone directory
        branch: Branch to clone (default: "main")
    """
    clone_dir = Path(settings.clone_workspace) / repo_id
    clone_url = f"https://x-access-token:{token}@github.com/{owner}/{repo}.git"

    # Clean up any stale clone from a previous failed run
    if clone_dir.exists():
        shutil.rmtree(clone_dir, ignore_errors=True)

    clone_dir.mkdir(parents=True, exist_ok=True)

    logger.info("cloning %s/%s (branch: %s) → %s", owner, repo, branch, clone_dir)

    try:
        Repo.clone_from(
            clone_url,
            str(clone_dir),
            branch=branch,
            depth=1,  # Shallow clone — we only need HEAD
            single_branch=True,
            no_checkout=False,
        )
    except Exception as exc:
        # If branch doesn't exist, try without specifying branch (default branch)
        logger.warning("clone with branch '%s' failed, retrying with default: %s", branch, exc)
        if clone_dir.exists():
            shutil.rmtree(clone_dir, ignore_errors=True)
        clone_dir.mkdir(parents=True, exist_ok=True)
        Repo.clone_from(
            clone_url,
            str(clone_dir),
            depth=1,
            single_branch=True,
            no_checkout=False,
        )

    logger.info("clone complete: %s", clone_dir)
    return clone_dir


def get_head_sha(clone_dir: Path) -> str:
    """Return the HEAD commit SHA of a cloned repository."""
    repo = Repo(str(clone_dir))
    return repo.head.commit.hexsha


def cleanup_clone(repo_id: str) -> None:
    """Remove the temporary clone directory."""
    clone_dir = Path(settings.clone_workspace) / repo_id
    if clone_dir.exists():
        shutil.rmtree(clone_dir, ignore_errors=True)
        logger.info("cleaned up clone: %s", clone_dir)

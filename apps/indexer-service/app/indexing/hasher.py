"""
SHA256 content hashing for incremental indexing.
If a file's hash hasn't changed since last index, we skip re-processing it.
"""

import hashlib


def compute_content_hash(content: str) -> str:
    """Return the SHA256 hex digest of the given content string."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def compute_file_hash(file_path: str) -> str:
    """Compute SHA256 hash of a file on disk."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

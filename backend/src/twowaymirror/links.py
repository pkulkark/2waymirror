"""The public links this project hands out.

One place, because the same link is printed by `2wm create`, seeded by scripts/seed.py and
written into submission emails, and a company that is sent one shape and emailed another has
no way to tell they are the same session.
"""

from __future__ import annotations

from twowaymirror.settings import Settings


def session_link(settings: Settings, token: str) -> str:
    """The company-facing session link: the public base URL, then /s/<token>."""
    return f"{settings.TWM_PUBLIC_BASE_URL.rstrip('/')}/s/{token}"

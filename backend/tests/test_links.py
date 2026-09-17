from __future__ import annotations

import pytest

from twowaymirror.links import session_link
from twowaymirror.settings import Settings


@pytest.mark.parametrize("base_url", ["https://2wm.example.com", "https://2wm.example.com/"])
def test_session_link_does_not_double_the_slash(base_url: str) -> None:
    settings = Settings(_env_file=None, TWM_PUBLIC_BASE_URL=base_url)

    assert session_link(settings, "abc") == "https://2wm.example.com/s/abc"

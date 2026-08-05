"""One-off helper: strip Cursor co-author lines from git history."""
from __future__ import annotations

import re

from git_filter_repo import FilteringOptions, RepoFilter


def message_callback(message: bytes, metadata=None) -> bytes:
    message = re.sub(
        rb"\nCo-authored-by: Cursor <cursoragent@cursor.com>\s*",
        b"\n",
        message,
    )
    return message.strip() + b"\n"


if __name__ == "__main__":
    args = FilteringOptions.parse_args(["--force"])
    RepoFilter(args, message_callback=message_callback).run()

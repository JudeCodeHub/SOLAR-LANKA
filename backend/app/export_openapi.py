"""Write the API's OpenAPI document as JSON."""

import json
import sys
from pathlib import Path

from app.core.config import Settings
from app.main import create_app


def openapi_document() -> dict:
    # A throwaway test-mode configuration: only route definitions matter here.
    return create_app(Settings(_env_file=None, environment="test")).openapi()


def main() -> None:
    text = json.dumps(openapi_document(), indent=2, sort_keys=True) + "\n"
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()

"""The exported OpenAPI document is what the frontend client types are generated from."""

import json
import subprocess
import sys

from app.export_openapi import openapi_document


def test_export_is_the_served_document_and_deterministic():
    first = json.dumps(openapi_document(), sort_keys=True)
    assert first == json.dumps(openapi_document(), sort_keys=True)
    assert "/users/me" in json.loads(first)["paths"]


def test_command_writes_valid_json_without_credentials(tmp_path):
    target = tmp_path / "openapi.json"
    result = subprocess.run(
        [sys.executable, "-m", "app.export_openapi", str(target)],
        capture_output=True,
        text=True,
        env={"PATH": "/usr/bin:/bin", "PYTHONPATH": "."},
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(target.read_text())["info"]["title"]

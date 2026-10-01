"""Keep the generated OpenAPI document accurate about which errors each route can return.

Every route inherits the full shared error list from the application factory. Trim the
entries a route cannot produce so clients are not told a public route needs a token or
that an unlimited route may answer 429.
"""

from fastapi import FastAPI

ALWAYS_DROPPED = frozenset({"405"})


def install_openapi_cleanup(
    application: FastAPI, *, rate_limited: frozenset[tuple[str, str]]
) -> None:
    """`rate_limited` holds (METHOD, path) pairs guarded by request protection."""
    generate = application.openapi
    cleaned = False

    def openapi() -> dict:
        nonlocal cleaned
        schema = generate()
        if cleaned:
            return schema
        for path, operations in schema["paths"].items():
            for method, operation in operations.items():
                responses = operation["responses"]
                dropped = set(ALWAYS_DROPPED)
                limited = (method.upper(), path) in rate_limited
                if "security" not in operation:
                    dropped.add("401")
                    # Only a bot denial on a rate-limited public route is a 403.
                    if not limited:
                        dropped.add("403")
                if not limited:
                    dropped.add("429")
                for code in dropped:
                    responses.pop(code, None)
        cleaned = True
        return schema

    application.openapi = openapi  # type: ignore[method-assign]

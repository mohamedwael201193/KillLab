"""HTTP client for the official Bitget MCP endpoints.

Cloudflare rejects Python's default user agent before the request reaches the
service. The browser-like agent below is a transport requirement, not a secret.
No account key is sent.
"""

from __future__ import annotations

import hashlib
import json
import threading
import time
from typing import Callable

import httpx

_SESSION_GATE = threading.Lock()

PROTOCOL = "2024-11-05"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


class McpError(RuntimeError):
    def __init__(self, reason: str, kind: str = "transport_error"):
        super().__init__(reason)
        self.reason = reason
        self.kind = kind


Send = Callable[[str, dict, str | None, float], tuple[int, dict, str]]


def unframe(text: str) -> dict:
    lines = text.splitlines()
    data = [line[6:] for line in lines if line.startswith("data: ")]
    raw = "".join(data) if data else text
    if not raw.strip():
        return {}
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise McpError("mcp payload was not an object", kind="malformed_response")
    return payload


def _http_send(url: str, payload: dict, session: str | None, timeout: float) -> tuple[int, dict, str]:
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "User-Agent": USER_AGENT,
    }
    if session:
        headers["mcp-session-id"] = session
    try:
        response = httpx.post(
            url,
            json=payload,
            headers=headers,
            timeout=httpx.Timeout(timeout, connect=min(5.0, timeout), write=min(10.0, timeout), pool=5.0),
        )
    except httpx.TimeoutException as exc:
        raise McpError("timeout", kind="timeout") from exc
    except httpx.HTTPError as exc:
        raise McpError(f"upstream unavailable: {type(exc).__name__}", kind="transport_error") from exc
    return response.status_code, {k.lower(): v for k, v in response.headers.items()}, response.text


def _http_close(url: str, session: str) -> None:
    """Release the session. Leaving it open is what the host counts as too many sessions."""
    headers = {
        "Accept": "application/json, text/event-stream",
        "User-Agent": USER_AGENT,
        "mcp-session-id": session,
    }
    try:
        httpx.request("DELETE", url, headers=headers, timeout=8)
    except httpx.HTTPError:
        return


def _raise_for_status(status: int, body: str) -> None:
    if status < 400:
        return
    if status == 503:
        if "session" in body.lower():
            raise McpError("too many open sessions", kind="session_error")
        raise McpError("upstream unavailable", kind="transport_error")
    if status in {408, 504}:
        raise McpError("timeout", kind="timeout")
    raise McpError(f"upstream HTTP {status}", kind="transport_error")


def call_tool(
    url: str,
    name: str,
    arguments: dict | None = None,
    *,
    timeout: float = 18.0,
    retries: int = 2,
    send: Send | None = None,
) -> dict:
    """Open one session, call one tool, and return the parsed JSON body."""
    transport = send or _http_send
    last = "not attempted"
    last_kind = "transport_error"
    attempts = max(1, retries)
    retryable = {"timeout", "upstream unavailable", "too many open sessions"}
    with _SESSION_GATE:
        for attempt in range(attempts):
            try:
                return _once(url, name, arguments or {}, timeout, transport, close=_http_close if send is None else None)
            except McpError as exc:
                last = exc.reason
                last_kind = exc.kind
                if attempt + 1 >= attempts:
                    break
                if exc.kind not in {"timeout", "session_error", "transport_error"} and exc.reason not in retryable:
                    break
                if send is None:
                    time.sleep(0.5 * (2 ** attempt))
    raise McpError(last, kind=last_kind)


def _once(url: str, name: str, arguments: dict, timeout: float, send: Send, close=None) -> dict:
    session = None
    try:
        status, headers, body = send(
            url,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": PROTOCOL,
                    "capabilities": {},
                    "clientInfo": {"name": "killlab", "version": "1"},
                },
            },
            None,
            timeout,
        )
        _raise_for_status(status, body)
        session = headers.get("mcp-session-id")
        if session:
            send(url, {"jsonrpc": "2.0", "method": "notifications/initialized"}, session, timeout)
        status, _, body = send(
            url,
            {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": name, "arguments": arguments}},
            session,
            timeout,
        )
        _raise_for_status(status, body)
        try:
            payload = unframe(body)
        except json.JSONDecodeError as exc:
            raise McpError("malformed response", kind="malformed_response") from exc
        if payload.get("error"):
            raise McpError(str(payload["error"])[:180], kind="tool_error")
        result_obj = payload.get("result") or {}
        content = result_obj.get("content") or []
        if not isinstance(content, list):
            raise McpError("malformed response", kind="malformed_response")
        if not content:
            raise McpError("empty result", kind="empty_result")
        text = content[0].get("text", "") if isinstance(content[0], dict) else ""
        if result_obj.get("isError") is True:
            raise McpError((text or "tool error")[:180], kind="tool_error")
        if not isinstance(text, str) or not text.strip():
            raise McpError("empty result", kind="empty_result")
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            data = {"text": text[:500]}
        if isinstance(data, dict) and data.get("success") is False:
            raise McpError(f"upstream unavailable: {str(data.get('error') or '')[:120]}", kind="tool_error")
        if not isinstance(data, (dict, list)):
            raise McpError("malformed response", kind="malformed_response")
        digest = hashlib.sha256(text[:2048].encode("utf-8", errors="replace")).hexdigest()
        return {"data": data, "reply_sha256": digest}
    finally:
        if session and close is not None:
            close(url, session)

"""Tests for T6.8, T6.9, T6.10, T6.12 -- error handling and I/O safety."""

import asyncio
import base64
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.runtime import _classify_error


# ---------------------------------------------------------------------------
# T6.9: Error classification
# ---------------------------------------------------------------------------


class TestClassifyError:
    """_classify_error returns user-friendly messages."""

    def test_rate_limit_by_message(self):
        exc = Exception("rate_limit_error: too many requests")
        assert "rate limited" in _classify_error(exc).lower()

    def test_rate_limit_overloaded(self):
        exc = Exception("API overloaded")
        assert "rate limited" in _classify_error(exc).lower()

    def test_auth_by_message(self):
        exc = Exception("authentication failed: invalid api key")
        assert "api key issue" in _classify_error(exc).lower()

    def test_connection_by_message(self):
        exc = Exception("connection refused by upstream")
        assert "connection error" in _classify_error(exc).lower()

    def test_generic_error_passthrough(self):
        exc = Exception("something weird happened")
        assert _classify_error(exc) == "something weird happened"

    def test_anthropic_rate_limit_type(self):
        """If anthropic types are available, isinstance check works."""
        try:
            from anthropic import RateLimitError
            # Create a mock response for the error
            mock_response = MagicMock()
            mock_response.status_code = 429
            exc = RateLimitError(response=mock_response, body=None, message="rate limited")
            assert "rate limited" in _classify_error(exc).lower()
        except ImportError:
            pytest.skip("anthropic not installed")

    def test_anthropic_auth_error_type(self):
        try:
            from anthropic import AuthenticationError
            mock_response = MagicMock()
            mock_response.status_code = 401
            exc = AuthenticationError(response=mock_response, body=None, message="invalid key")
            assert "api key issue" in _classify_error(exc).lower()
        except ImportError:
            pytest.skip("anthropic not installed")


# ---------------------------------------------------------------------------
# T6.10: Guard _send_error on dead connection
# ---------------------------------------------------------------------------


class TestExtractionErrorGuard:
    """_send_error failure in extraction path does not cause unhandled exception."""

    @pytest.fixture
    def gateway(self):
        from src.gateway import SpriteGateway

        send_fn = AsyncMock()
        runtime = MagicMock()
        runtime.handle_message = AsyncMock()
        gw = SpriteGateway(send_fn=send_fn, runtime=runtime)
        gw._workspace_db = AsyncMock()
        return gw

    async def test_send_error_on_dead_connection(self, gateway):
        """When extraction fails and connection is dead, error is logged, not raised."""
        gateway.runtime.handle_message.side_effect = Exception("extraction boom")
        gateway.send = AsyncMock(side_effect=ConnectionResetError("connection dead"))

        # Should NOT raise -- the error guard catches the ConnectionResetError
        await gateway._run_extraction("doc1", "test.pdf", "application/pdf", "/tmp/test.pdf")

    async def test_send_error_on_live_connection(self, gateway):
        """When extraction fails and connection is live, error is sent to user."""
        gateway.runtime.handle_message.side_effect = Exception("extraction boom")
        gateway.send = AsyncMock()

        await gateway._run_extraction("doc1", "test.pdf", "application/pdf", "/tmp/test.pdf")

        # _send_error should have been called (sends a system error message)
        calls = [c for c in gateway.send.call_args_list if "error" in str(c)]
        assert len(calls) > 0


# ---------------------------------------------------------------------------
# T6.8: Large file writes in asyncio.to_thread
# ---------------------------------------------------------------------------


class TestLargeFileOffload:
    """Large file writes (>1MB) use asyncio.to_thread."""

    @pytest.fixture
    def gateway(self):
        from src.gateway import SpriteGateway

        send_fn = AsyncMock()
        runtime = MagicMock()
        gw = SpriteGateway(send_fn=send_fn, runtime=runtime)
        gw._workspace_db = AsyncMock()
        gw._send_canvas_processing_card = AsyncMock()
        gw._send_ack = AsyncMock()
        return gw

    async def test_large_file_uses_thread(self, gateway, tmp_path):
        """Files >1MB are written via asyncio.to_thread."""
        large_data = b"x" * (2 * 1024 * 1024)  # 2MB
        data_b64 = base64.b64encode(large_data).decode()

        msg = {
            "type": "file_upload",
            "payload": {"filename": "big.bin", "mime_type": "application/octet-stream", "data": data_b64},
        }

        with patch("src.gateway.Path") as MockPath, \
             patch("asyncio.to_thread", new_callable=AsyncMock) as mock_thread:
            mock_dir = MagicMock()
            mock_file_path = MagicMock()
            MockPath.return_value = mock_dir
            mock_dir.__truediv__ = MagicMock(return_value=mock_file_path)

            # Patch base64.b64decode to return our large bytes
            with patch("src.gateway.base64.b64decode", return_value=large_data):
                await gateway._handle_file_upload(msg, "req1")

            mock_thread.assert_called_once_with(mock_file_path.write_bytes, large_data)

    async def test_small_file_no_thread(self, gateway, tmp_path):
        """Files <=1MB are written synchronously."""
        small_data = b"x" * 100
        data_b64 = base64.b64encode(small_data).decode()

        msg = {
            "type": "file_upload",
            "payload": {"filename": "small.bin", "mime_type": "text/plain", "data": data_b64},
        }

        with patch("src.gateway.Path") as MockPath, \
             patch("asyncio.to_thread", new_callable=AsyncMock) as mock_thread:
            mock_dir = MagicMock()
            mock_file_path = MagicMock()
            MockPath.return_value = mock_dir
            mock_dir.__truediv__ = MagicMock(return_value=mock_file_path)

            with patch("src.gateway.base64.b64decode", return_value=small_data):
                await gateway._handle_file_upload(msg, "req1")

            mock_thread.assert_not_called()
            mock_file_path.write_bytes.assert_called_once_with(small_data)


# ---------------------------------------------------------------------------
# T6.12: Upload path error handling
# ---------------------------------------------------------------------------


class TestUploadErrorHandling:
    """Base64 decode and file write errors are caught and reported."""

    @pytest.fixture
    def gateway(self):
        from src.gateway import SpriteGateway

        send_fn = AsyncMock()
        runtime = MagicMock()
        gw = SpriteGateway(send_fn=send_fn, runtime=runtime)
        gw._workspace_db = AsyncMock()
        gw._send_canvas_processing_card = AsyncMock()
        gw._send_ack = AsyncMock()
        return gw

    async def test_invalid_base64_caught(self, gateway):
        """Invalid base64 data is caught and error sent to user."""
        msg = {
            "type": "file_upload",
            "payload": {"filename": "bad.pdf", "mime_type": "application/pdf", "data": "!!!not-base64!!!"},
        }

        with patch("src.gateway.Path") as MockPath:
            mock_dir = MagicMock()
            MockPath.return_value = mock_dir
            mock_dir.__truediv__ = MagicMock(return_value=MagicMock())

            # Should not raise
            await gateway._handle_file_upload(msg, "req1")

        # send_ack should NOT have been called (returned early)
        gateway._send_ack.assert_not_called()

    async def test_write_error_caught(self, gateway):
        """OSError on write is caught and error sent to user."""
        small_data = b"hello"
        data_b64 = base64.b64encode(small_data).decode()

        msg = {
            "type": "file_upload",
            "payload": {"filename": "test.txt", "mime_type": "text/plain", "data": data_b64},
        }

        with patch("src.gateway.Path") as MockPath:
            mock_dir = MagicMock()
            mock_file_path = MagicMock()
            mock_file_path.write_bytes.side_effect = OSError("disk full")
            MockPath.return_value = mock_dir
            mock_dir.__truediv__ = MagicMock(return_value=mock_file_path)

            with patch("src.gateway.base64.b64decode", return_value=small_data):
                await gateway._handle_file_upload(msg, "req1")

        # send_ack should NOT have been called (returned early)
        gateway._send_ack.assert_not_called()

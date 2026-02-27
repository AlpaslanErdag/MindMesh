"""Sandboxed code execution via Docker containers.

Code is NEVER executed on the host OS.
Each execution spins up a fresh, isolated container.
"""

import asyncio
import tempfile
from pathlib import Path
from typing import Any

import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)


async def run_code_in_sandbox(code: str, language: str = "python") -> dict[str, Any]:
    settings = get_settings()

    if language != "python":
        raise ValueError(f"Language '{language}' is not supported. Only 'python' is allowed.")

    with tempfile.TemporaryDirectory() as tmpdir:
        script_path = Path(tmpdir) / "script.py"
        script_path.write_text(code)

        cmd = [
            "docker", "run",
            "--rm",
            "--network=none",
            f"--memory={settings.sandbox_memory_limit}",
            "--cpus=0.5",
            "--read-only",
            "--tmpfs=/tmp:size=64m",
            "-v", f"{script_path}:/sandbox/script.py:ro",
            settings.sandbox_image,
            "python", "/sandbox/script.py",
        ]

        logger.info("sandbox_exec_start", language=language, code_length=len(code))

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(),
                timeout=settings.sandbox_timeout_seconds,
            )
            return {
                "exit_code": proc.returncode,
                "stdout": stdout.decode("utf-8", errors="replace"),
                "stderr": stderr.decode("utf-8", errors="replace"),
                "success": proc.returncode == 0,
            }
        except asyncio.TimeoutError:
            proc.kill()
            return {
                "exit_code": -1,
                "stdout": "",
                "stderr": f"Execution timed out after {settings.sandbox_timeout_seconds}s",
                "success": False,
            }
        except FileNotFoundError:
            return {
                "exit_code": -1,
                "stdout": "",
                "stderr": "Docker is not available in this environment.",
                "success": False,
            }

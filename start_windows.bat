@echo off
cd /d "%~dp0"
where py >nul 2>&1
if not errorlevel 1 (
    py -3 server.py
    goto finish
)
where python >nul 2>&1
if not errorlevel 1 (
    python server.py
    goto finish
)
echo Python 3 is required. Install it from https://www.python.org/downloads/
echo Make sure to tick "Add Python to PATH" during installation.
:finish
pause

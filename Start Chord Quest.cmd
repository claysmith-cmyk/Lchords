@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install it from https://nodejs.org
  pause
  exit /b 1
)
echo Open http://localhost:4173 in Chrome or Edge after the server starts.
echo Press Ctrl+C here when finished to stop the game server.
node server.js
pause

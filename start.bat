@echo off
title The Chronicle
color 0A

echo.
echo  ══════════════════════════════════════
echo    THE CHRONICLE — Starting up...
echo  ══════════════════════════════════════
echo.

:: Start Kokoro TTS server in background
echo  [1/3] Starting Kokoro TTS server...
start "Kokoro TTS" /min python C:\Users\dzrik\kokoro_server.py

:: Wait a moment for Kokoro to initialize
timeout /t 3 /nobreak >nul

:: Start Chronicle Express server in background
echo  [2/3] Starting Chronicle server...
start "Chronicle Server" /min cmd /k "cd /d %~dp0 && node chronicle-server.js"

:: Wait for Express to initialize
timeout /t 2 /nobreak >nul

:: Open browser
echo  [3/3] Opening browser...
start http://localhost:3000

echo.
echo  ══════════════════════════════════════
echo    The Chronicle is running.
echo    Close the Kokoro and Chronicle
echo    terminal windows to shut down.
echo  ══════════════════════════════════════
echo.
pause
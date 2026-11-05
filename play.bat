@echo off
REM Launches the local backend (if Python is installed) and the game.
REM Set GODOT to your Godot 4.5.1 executable path if it's not on PATH.
if "%GODOT%"=="" set GODOT=Godot_v4.5.1-stable_win64.exe
cd /d "%~dp0"
where python >nul 2>nul && start "Anti-Magic backend" /min python backend\server.py
"%GODOT%" --path game

@echo off
REM Quick setup script for WC 2026 Leaderboard Service

echo.
echo ===================================
echo WC 2026 Leaderboard Service Setup
echo ===================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    echo Then run this script again.
    pause
    exit /b 1
)

echo [OK] Node.js found
node --version

echo.
echo Installing dependencies...
call npm install

if %errorlevel% neq 0 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)

echo [OK] Dependencies installed

echo.
echo ===================================
echo Setup complete!
echo ===================================
echo.
echo To start the server, run:
echo   npm start
echo.
echo Then open in your browser:
echo   http://localhost:3000
echo.
echo To stop the server, press Ctrl+C
echo.
pause

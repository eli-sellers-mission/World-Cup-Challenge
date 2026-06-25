@echo off
REM Start the WC 2026 Leaderboard Service

echo Starting WC 2026 Leaderboard Service...
echo.
echo Opening browser to http://localhost:3000
echo (It may take a few seconds to start)
echo.
echo Press Ctrl+C to stop the server
echo.

timeout /t 2 /nobreak

start http://localhost:3000

npm start

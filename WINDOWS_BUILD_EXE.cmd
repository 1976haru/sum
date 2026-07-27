@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo [SUM Playlist Studio] Windows 무설치 EXE 빌드
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js LTS가 필요합니다.
  pause
  exit /b 1
)

if not exist node_modules call npm install
if errorlevel 1 goto :error

call npm run dist:win
if errorlevel 1 goto :error

echo.
echo 빌드가 완료되었습니다. release 폴더를 확인하세요.
start "" "%~dp0release"
pause
exit /b 0

:error
echo 빌드 중 오류가 발생했습니다.
pause
exit /b 1

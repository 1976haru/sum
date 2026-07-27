@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo [SUM Playlist Studio] 실행 준비 중...
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js가 설치되어 있지 않습니다.
  echo https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  pause
  exit /b 1
)

if not exist node_modules (
  echo 처음 실행이라 필요한 파일을 설치합니다. 잠시 기다려 주세요.
  call npm install
  if errorlevel 1 goto :error
)

call npm run dev
exit /b 0

:error
echo 실행 준비 중 오류가 발생했습니다.
pause
exit /b 1

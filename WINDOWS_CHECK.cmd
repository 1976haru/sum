@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   SUM Playlist Studio - Windows 점검 스크립트
echo ============================================
echo.

echo [1/6] Node.js 버전 확인
where node >nul 2>nul
if errorlevel 1 (
  echo   [실패] Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 설치하세요.
  goto :fail
)
node --version
echo.

echo [2/6] 의존성 설치 확인
if not exist node_modules (
  echo   node_modules가 없어 npm install을 실행합니다...
  call npm install
  if errorlevel 1 goto :fail
) else (
  echo   node_modules 존재 확인됨.
)
echo.

echo [3/6] 타입 검사
call npm run typecheck
if errorlevel 1 goto :fail
echo.

echo [4/6] 유닛 테스트
call npm test
if errorlevel 1 goto :fail
echo.

echo [5/6] 프로덕션 빌드
call npm run build
if errorlevel 1 goto :fail
echo.

echo [6/6] 실제 출력물 확인 ^(테스트만으로는 안 보이는 부분^)
call npm run dump
if errorlevel 1 goto :fail
echo.

echo ============================================
echo   전부 통과했습니다.
echo ============================================
goto :end

:fail
echo.
echo ============================================
echo   점검 실패 - 위 로그를 확인하세요.
echo ============================================
exit /b 1

:end
endlocal

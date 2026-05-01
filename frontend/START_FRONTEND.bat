@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo   WEBBANHANG - START FRONTEND (VITE)
echo ==========================================
echo.

set "NPM_CMD="
if exist "C:\Program Files\nodejs\npm.cmd" (
  set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
) else if exist "C:\Progra~1\nodejs\npm.cmd" (
  set "NPM_CMD=C:\Progra~1\nodejs\npm.cmd"
) else (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Khong tim thay npm. Hay cai Node.js truoc.
    echo Download: https://nodejs.org/
    pause
    exit /b 1
  )
  set "NPM_CMD=npm"
)

if not exist "node_modules" (
  echo [INFO] Chua co node_modules, dang cai dependencies...
  call "%NPM_CMD%" install
  if errorlevel 1 (
    echo [ERROR] Cai dependencies that bai.
    pause
    exit /b 1
  )
)

echo [INFO] Dang chay frontend tai http://localhost:5173
echo [INFO] Nhan Ctrl + C de dung.
echo.
call "%NPM_CMD%" run dev

endlocal

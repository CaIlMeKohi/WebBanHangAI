@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"
echo ==========================================
echo   WEBBANHANG - START ALL IN ONE FILE
echo ==========================================
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Khong tim thay Docker Desktop / docker trong PATH.
  echo [HINT] Hay cai dat va khoi dong Docker truoc khi chay file nay.
  exit /b 1
)

echo [INFO] Khoi dong SQL Server tren Docker...
docker compose up -d || goto :error

echo [INFO] Khoi dong backend + frontend tren cung localhost...
call backend\START_BACKEND.bat || goto :error

goto :eof

:error
echo.
echo [ERROR] Script dung do co loi o buoc tren.
exit /b 1
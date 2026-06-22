@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"
echo ==========================================
echo   WEBBANHANG - START ALL IN ONE FILE
echo ==========================================
echo.

set "USE_DOCKER_SQLSERVER=False"
if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /i "%%A"=="USE_DOCKER_SQLSERVER" set "USE_DOCKER_SQLSERVER=%%B"
  )
)

if /i "%USE_DOCKER_SQLSERVER%"=="True" (
  where docker >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Khong tim thay Docker Desktop / docker trong PATH.
    echo [HINT] Hay cai dat va khoi dong Docker truoc khi chay file nay.
    exit /b 1
  )
  echo [INFO] Khoi dong SQL Server tren Docker...
  docker compose up -d || goto :error
) else (
  echo [INFO] Su dung SQL Server da cau hinh trong .env, bo qua Docker.
)

echo [INFO] Khoi dong backend + frontend tren cung localhost...
call backend\START_BACKEND.bat || goto :error

goto :eof

:error
echo.
echo [ERROR] Script dung do co loi o buoc tren.
exit /b 1

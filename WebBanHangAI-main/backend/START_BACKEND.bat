@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"
echo ==========================================
echo   WEBBANHANG - START BACKEND (DJANGO)
echo ==========================================
echo.

set "PY_CMD="
where python >nul 2>nul && set "PY_CMD=python"
if not defined PY_CMD (
  where py >nul 2>nul && set "PY_CMD=py -3"
)

if not defined PY_CMD (
  echo [ERROR] Khong tim thay Python trong PATH.
  echo [HINT] Cai dat Python hoac them vao PATH roi chay lai.
  goto :error
)

if not exist "venv" (
  echo [INFO] Tao virtual environment...
  %PY_CMD% -m venv venv || goto :error
)

echo [INFO] Kich hoat virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 goto :error

set "REQ_HASH_FILE=venv\.requirements_hash"
set "CURRENT_HASH="
set "NEED_INSTALL=1"

for /f "skip=1 tokens=1" %%H in ('certutil -hashfile requirements.txt SHA256 ^| findstr /R /V /C:"hash of file" /C:"CertUtil"') do (
  set "CURRENT_HASH=%%H"
  goto :hash_ready
)

:hash_ready
if not defined CURRENT_HASH (
  echo [WARN] Khong tinh duoc hash requirements, tien hanh cai dat dependencies.
) else if exist "%REQ_HASH_FILE%" (
  set /p "STORED_HASH="<"%REQ_HASH_FILE%"
  if /I "!STORED_HASH!"=="!CURRENT_HASH!" set "NEED_INSTALL=0"
)

if "!NEED_INSTALL!"=="1" (
  echo [INFO] Cai dat dependencies...
  pip install -r requirements.txt || goto :error
  if defined CURRENT_HASH >"%REQ_HASH_FILE%" echo !CURRENT_HASH!
) else (
  echo [INFO] Dependencies da moi nhat, bo qua cai dat.
)

echo [INFO] Migrate database...
python manage.py migrate || goto :error

echo [INFO] Khoi dong server tai http://localhost:8000 ...
python manage.py runserver
goto :eof

:error
echo.
echo [ERROR] Script dung do co loi o buoc tren.
exit /b 1

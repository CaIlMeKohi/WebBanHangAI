@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"
echo ==========================================
echo   WEBBANHANG - START BACKEND (DJANGO)
echo ==========================================
echo.

if exist "..\.env" (
  echo [INFO] Nap bien moi truong tu ..\.env ...
  for /f "usebackq delims=" %%L in ("..\.env") do (
    set "LINE=%%L"
    if not "!LINE!"=="" (
      if not "!LINE:~0,1!"=="#" (
        for /f "tokens=1,* delims==" %%A in ("!LINE!") do set "%%A=%%B"
      )
    )
  )
)

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

set "VENV_PY=venv\Scripts\python.exe"

if not exist "..\frontend\dist\index.html" (
  echo [INFO] Frontend dist chua co, dang build...
  pushd ..\frontend
  npm run build || goto :error
  popd
)

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
  "%VENV_PY%" -m pip install -r requirements.txt || goto :error
  if defined CURRENT_HASH >"%REQ_HASH_FILE%" echo !CURRENT_HASH!
) else (
  echo [INFO] Dependencies da moi nhat, bo qua cai dat.
)

echo [INFO] Kiem tra / tao database SQL Server neu can...
"%VENV_PY%" ensure_sqlserver_database.py || goto :error

echo [INFO] Dong bo migration voi database hien co...
echo [INFO] Nếu database đã có schema, dùng migrate --fake để đánh dấu migrations là đã áp dụng.
"%VENV_PY%" manage.py migrate --fake || goto :error

echo [INFO] Khoi dong server tai http://localhost:8000 ...
"%VENV_PY%" manage.py runserver
goto :eof

:error
echo.
echo [ERROR] Script dung do co loi o buoc tren.
exit /b 1

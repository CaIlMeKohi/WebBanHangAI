@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"
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

echo [INFO] Build frontend de dong bo source moi nhat...
pushd ..\frontend
if not exist "package.json" (
  echo [ERROR] Khong tim thay frontend\package.json.
  popd
  goto :error
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Khong tim thay npm trong PATH.
  echo [HINT] Hay cai Node.js LTS, dong terminal, sau do chay lai START_PROJECT.bat.
  popd
  goto :error
)
if not exist "node_modules\.bin\tsc.cmd" (
  echo [INFO] Thieu TypeScript, dang cai dat frontend dependencies...
  call npm install || goto :frontend_error
)
if not exist "node_modules\.bin\vite.cmd" (
  echo [INFO] Thieu Vite, dang cai dat frontend dependencies...
  call npm install || goto :frontend_error
)
call npm run build || goto :frontend_error
popd

set "REQ_FILE=requirements.txt"
if exist "%REQ_FILE%" (
  echo [INFO] Cai dat dependencies...
  "%VENV_PY%" -m pip install -r "%REQ_FILE%" || goto :error
) else (
  echo [WARN] Khong tim thay requirements.txt, bo qua buoc cai dat dependencies.
)

echo [INFO] Kiem tra / tao database SQL Server neu can...
"%VENV_PY%" ensure_sqlserver_database.py || goto :error

echo [INFO] Dong bo migration voi database hien co...
echo [INFO] Nếu database đã có schema, dùng migrate --fake-initial để đánh dấu migrations khởi tạo là đã áp dụng.
"%VENV_PY%" manage.py migrate --fake-initial || goto :error

echo [INFO] Khoi dong Vite dev server voi hot reload tai http://127.0.0.1:5173 ...
pushd ..\frontend
start "WEBBANHANG FRONTEND DEV" /min cmd /c "npm run dev"
popd

echo [INFO] Khoi dong server tai http://localhost:8000 ...
echo [INFO] Mo http://127.0.0.1:5173 de frontend tu cap nhat khi sua code.
start "WEBBANHANG PAYOS EXPIRY" /min cmd /c "cd /d %CD% && venv\Scripts\python.exe manage.py expire_payos_orders --watch --interval 30"
"%VENV_PY%" manage.py runserver
goto :eof

:frontend_error
popd
goto :error

:error
echo.
echo [ERROR] Script dung do co loi o buoc tren.
exit /b 1

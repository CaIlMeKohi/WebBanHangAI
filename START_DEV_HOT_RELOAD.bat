@echo off
setlocal EnableExtensions

cd /d "%~dp0"
echo ==========================================
echo   WEBBANHANG - DEV HOT RELOAD
echo ==========================================
echo.
echo [INFO] Frontend hot reload: http://127.0.0.1:5173
echo [INFO] Backend auto reload:  http://127.0.0.1:8000
echo [INFO] Khi dev, hay mo frontend o cong 5173 de code tu cap nhat.
echo.

if not exist "backend\venv\Scripts\python.exe" (
  echo [ERROR] Khong tim thay backend\venv\Scripts\python.exe.
  echo [HINT] Hay chay START_PROJECT.bat lan dau de cai moi truong.
  exit /b 1
)

if not exist "frontend\node_modules" (
  echo [INFO] Cai dat frontend dependencies...
  pushd frontend
  call npm install || goto :error
  popd
)

echo [INFO] Khoi dong backend Django runserver...
start "WEBBANHANG BACKEND DEV" /min cmd /c "cd /d %CD%\backend && venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000"
start "WEBBANHANG PAYOS EXPIRY" /min cmd /c "cd /d %CD%\backend && venv\Scripts\python.exe manage.py expire_payos_orders --watch --interval 30"

echo [INFO] Khoi dong frontend Vite dev server...
start "WEBBANHANG FRONTEND HOT RELOAD" cmd /c "cd /d %CD%\frontend && npm run dev"

echo.
echo [DONE] Mo http://127.0.0.1:5173 de xem web tu cap nhat khi sua code.
goto :eof

:error
echo.
echo [ERROR] Script dung do co loi o buoc tren.
exit /b 1

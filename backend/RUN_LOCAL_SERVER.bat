@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "PYTHON_EXE=C:\Users\ADmin\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

set "PYTHONPATH=%~dp0venv\Lib\site-packages"

"%PYTHON_EXE%" manage.py runserver 127.0.0.1:8000 --noreload > runserver.log 2>&1

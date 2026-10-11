@echo off
cd /d "%~dp0"
python build.py
echo Open http://localhost:8080
python -m http.server 8080

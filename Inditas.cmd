@echo off
cd /d "%~dp0"
echo Telepites: py -3 -m pip install -r requirements.txt
echo A TEACHER_PASSWORD kornyezeti valtozo legalabb 12 karakter legyen.
set "PUBLIC_URL=http://localhost:8771/"
py -3 server.py
pause

@echo off
rem brain-pane installer. Double-click, or run from cmd. Calls install.ps1 with
rem the stock Windows PowerShell so no execution-policy change is needed.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause

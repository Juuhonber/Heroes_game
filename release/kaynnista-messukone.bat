@echo off
rem HEROES-messupeli koko naytolle (kioskitila). Lopetus: Alt+F4.
set "PELI=%~dp0heroes-peli.html"
set "EDGE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if defined EDGE (
  start "" "%EDGE%" --kiosk "%PELI%" --edge-kiosk-type=fullscreen --no-first-run
) else (
  start "" "%PELI%"
)

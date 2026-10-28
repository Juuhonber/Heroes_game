@echo off
rem HEROES-messupeli omaan ikkunaansa ilman selaimen osoitepalkkia.
set "PELI=%~dp0heroes-peli.html"
set "EDGE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if defined EDGE (
  start "" "%EDGE%" --app="%PELI%" --window-size=1600,900 --no-first-run
) else (
  start "" "%PELI%"
)

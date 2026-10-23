@echo off
rem Tuplaklikkaa tata tiedostoa kaynnistaaksesi pelin.
cd /d "%~dp0"

rem Etsitaan Node.js myos sen tavallisista asennuskansioista, jos se ei ole PATHissa.
where npm >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\npm.cmd" set "PATH=%ProgramFiles%\nodejs;%PATH%"
  if exist "%ProgramFiles(x86)%\nodejs\npm.cmd" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
  if exist "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
)
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js puuttuu tai Windows ei loyda sita.
  echo 1. Asenna Node.js osoitteesta https://nodejs.org ^(LTS-versio^).
  echo 2. Kaynnista tietokone uudelleen.
  echo 3. Tuplaklikkaa tata tiedostoa uudelleen.
  pause
  exit /b 1
)

if not exist node_modules\vite (
  echo Asennetaan pelin tarvitsemat paketit, tama tehdaan vain kerran...
  call npm install
  if errorlevel 1 (
    echo Asennus epaonnistui. Tarkista nettiyhteys ja yrita uudelleen.
    pause
    exit /b 1
  )
)
echo Peli aukeaa selaimeen. Sulje tama ikkuna lopettaaksesi.
call npm run dev
pause

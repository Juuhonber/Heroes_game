@echo off
rem Tuplaklikkaa tata tiedostoa kaynnistaaksesi pelin.
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js puuttuu. Asenna se osoitteesta https://nodejs.org ^(LTS-versio^) ja yrita uudelleen.
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

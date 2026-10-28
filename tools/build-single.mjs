/**
 * Kokoaa pelistä itsenäisen julkaisupaketin kansioon release/:
 *
 *   heroes-peli.html              koko peli yhdessä tiedostossa
 *   campus/                       vapaaehtoiset kampuskuvat ja niiden luettelo
 *   kaynnista-messukone.bat       Edge koko näytön kioskitilaan (messut)
 *   kaynnista-ikkunassa.bat       Edge omaan ikkunaansa ilman selainpalkkeja
 *   LUEMINUT.txt                  ohjeet
 *
 * Aja `npm run release` tuotantoversion käännöksen jälkeen. Paketti ei
 * tarvitse Nodea, palvelinta eikä nettiyhteyttä: HTML-tiedoston voi avata
 * suoraan levyltä tuplaklikkaamalla.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const out = resolve(root, 'release');

const html = readFileSync(resolve(dist, 'index.html'), 'utf8');
const tag = /<script type="module" crossorigin src="\.\/assets\/([^"]+\.js)"><\/script>/;
const match = html.match(tag);
if (!match) throw new Error('dist/index.html: pelin skriptiä ei löytynyt. Aja ensin npm run build.');

const others = readdirSync(resolve(dist, 'assets')).filter((f) => f !== match[1]);
if (others.length > 0) {
  // Kaiken pitää olla skriptin sisällä, muuten yksi tiedosto ei riitä.
  throw new Error(`dist/assets sisältää muita tiedostoja: ${others.join(', ')}`);
}

// "</script" skriptin sisällä katkaisisi upotetun skriptin ennenaikaisesti.
const js = readFileSync(resolve(dist, 'assets', match[1]), 'utf8').replace(/<\/script/gi, '<\\/script');
// Funktiona, jotta skriptin $-merkkejä ei tulkita korvausmalleiksi.
const single = html.replace(tag, () => `<script type="module">\n${js}\n</script>`);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'heroes-peli.html'), single);
if (existsSync(resolve(dist, 'campus'))) cpSync(resolve(dist, 'campus'), resolve(out, 'campus'), { recursive: true });

const crlf = (text) => text.replace(/\r?\n/g, '\r\n');

/** Edge löytyy jokaisesta Windows 10/11 -koneesta; muuten avataan oletusselaimella. */
const findEdge = `set "PELI=%~dp0heroes-peli.html"
set "EDGE="
if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" set "EDGE=%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe"
if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" set "EDGE=%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe"
`;

writeFileSync(
  resolve(out, 'kaynnista-messukone.bat'),
  crlf(`@echo off
rem HEROES-messupeli koko naytolle (kioskitila). Lopetus: Alt+F4.
${findEdge}if defined EDGE (
  start "" "%EDGE%" --kiosk "%PELI%" --edge-kiosk-type=fullscreen --no-first-run
) else (
  start "" "%PELI%"
)
`),
);

writeFileSync(
  resolve(out, 'kaynnista-ikkunassa.bat'),
  crlf(`@echo off
rem HEROES-messupeli omaan ikkunaansa ilman selaimen osoitepalkkia.
${findEdge}if defined EDGE (
  start "" "%EDGE%" --app="%PELI%" --window-size=1600,900 --no-first-run
) else (
  start "" "%PELI%"
)
`),
);

writeFileSync(
  resolve(out, 'LUEMINUT.txt'),
  crlf(`HEROES-messupeli
================

Peli ei tarvitse asennusta, Nodea eikä nettiyhteyttä. Pidä tiedostot
samassa kansiossa.

Pelaaminen
  Tuplaklikkaa heroes-peli.html. Peli aukeaa selaimeen.

Messukone
  Tuplaklikkaa kaynnista-messukone.bat. Peli aukeaa Edgeen koko naytolle
  ilman selaimen palkkeja. Lopetus: Alt+F4.
  Peli palaa itsestaan karttanakymaan 45 sekunnin kayttamattomyyden jalkeen.

Omassa ikkunassa
  Tuplaklikkaa kaynnista-ikkunassa.bat.

Kampuskuvat (vapaaehtoinen)
  Kopioi kuva kansioon campus ja lisaa siita rivi tiedostoon
  campus/campus.js. Ohje on tiedoston alussa. Kaannosta ei tarvita.
`),
);

const kb = (readFileSync(resolve(out, 'heroes-peli.html')).byteLength / 1024).toFixed(0);
console.log(`release/heroes-peli.html: ${kb} kB, yksi tiedosto`);

# HEROES-messupeli

Selaimessa toimiva 2D-sivuttaisvierivä automaattijuoksija, jolla esitellään
HEROES-allianssin yhdeksän korkeakoulua messuosastolla. Pelaaja valitsee
kohteen Euroopan kartalta, juoksee lyhyen radan yhdellä tai kahdella
toiminnolla ja saa lopuksi tietokortin kohteesta. Peli ei kerää mitään tietoa
pelaajasta eikä tallenna etenemää: jokainen ohikulkija aloittaa puhtaalta
pöydältä, ja käyttämättömänä peli palaa itsestään aloitusnäkymään.

## Käyttöönotto

```
npm install
npm run dev      # kehityspalvelin (rakentaa myös kartta- ja sprite-aineiston)
npm run build    # tuotantoversio hakemistoon dist/
npm run preview  # tuotantoversion tarkistus paikallisesti
```

Tuotantoversio on staattinen: `dist/`-hakemiston voi kopioida mille tahansa
web-palvelimelle. `vite.config.ts` käyttää suhteellista `base`-polkua, joten
peli toimii myös alihakemistosta tarjoiltuna. Messukoneella kannattaa avata
selain kioskitilassa ja painaa ruudun oikean yläkulman ⛶-painiketta, joka
siirtää pelin koko näytön tilaan.

## Ohjaus

Peli tarvitsee enintään kaksi toimintoa. Päätoiminto on hyppy: hiiren vasen
painike, kosketus, välilyönti, nuoli ylös tai Enter. Pidempi painallus tuottaa
korkeamman hypyn. Toissijainen toiminto on suojavoima: hiiren oikea painike,
vaihtonäppäin tai nuoli alas. Suojavoima kuluttaa yhden varauksen, tekee
hahmosta hetkeksi haavoittumattoman ja murskaa esteet tieltä. Varauksia saa
keräämällä radalta kuutioita.

Valikot toimivat myös pelkällä näppäimistöllä: toissijainen toiminto siirtää
kohdistusta painikkeesta toiseen ja päätoiminto valitsee kohdistetun
painikkeen. Kartalla voi valita kohteen joko kartan merkistä tai oikean reunan
listasta, jolloin tarkkaa hiiren kohdistamista ei tarvita.

## Rakenne

Sovellus on tilakone, jonka `src/core/Game.ts` ajaa. Tiloja on kolme:
`MapState` (Euroopan kartta ja kohteen valinta), `PlayState` (minipeli) ja
`ResultState` (palaute ja tietokortti). Tilat vaihtuvat häivytyksen kautta, ja
`Game` hoitaa myös virtuaaliresoluution skaalauksen, joutoaikapalautuksen ja
koko näytön tilan.

Kaikki piirto tehdään 1920 × 1080 virtuaalikoordinaatistossa, joka skaalataan
ruudulle mittasuhteet säilyttäen. Sama koodi toimii siis kannettavan näytöllä
ja messuseinän isolla ruudulla ilman erillistä asettelua.

```
src/core     tilakone, syöte, lataus, sprite sheet -leikkaus, animaatio
src/game     pelaaja, radan generointi, taustakerrokset, vakiot
src/states   kartta, minipeli, palauteruutu
src/ui       painikkeet, teemavärit, tekstit kahdella kielellä
src/data     kohde- ja karttatietomallit
tools        aineistogeneraattorit (kartta, spritet)
public       valmis aineisto, jonka generaattorit tuottavat
```

## Sisällön muokkaus

Kohteet ovat tiedostossa `public/data/destinations.json`. Jokaisella kohteella
on nimi, kaupunki, koordinaatit, vahvuusalue, tietokortin fakta lähdeviitteineen
sekä radan visuaaliset parametrit. Faktakentät perustuvat kunkin korkeakoulun
omiin sivuihin, ja `source`-kenttä kertoo mistä luku on peräisin. Vahvuusalue
(`strength`) sen sijaan on pelin teemaväri ja sisällöllinen kehys, ei allianssin
virallinen työnjako.

Radan pituutta säätää `goalDistance` (metreinä) ja esteiden tiheyttä
`obstacleDensity`. Rata luodaan kohteen tunnuksesta johdetulla siemenellä, joten
sama kohde tuottaa aina saman radan ja uusi yritys on reilu.

Kentän `campusImage` voi osoittaa kampuskuvaan `public`-hakemistossa. Kun kuva
on annettu, se piirtyy horisonttiin kaukaisimmaksi taustakerrokseksi. Ilman
kuvaa käytetään maastotyypin (`terrain`) mukaisia siluetteja.

## Spritet

`tools/generate-sprites.mjs` piirtää maskotin animaatioarkit SVG:nä ja
kirjoittaa `public/sprites/sprites.json`-kuvauksen, jossa kerrotaan jokaisen
animaation ruutukoko, sarakemäärä, ruutujen määrä ja toistonopeus. Peli lataa
arkit ja leikkaa ne ruuduiksi luokassa `SpriteSheet`: ruudut luetaan riveittäin
vasemmalta oikealle, joten indeksi 0 on vasen ylänurkka.

Brändigrafiikan vaihtaminen ei vaadi koodimuutoksia. Korvaa arkki omalla
PNG- tai SVG-tiedostolla ja päivitä `sprites.json` vastaamaan uuden arkin
ruutukokoa ja sarakemäärää. Nykyiset arkit ovat juoksu (8 ruutua), idle
(4 ruutua), hyppy (2 ruutua) ja törmäys (2 ruutua).

## Kartta-aineisto

`tools/build-map.mjs` poimii Euroopan maiden rajat Natural Earth -aineistosta
(public domain, npm-paketti `world-atlas`), leikkaa ne näkymän rajaukseen ja
kirjoittaa tuloksen tiedostoon `public/data/europe.json`. Peli projisoi
koordinaatit Mercator-projektiolla ajonaikaisesti, joten karttanäkymän rajausta
voi muuttaa muokkaamalla `VIEW_BOUNDS`-arvoa tiedostossa `src/states/MapState.ts`.

## Messukäyttö

Joutoaikapalautus on 45 sekuntia, ja viimeiset 10 sekuntia näkyvät
laskurina ruudun alareunassa. Kesken juoksun palautusta lykätään, jotta peli ei
katkea pelaajan käsiin. Asetukset ovat vakioina tiedoston `src/core/Game.ts`
alussa.

Osoitteeseen lisätty `?test=1` asettaa peliobjektin selaimen konsoliin nimellä
`heroes`. Se on tarkoitettu vianetsintään ja automaatiotesteihin; ilman
parametria mitään ei viedä globaaliin tilaan.

## Tiedossa olevat rajoitukset

Maskotin animaatiot on piirretty ohjelmallisesti annettujen referenssikuvien
pohjalta, eivät leikattu alkuperäisistä tiedostoista. Kun lopulliset
brändiarkit ovat saatavilla, ne korvaavat generoidut arkit suoraan.
Kampuskuvia ei toimiteta mukana, joten taustat ovat toistaiseksi
maastotyyppien mukaisia siluetteja.

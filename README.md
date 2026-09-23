# HEROES-messupeli

Selaimessa toimiva 2D-sivuttaisvierivä automaattijuoksija, jolla esitellään
HEROES-allianssin yhdeksän korkeakoulua messuosastolla. Pelaaja valitsee
kohteen Euroopan kartalta, juoksee lyhyen radan yhdellä tai kahdella
toiminnolla ja saa lopuksi tietokortin kohteesta. Peli ei kerää mitään tietoa
pelaajasta eikä tallenna etenemää: jokainen ohikulkija aloittaa puhtaalta
pöydältä, ja käyttämättömänä peli palaa itsestään aloitusnäkymään.

## Käyttöönotto

Windowsissa helpoin tapa on tuplaklikata tiedostoa `kaynnista-peli.bat`. Se
asentaa tarvittavat paketit ensimmäisellä kerralla ja avaa pelin selaimeen.
Koneella pitää olla Node.js (LTS-versio osoitteesta nodejs.org).

Komentoriviltä:

```
npm install
npm run dev      # kehityspalvelin, avaa pelin selaimeen
npm test         # pelilogiikan testit
npm run build    # tuotantoversio hakemistoon dist/
npm run preview  # tuotantoversion tarkistus paikallisesti
npm run assets   # generoi kartan ja spritet uudelleen (tarvitaan harvoin)
```

Tuotantoversio on staattinen: `dist/`-hakemiston voi kopioida mille tahansa
web-palvelimelle. `vite.config.ts` käyttää suhteellista `base`-polkua, joten
peli toimii myös alihakemistosta tarjoiltuna. Messukoneella kannattaa avata
selain kioskitilassa ja painaa ruudun oikean yläkulman ⛶-painiketta, joka
siirtää pelin koko näytön tilaan.

## Ohjaus

Peli tarvitsee enintään kaksi toimintoa. Päätoiminto on hyppy: hiiren vasen
painike, kosketus, välilyönti, nuoli ylös tai Enter. Hyppy on aina yhtä
korkea painalluksen kestosta riippumatta, koska messuilla pelataan
klikkaamalla. Toissijainen toiminto on supervoima: ruudun oikean alakulman
voimanappi, hiiren oikea painike, vaihtonäppäin tai nuoli alas. Voimanappi
toimii myös kosketusnäytöllä.

Jokainen juoksu alkaa yhdellä voimavarauksella, ja jokainen kerätty kuutio
antaa yhden lisää (enintään kolme). Voima riippuu kohteen vahvuusalueesta:

| Vahvuusalue | Voima | Vaikutus |
| --- | --- | --- |
| Yhteisöllisyys | Tiimisuoja | 2,4 s suoja, joka murskaa esteet ja kantaa kuoppien yli |
| Innovaatiot | Rakettireppu | lento esteiden yli; laskeutuu vain vapaalle maalle |
| Kestävyys | Kasvuvoima | edessä olevat esteet muuttuvat pensaiksi ja kuopat kasvavat umpeen |
| Digitaalisuus | Hidastus | maailma hidastuu 3,4 sekunniksi alle puoleen nopeudesta |

Jos pelaaja ei hyppää ensimmäisen esteen kohdalla, ruudulle tulee
HYPPÄÄ!-kehotus. Ilman varauksia painettu voimanappi näyttää kehotuksen
kerätä kuutioita.

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
src/game     pelilogiikka (RunSim), fysiikka, radan generointi, maisemat, voimat
src/states   kartta, minipeli, palauteruutu
src/ui       painikkeet, teemavärit, tekstit kahdella kielellä
src/data     kohde-, kartta- ja kampuskuvatietomallit
tests        pelilogiikan testit (vitest)
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
sama kohde tuottaa aina saman radan ja uusi yritys on reilu. Esteiden välit
lasketaan hypyn fysiikasta, ja testit todentavat jokaisen radan
läpäistäväksi (ks. Testit).

Maisema koostuu kolmesta kerroksesta (`scenery.far`, `mid`, `near`) ja
kaupungin maamerkistä (`landmark`). Maisematyypit kuvaavat paikallista
ympäristöä: Seinäjoella lakeuden ladot, koivut ja Lakeuden Risti, Bejassa
valkoiset talot, oliivipuut ja linnan päätorni, Mechelenissä porraspäätytalot
ja Pyhän Rumoldin torni ja niin edelleen.

## Kampuskuvat

Oikean kampuskuvan saa radan taustaksi ilman koodimuutoksia:

1. Kopioi kuva kansioon `public/campus/`, esimerkiksi `public/campus/seamk.jpg`.
2. Lisää rivi tiedostoon `public/campus/campus.json`:

```json
{
  "seamk": { "file": "seamk.jpg", "credit": "SeAMK / Kuvaajan nimi", "source": "seamk.fi" }
}
```

Avain on kohteen `id` tiedostosta `destinations.json`. Kuva täyttää taivaan,
panoroi hitaasti juoksun aikana ja sävytetään kohteen värimaailmaan.
Kaukainen maisemakerros ja maamerkki väistyvät kuvan tieltä, lähin kerros jää
eteen. `credit` näkyy pelissä ja palautekortilla, joten lisenssin vaatima
nimeäminen hoituu samalla. Leveä vaakakuva (vähintään 2000 px) toimii
parhaiten; liian isot kuvat pienennetään latauksessa automaattisesti.

Käytä vain kuvia, joihin on käyttöoikeus: korkeakoulujen omat mediapankit
tai avoimesti lisensoidut kuvat (esimerkiksi Wikimedia Commons, CC BY tai
CC BY-SA, jolloin tekijä ja lisenssi merkitään `credit`-kenttään).

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

## Testit

`npm test` ajaa pelilogiikan testit ilman selainta. Pelilogiikka on luokassa
`RunSim`, joka ei piirrä mitään, joten sitä voi ajaa testeissä sellaisenaan.

Tärkein testi etsii jokaiselle radalle hyppyaikataulun leveyshaulla. Haku on
täydellinen, koska juoksunopeus ei riipu hyppimisestä: jos reittiä ei löydy,
sitä ei ole. Haku tehdään vaaroilla, joita on levennetty 48 pikseliä
kumpaankin suuntaan, joten jokaisella hypyllä on noin 100 ms pelivaraa
alkunopeudella. Löydetty aikataulu ajetaan vielä oikealla simulaatiolla
maaliin asti. Muut testit tarkistavat jokaisen estetyypin ajoitusikkunan,
jokaisen supervoiman, kuutioiden keräämisen, sprite sheet -leikkauksen ja
kartan projektion.

## Messukäyttö

Joutoaikapalautus on 45 sekuntia, ja viimeiset 10 sekuntia näkyvät
laskurina ruudun alareunassa. Palautus nollaa myös leimat: kartalla ja
palautekortilla näkyvät tämän vierailijan suorittamat kohteet (esimerkiksi
3/9), ja ne ovat vain muistissa. Kesken juoksun palautusta lykätään, jotta peli ei
katkea pelaajan käsiin. Asetukset ovat vakioina tiedoston `src/core/Game.ts`
alussa.

Osoitteeseen lisätty `?test=1` asettaa peliobjektin selaimen konsoliin nimellä
`heroes`. Se on tarkoitettu vianetsintään ja automaatiotesteihin; ilman
parametria mitään ei viedä globaaliin tilaan.

## Tiedossa olevat rajoitukset

Maskotin animaatiot on piirretty ohjelmallisesti annettujen referenssikuvien
pohjalta, eivät leikattu alkuperäisistä tiedostoista. Kun lopulliset
brändiarkit ovat saatavilla, ne korvaavat generoidut arkit suoraan.
Kampuskuvia ei toimiteta mukana: ne lisätään yllä kuvatulla tavalla, kun
käyttöoikeudet on sovittu. Siihen asti taustat ovat kaupunkien maamerkkien
ja maisemien siluetteja.

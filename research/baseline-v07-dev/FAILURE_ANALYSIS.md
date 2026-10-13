# Virheet ja juurisyyt

Viitteet tarkoittavat lukittua baselinea. Täysi todistusaineisto `raw/<id>.json`: layout.observations/pages.rows, parsed.fields/payLines/issues/decision ja readerMatches. Ground truthia ei muutettu. GT:n aluevertailussa ei löytynyt ristiriitaa raakatekstin kanssa; erillinen ihmisvalidointi puuttuu.

## 1. P01: palsta sekoittaa maksupäivän — rakenne → semantiikka

Odotus: payDate 2026-05-22 omasta otsikko–arvo-paristaan. Todellinen: missing, UNPARSEABLE_LABELED_AMOUNT. Raakarivi on `Maksupäivä 22.05.2026 Jakso 04.05.-17.05.2026`; molemmat alueet luettu oikein. `src/layout.mjs:11` rowsFromObservations ryhmittelee y-korkeuden, ei palstan mukaan. `src/payroll-sections.mjs:72–74` antaa koko otsikon jälkeisen rivin isoDate-funktiolle. Vakavuus: korkea käytettävyydelle, pysäytys turvallinen. Koe: paikallinen otsikko–arvo-paritus; arvioi P01 payDate ja vieraan palstan erillisyys.

## 2. P01–P03: rajattu otsikko- ja formaattikieli — semantiikka

Odotus: kaikkien läsnä olevien core-arvojen löytyminen. Todellinen: vain netPay löytyy P01:stä. `Bruttopalkka`, `Veronalainen / YTD`, P02:n englanninkieliset otsikot ja P03:n `Ansiot yhteensä` eivät vastaa `src/payroll-sections.mjs:15–19` rajattuja regexejä. Myös dateLabel/isoDate ovat rajattuja. Raw-arvot löytyvät oikeista GT-alueista. Vakavuus: korkea yleistymiselle, ei todettu väärää verified-arvoa. Koe: erillinen otsikkoroolien kattavuustutkimus, jossa alkuperäinen parseri säilyy kontrollina; rakennekoe yksin ei ratkaise tätä.

## 3. P01–P03: palkkalajit ja osiorajat eivät yleistä — semantiikka/rakenne

Odotus: uusien realististen rivien säilyminen vähintään tuntemattomina tietueina. Todellinen: payLines 0 kaikissa kolmessa, yhdeksän GT:n palkkariviä jää tunnistumatta. `src/payroll-lines.mjs:5` RULES sisältää rajalliset koodit; :32 aloittaa yksityiskohdat määrätyillä osio-otsikoilla. DEV:n koodit/otsikot eivät kuulu tähän sopimukseen. Tämä on yleistymisrajoite, ei näyttö tuettujen koodien regressiosta. P01:n monirivinen kuvaus muuttuu lisäksi eri riviksi. Vakavuus: korkea kattavuudelle. Koe: rakennekerroksen domainriippumaton riviehdokas säilyttää myös tuntemattomat koodit; toteutus ei kuulu tähän ajoon.

## 4. P02 (myös T01/T03): material-portti ohittaa olennaisia havaintoja — hyväksyntä/kattavuus

Odotus: tuntemattomien olennaisten arvojen näkyvä kattavuusarvio. Todellinen: P02:ssa vain yksi material-observation vaikka 13 GT-havaintoa on luettu. Dot-desimaalit, jaetut arvot, kokonaisluvut ja merkkijonot eivät kata samaa raha-regexiä. `src/payroll-sections.mjs:118–132` merkitsee materialin moneyRegexillä; `src/acceptance.mjs` laskee tuntemattomat tästä suodatetusta joukosta. Tämä on vaarallisin **latentti** ongelma: tuntemattoman datan olemassaolo voi jäädä coverage-mittarilta näkymättömäksi. DEV:ssä ei silti havaittu hiljaista virhehyväksyntää, koska muut blokit pysäyttivät kaikki tiedostot. Vakavuus: korkea mahdolliselle myöhemmälle hyväksynnälle. Koe: erottele havaintojen käsittelytila material-heuristiikasta; mittaa myös kokonaan huomaamatta jäävät GT-havainnot. Ei toteutettu.

## 5. T03 ja monisivuisuus: tietuerakenne puuttuu — ominaisuusrajoite

Odotus: kaksi rinnakkaista taulukkoa ja sama koodi eri tietueissa pysyvät erillään yleisessä rakennekerroksessa. Todellinen: `0007 1,234 kpl 0007 8 kpl` on yksi y-rivi. Etunollat ja raakaerottimet säilyvät. `src/layout.mjs` tuottaa havainnot ja rivit mutta ei solu-/taulukkograafia, yhdistettyjä soluja tai sivujatkoksia. `src/holdings.mjs` tukee CSV:tä, ei T01:n PDF-omistuksia. Vakavuus: korkea yleiskäyttöisyyden rajoite, ei lasku-/varastoadapterin bugi. Koe: rinnakkaisten alueiden erotus ja tietuetunnisteet ennen semantiikkaa, ilman payroll-sääntöjen yleistämistä vieraisiin domaineihin.

## Runtime-erillishavainto

Kaikki kuusi ensimmäistä lukuyritystä estyivät `hashOriginal.toHex is not a function` -virheeseen ennen adapteria. ENVIRONMENT_FAILURE.json säilyttää todellisen eston. node-compat.mjs lisää standardin toHex-toiminnon erillisenä ympäristöapuna ja testaa [0,15,255] → 000fff. Baselinen tai PDF.js:n tavut eivät muutu. Selainajo jäi puuttumaan Chromium-latauksen eston vuoksi; Node-tulos ei ole selaintulos.

# Issue #49 — visuaalisen omistusrivin sidonta

Lähtö: PR #48, `3c998a3287c9006f0f9a61263e483e03eb932512`.
Kehityshaara: `fix/issue49-visual-row-binding`. Kohde: `integration/p0-safe-dual-ocr-20261018`.
Tila: rajattu korjaus tarkastettavaksi; koko Engine **NO-GO**. Ei julkaisua tai integraatiota.

## Todistettu juurisyy

`extractVisualPortfolio` rajasi nimihavainnot arvorivin ympärille (`amountLine.cy-.014`),
vaikka todellinen nimi saattoi olla tämän ikkunan yläpuolella. Lähellä määrää oleva
väliotsikko jäi ainoaksi nimiosaksi. `eligible.slice(-3)` ja tekstiosien yhdistäminen
eivät todistaneet nimen roolia. Kahden paikallisen OCR-luvun portti vahvisti saman
väärän tekstin ja aritmetiikka vahvisti oikeat numerot. Kumpikaan ei tarkistanut
tekstin semanttista sidontaa.

Itsenäinen kuvallinen vastaesimerkki sisältää neljä kuvitteellista omistusta,
eri nimet, määrät ja arvot sekä kolme eri väliotsikkoa. PNG luetaan Tesseractilla
ensin `fin+eng`, sitten `eng`; rivit muodostetaan todellisista TSV-havainnoista.
Lähtöcommit tuotti `Growth sleeve`, `Income sleeve` ja `Reserve sleeve` instrumenttien
nimiksi. Kaikki kolme läpäisivät kahden lukukerran portin ja summatarkistuksen.

Erillinen Node-vastatesti todisti myös, että heikon määrähavainnon ohittaminen ennen
rivirajan päivitystä saattoi antaa seuraavan määrän lainata edellisen rivin nimen.
Sivunvaihdon ja kahden samalla rivillä olevan määrän vastatestit epäonnistuivat samoin.

## Rajattu korjaus

- Koko nykyisen omistusvälin vasemman palstan teksti tarkistetaan. Myös heikon
  OCR-varmuuden kilpaileva teksti estää nimen valinnan; sitä ei poisteta näyttönä.
- Tuettu B-rivi sisältää yhden nimen sekä määrän yksikköineen samassa paikallisessa
  osake-/rahasto-osiossa. Arvon on sovittava tämän rivin ankkuriin. Kilpailevia
  nimitekstejä ei yhdistetä tai päätellä otsikoiksi sanalistan perusteella.
- Aiempi yksikirjaiminen rahasto-osuuslajin jatkorivi säilyy rajattuna
  rivimuotona. Muut moniriviset vapaat nimet jäävät epäselviksi.
- Myös heikon/estetyn määrärivin raja kulutetaan. Osion tulkinta ei jatku automaattisesti
  sivunvaihdon yli. Kahta määrää samalla rivillä ei ratkaista valitsemalla ensimmäistä.
- Jos sama lähdehavainto päätyisi useaan ehdokkaaseen, kaikki sen omistajat estetään.
- Nimikonfliktista palautuu `UNRESOLVED_INSTRUMENT_NAME`, `field:'name'`, syy ja
  alkuperäiset lähdeviitteet. Väliotsikoita ei palauteta valmiina instrumenttiehdotuksina.
  Tämä on adapterikorjaus, ei uusi käyttöliittymä: sovellus voi pyytää vain kyseisen
  mahdollisen instrumentin nimen tarkistamista, ei kenttäkarttojen opettamista.

Ei yhtiö-, välittäjä- tai omistuslistoja. `marketVerification` säilyy `not-verified`,
kaikki taloudelliset tulokset `canPersist:false`. Lähteen tekstejä ja geometriaa ei
kirjoiteta uudelleen. Ei oppimisprofiileja, tallennusta tai ulkoisia palveluita.

## RED → GREEN ja mitatut tulokset

Sama lopullinen koeaineisto ajettiin sekä arkistoidulla lähtöcommitilla että korjauksella.
Vanhoja testejä ja kuvafiktuureja ei muutettu.

| Aineisto | Ennen oikein / väärin / estetty | Jälkeen oikein / väärin / estetty |
|---|---:|---:|
| Uusi PNG, 3 eri väliotsikkoa ja tavallinen vertailurivi | 1 / 3 / 0 | 1 / 0 / 3 |
| Uusi PNG, 4 tavallista tuntematonta nimeä | 4 / 0 / 0 | 4 / 0 / 0 |
| Vanha kompakti, summilla ja ilman (kumpikin) | 4 / 0 / 0 | 4 / 0 / 0 |
| Vanha kokonainen / rajattu / kaksi palstasiirtoa (kukin) | 4 / 0 / 1 | 4 / 0 / 1 |

Myös vanhojen kuuden kuvakokeen ennen-luvut toistettiin paikallisesti tarkalle
lähtöcommitille (6 PASS). Kaikki taulukon ennen- ja jälkeen-luvut on näin mitattu.
Hyökkäyskuva vaatii nyt kolmen mahdollisen omistuksen tarkistamista; automaattisesti
hyväksyttäviä instrumentteja ei ole. Käyttäjätyön kestoa ei mitattu: **NOT MEASURED**.

- Uudet 9 Node-vastatestiä lähtökoodilla: **1 PASS / 8 FAIL**.
- Uudet 9 Node-vastatestiä korjauksella: **9 PASS / 0 FAIL**.
- Integroitu Node-kohdesarja, myös vanhat P0-hyökkäykset, listing- ja rakenneoppimistestit:
  **86 PASS / 0 FAIL / 0 SKIP**.
- Koko Node-sarja lähtöcommitilla: **229 PASS / 24 FAIL / 0 SKIP** (253 testiä).
- Koko Node-sarja korjauksella: **238 PASS / 24 FAIL / 0 SKIP** (262 testiä).
  Epäonnistuvien testien nimet ovat täsmälleen samat. Niitä ei ohitettu tai löysennetty;
  komentojen todellinen exit-koodi on 1. Täysi nimiluettelo: `issue49-node-comparison.json`.
- Integroitu aito Chromium/OCR-kohdesarja: **12 PASS / 0 FAIL / 0 SKIP**.
  Mukana uudet 2 kuvakoetta, aiemmat 6 visuaalista koetta, issue45:n opetusmyrkytys
  sekä 3 vanhaa mobiilikorttien P0-koetta. Koko Chromium-sarjaa ei ajettu.
- Vanha 12 omistuksen korttikoe: automaattisesti 0/12; tilapäisten lähdekorjausten jälkeen
  12/12 oikein, 0 väärin. Tämä vaati 12 nimivahvistusta ja 4 tunnistekorjausta.
  Se ei ole väite automaattisen OCR-kattavuuden paranemisesta.

Alustava koejärjestely paljasti erillisen `pcs`→`pes`-OCR-ongelman ja yhden määrän
sanajakoon liittyvän erimielisyyden. Nämä epäonnistumiset säilyivät paikallisissa lokeissa.
Lopullisessa **sekä RED- että GREEN-ajossa samassa** fiktuurissa käytetään selkeästi
luettavaa `kpl`-yksikköä ja eri määriä/arvoja, jotta koe mittaa rivisidontaa. Moottoriin
ei lisätty OCR-merkkikorvauksia eikä olemassa olevia testirajoja alennettu.

## Toistaminen ja todisteet

Node 22.23.3, Playwright 1.57.0, paikallinen Chromium 154, Tesseract.js 5.1.0.
Paikalliset OCR-mallit `fin` ja `eng`; tessdata-pin
`87416418657359cb625c412a48b6e1d6d41c29bd`.

Integroitu CI-työnkulku `.github/workflows/integrated-p0-visual-qa.yml` ajaa vanhat
P0-testit ja uuden kuvallisen vastatestin samalle checkout-SHA:lle. PNG sekä molempien
OCR-lukujen havainnot ja tulos tallentuvat testiartefaktiin. Testien ulkopuoliset
verkkopyynnöt estetään ja tarkistetaan. Luvat pysyvät `contents:read`.
Tässä raportoidut tulokset ovat paikallisia kehittäjätestejä, eivät riippumatonta QA:ta
tai GitHub Actionsin vahvistettuja tuloksia.

```
node --test tests/*.test.mjs
node --test tests/visual-row-binding.test.mjs tests/integration-p0-visual.test.mjs tests/issue45-legacy-audit.test.mjs tests/mobile-learning-safety.test.mjs tests/structure-learning.test.mjs tests/portfolio-visual-evidence.test.mjs tests/portfolio-inline-ledger.test.mjs tests/portfolio-instrument-listings.test.mjs
REAL_OCR_QA=1 npx playwright test visual-row-binding.spec.mjs mobile-learning-safety.spec.mjs issue45-legacy-audit.spec.mjs portfolio-visual-ledger.spec.mjs portfolio-inline-ledger.spec.mjs
```

## Rajat ja suositus

Korjaus estää mitatut kilpailevien nimitekstien hyökkäykset, mutta rivimuoto on edelleen
rajattu rakennehypoteesi, ei yleinen semanttisen identiteetin todistus. Jos todellinen
nimi puuttuu OCR:stä kokonaan, ainoa jäljelle jäävä teksti voi edelleen näyttää nimeltä.
Samoin yksikirjaimisen rahastojatkon merkitystä ei varmenneta ulkoisesta instrumenttitiedosta.
Uudet moniriviset nimet voivat vaatia enemmän käyttäjätarkistuksia. Vapaasti vaihtuvia
mobiilinäkymiä ei tämän pienen synteettisen kokeen perusteella voi luvata turvallisiksi.

Ei muutoksia Palkkaan, Osakevahtiin, tuotantoon tai LABiin. Ei oikeita sijoituskuvia.
Alkuperäiset lähdeviitteet ja koordinaatit pysyvät jäljitettävinä; vain kuvitteellinen
testidata päätyy kehittäjätestien artefakteihin. Koko Engine **NO-GO** kunnes erillinen
riippumaton auditointi, avoimet regressiot ja sovelluskohtainen hyväksymisportti on käsitelty.
Seuraava toimi: Draft PR:n riippumaton katselmointi täsmälliselle korjauscommitille.

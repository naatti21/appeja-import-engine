# Issue #38 — kehittäjän QA, 17.10.2026

## WORK

Rajattu paikallinen rakenneoppiminen, lähdehavaintoihin sidottu mobiilikorttiadapteri ja erillinen julkaisematon tutkimusnäkymä. Tekniset perustelut ja rajat: [ISSUE38_STRUCTURE_LEARNING.md](../../ISSUE38_STRUCTURE_LEARNING.md).

**Tulos on PARTIAL. Issue #38 ei ole valmis. Ei LAB-julkaisua.**

## LOCKED TARGET

- Työhaara: `feature/issue38-mobile-structure-learning`.
- Pohja ja ehdotettu Draft PR:n kohde: `feature/compact-mobile-review-20261017` / `ce3ae5731e7c8f09b2641b58fc2e4550e9c8477f`.
- Tämä raportti kuuluu samaan commitiin kuin testattu toteutus. Lopullinen commit-SHA annetaan työn luovutuksessa; toteutustiedostojen tarkisteet ovat alla.
- Palkan muuttamaton vertailukohde: `607a74a7334ce7130cb1261c009c08056c9e3b6d`.
- Ajettu Node `22.23.3`, Chromium `154.0.8037.57`, Playwright `1.57.0`, Tesseract.js `5.1.0`, tessdata_fast `87416418657359cb625c412a48b6e1d6d41c29bd`.

## EVIDENCE — PASS / FAIL / PARTIAL / NOT RUN

| Tarkistus | Tulos |
|---|---|
| Enginen koko Node-sarja | **166 PASS, 0 FAIL, 0 SKIP** |
| Palkan muuttamattomat learning + model/backup-testit Node 22:lla | **20 PASS, 0 FAIL**; Git-työpuu puhdas |
| Koko Chromium-sarja, oikea OCR mukaan lukien | **90 PASS, 3 FAIL, 3 SKIP**, exit 1 |
| Ohitetut kolme testiä | Vanha `QA v1.3` -sarja vaatii erillisen 60 PDF:n generaattorin ja `QA_CORPUS_READY=1`; ei väitetä läpäistyksi |
| Uuden kokeilun UI-testit | **4 PASS**: 320/360/393 px, korkeus/ylivuoto, opetuksen toistot, peruutus, tallennuksen tietosuoja ja tallennusvirhe |
| Uudet aidot OCR-sekvenssit | **1 PASS / 3 FAIL**; epäonnistumiset säilyvät oikeina FAIL-tuloksina |
| GitHub CI lopulliselle SHA:lle | **NOT RUN / ei varmennettu**; paikallinen ajo ei ole CI-kuittaus |
| Riippumaton QA, alkuperäiset pankkikuvat, fyysinen Android | **NOT RUN** |

Täysi selainajo tehtiin ennen viimeistä vain uuden näkymän sanamuotoja selventävää muutosta. Uusi kahdeksan testin kohdesarja ajettiin sen jälkeen uudelleen: 5 PASS, 3 FAIL. Node-sarja kattaa lopulliset toteutusmoduulit. Testirajoja ei löysennetty: aidon kuvan jokaisen kolmen omistusrivin pitää edelleen osua.

### Mitattu tunnistustulos

Neljä aitoa kuvasarjaa, jokaisessa kolme tuontikertaa ja kolme omistusta. Alla on **viimeisen, opetuksesta erillisen tuontikerran** tulos. Nimi, tunniste ja määrä tarkistetaan yhdessä saman tuloskortin sisältä.

| Kuvasarja | Täsmälleen oikein | Väärät ehdotukset | Estetyt / puuttuvat ehdotukset |
|---|---:|---:|---:|
| Englanti, ticker + MIC, englannin OCR | 2/3 | 0 | 1 |
| Suomi, ticker + MIC, monikielinen OCR + rinnakkainen tunnisteluku | 0/3 | 0 | 3 |
| Englanti, tarkisteellinen ISIN, englannin OCR | 3/3 | 0 | 0 |
| Suomi, ISIN, monikielinen OCR + rinnakkainen tunnisteluku | 0/3 | 0 | 3 |
| **Yhteensä** | **5/12 = 41,7 %** | **0** | **7/12** |

Ehdotettujen viiden rivin täsmällisyys tässä pienessä kokeessa oli 5/5. Tämä ei osoita yleistä 100 % tarkkuutta. Koko kuvasarjan kolmessa vaiheessa syntyi yhteensä 9 oikeaa ja 0 väärää ehdotusta / 36 lähderiviä; alkuvaiheen tarkoitukselliset pidättäytymiset sisältyvät nimittäjään. Automaattisia markkinavarmennuksia, salkkuhyväksyntöjä tai tallennuksia: **0**.

Ennen rinnakkaisen tunnisteluvun suojausta suomenkielinen ticker-koe tuotti **3 väärää ehdotusta / 3**: Q muuttui O:ksi. Tätä havaintoa ei poisteta raportista. Suojaus poisti nämä ehdotukset, mutta ei ratkaissut varsinaista tunnistusta. Molempien lukukertojen sama virhe voi edelleen jäädä havaitsematta.

Pelkkään oikeaan geometria-/tekstiaineistoon perustuva erillinen rakennekoe: 6/6 pidätettyä arviointiriviä oikein, 0 väärää ehdotusta. Tätä tulosta **ei** saa esittää kuvatunnistuksen tarkkuutena.

### Käyttäjän korjaukset ja hyöty

- Molemmissa onnistuneesti opetettavissa englanninkielisissä sarjoissa lähdekenttien valintoja oli tuontikerroittain **3 → 3 → 0**. Ensimmäisillä kahdella kerralla tarvittiin lisäksi erillinen opetusvahvistus ja kortin valinta. Myöhempi lähde-ehdotusten tarkistus säilyy.
- Englannin ISIN-sarjan kolmannella kerralla kaikki kolme omistusta syntyivät ilman uusia kenttäkohdistuksia. Englannin ticker-sarjan yksi estetty rivi vaatii edelleen lähteen tarkistuksen.
- Suomenkielisten sarjojen nolla opetusvalintaa ei ole säästö: tunniste-epävarmuus esti opetuksen. Lopputuloksen seitsemän estettyä riviä tarvitsevat vähintään seitsemän rivikohtaista selvitystä. Tarvittavien varsinaisten tekstikorjausten täydellinen määrä: **NOT MEASURED**, koska tekstin korjauspolku ei kuulu tähän toteutukseen.
- Pilvikoneen kohdeajossa yhden englanninkielisen kuvan käsittely automaattisine käyttöliittymätoimineen kesti noin 0,9–1,1 s, kahden lukukerran kuvat noin 1,9–2,1 s. Nämä eivät ole Android-aikoja tai käyttäjän työaikaa. Ihmisen ajansäästö: **NOT MEASURED**.

### Testien ajaminen

```sh
node --test tests/*.test.mjs
# Same-origin OCR-stage: ks. scripts/prepare-local-ocr.mjs.
REAL_OCR_QA=1 npx playwright test
# Kohdesarja:
REAL_OCR_QA=1 npx playwright test structure-learning.spec.mjs
```

Tässä pilviympäristössä käytettiin vastaavia komentoja Node 22:n absoluuttisella polulla ja checkoutin ulkopuolisella Playwright-konfiguraatiolla, joka valitsee `/usr/bin/chromium`-selaimen ja kaksi työntekijää. Testisisältöä ei vaihdettu. Selaimen ulkoiset pyynnöt estettiin uusissa aidoissa OCR-kokeissa: **0 ulkoista pyyntöä**.

Paikalliset täydet lokit ovat `/tmp/issue38-node-final.tap`, `/tmp/issue38-browser-final.log`, `/tmp/issue38-focused-final.log` ja `/tmp/issue38-palkka.tap`. Synteettisiä näkymäkuvia säilytettiin työtilassa, ei käyttäjän kuvia Gitissä. Uusi erillinen QA-workflow arkistoi synteettiset lokit ja täsmällisen testatun SHA:n; ei uusia julkaisu- tai kirjoitusoikeuksia.

## GATE

- Kehittäjän testit: **PARTIAL**, tarkkuusportti **FAIL**.
- Riippumaton QA ja käyttäjän hyväksyntä: **NOT RUN / NOT GIVEN**.
- Merge, LAB, Osakevahti, Palkka ja tuotanto: **NO-GO**.
- Ei muutoksia Palkan tai Osakevahdin koodiin, julkaistuihin versioihin tai salkkutietoihin. Vanhat Enginen parserit, jäädytetyt aineistot ja julkaisuworkflow't pysyivät muuttamattomina.

## ONE NEXT ACTION

Riippumaton tekninen katselmointi tästä rajatusta kehityshaarasta: arvioi erityisesti epäonnistuneet aidon OCR:n tunnistetapaukset ja lähteeseen sidotun tekstikorjauksen puuttuva polku ennen seuraavaa toteutusvaihetta. Issue #38 pidetään avoimena; käyttäjältä ei pyydetä vielä uutta puhelintestiä.

## Testattujen toteutus- ja testitiedostojen SHA-256

```text
5c275125718c34e95ea9ca00c092840a446c1b6f29d782a2f30ca4cbedd72bbd  src/structure-learning.mjs
e5e0eac1e97a6055dc31537750a9b405a0b443d18aafe7431a01974223b13b5b  src/mobile-card-holdings.mjs
7583e99f4601022e29acbf5e4b76cbb8612f8bc62bb6b45a39eba3c258667abc  demo/structure-learning.html
0e35c3617ff555d6d36b9191697b5f7d399aa5b68e8e818264d46279434102b7  demo/structure-learning.mjs
fa7422270dbe753bbf281ac67a5af71068c2d22c71ed4a7b6e0a24b235b78f9a  tests/structure-learning.test.mjs
b48d90b9c8a5e8e86da7bf46888cd7e96404675d30287deed197663d95a671f6  tests/mobile-card-holdings.test.mjs
f0fa1ad37e1a720bd24eb68aea42a689aba02c4d888d7b1b01ec14c9b31f3f4a  tests/fixtures/mobile-cards.mjs
3f9ffa30410b008297ee807df61a74d6f2a83924b48117c8b78b927308b7b078  tests/e2e/structure-learning.spec.mjs
```

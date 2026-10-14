# Toistaminen

Node 24.19.0 / npm 11.9.0. PDF.js-versio 6.4.299 tulee alkuperäisestä package-lockista. Älä muuta riippuvuuksia tai D:n kansiota.

```bash
git clone https://github.com/naatti21/appeja-import-engine.git structure-reliability
cd structure-reliability
git checkout research/structure-reliability-v1
npm ci --ignore-scripts --no-audit --no-fund
git fetch origin research/blindtest-v1
mkdir -p ../structure-dev-input
git archive 72520b612444994741f6d09655e8c2f08f279308 research/blindtest-v1 | tar -x -C ../structure-dev-input
node --import ./research/ablation-layout-vocab-v1/node-compat.mjs research/structure-reliability-v1/harness.mjs ../structure-dev-input/research/blindtest-v1 research/structure-reliability-v1 > research/structure-reliability-v1/RUN_LOG.txt 2>&1
node research/ablation-layout-vocab-v1/regressions.mjs research/structure-reliability-v1/ORIGINAL_REGRESSION_RESULTS.json > research/structure-reliability-v1/ORIGINAL_REGRESSION_LOG.txt 2>&1
node research/structure-reliability-v1/e-regressions.mjs > research/structure-reliability-v1/E_REGRESSION_LOG.txt 2>&1
node research/structure-reliability-v1/adversarial.mjs > research/structure-reliability-v1/ADVERSARIAL_LOG.txt 2>&1
node --expose-gc research/structure-reliability-v1/benchmark.mjs D > research/structure-reliability-v1/BENCHMARK_D_LOG.txt 2>&1
node --expose-gc research/structure-reliability-v1/benchmark.mjs E > research/structure-reliability-v1/BENCHMARK_E_LOG.txt 2>&1
node research/structure-reliability-v1/validate.mjs
```

Uusinta päivittää vain uuden tutkimuskansion outputeja. Säilytä alkuperäinen commit erillisessä checkoutissa jos haluat vertailla arkistoituja tavutarkisteita: ajat ja muisti vaihtelevat. Vanhaa regressioskriptiä ei saa ajaa oletusoutputilla, koska se kirjoittaisi vanhan tutkimuksen tulostiedoston uusiksi. Yllä annetaan tarkoituksella uusi output-polku.

Varmista `git diff 7d7498983c78825c9fde48d31893ae5a3a416601 -- src package.json package-lock.json research/ablation-layout-vocab-v1`: tyhjä. Uuden tutkimuscommitin parent on täsmälleen tämä SHA. Harness tarkistaa 64 paikallista muuttumatonta vanhan tutkimuksen ja importoitujen baseline-moduulien/lockfilejen blobia sekä fixturejen blobit ja manifestin SHA-256:t, ja tarkistaa vanhat tiedostot uudelleen ajon lopussa. D:n koko layout/parsed-output täsmää vanhaan raw/D-tiedostoon 6/6.

## Mittaussopimus

Raakateksti: tunnetun GT-alueen tokenit, whitespace-normalisoitu includes, merkit ja numerot säilyvät. Sijainti: oikea sivu ja token-keskipiste GT-boxissa ±2/3 pt. Core: täsmäävä verified-arvo ja oikean arvo- sekä otsikkoalueen source-ID:t. Ehdotukset eivät käytä GT:tä poimintaan.

Sidoksen precision/recall: value_source_ids:n koko teksti täsmää GT-raw:iin whitespacea lukuun ottamatta; kaikkien arvolähteiden tulee olla GT-arvoalueella ja label-lähteiden GT-labelalueella. Sama varma GT-sidos lasketaan vain kerran. Denominaattori recallissa on kaikki 87 essential-labelbbox-kenttää, myös tukemattomat. Precision pisteyttää vain arvolähteeltään GT:hen paikannettavat ehdotukset; muut ovat unscored, eivät automaattisesti vääriä. D:n alkuperäiset horizontal-/vertical-local-ehdotukset tulkitaan vertailussa implisiittisesti varmoiksi; D:n outputia ei muuteta. Vanha legacy scoreStructure säilyy erikseen rinnakkaismittarina.

Epävarmoista riveistä ja sarakehypoteeseista löytyvä oikea vaihtoehto raportoidaan erikseen, ei verified- tai certain-onnistumisena. Sama arvo eri GT-boxissa on eri sidos. Record-probe vaatii kaikkien GT-recordin lähteiden sisältymistä yhteen riviin ilman muiden recordien lähteitä; ei täydellinen tietuegraafin mittari.

Regressiot käyttävät in-memory-havaintoja, eivät PDF.js:ää. ADVERSARIAL_CASES.json SHA tarkistetaan preregistraatiosta ennen jokaista ajoa. Oraclea ei pidä muuttaa tulosten vuoksi. ARTIFACT_HASHES.json koskee alkuperäistä arkistoa, ei kellon/muistin vuoksi tavuiltaan muuttuvaa uusintaa. RUN_MANIFEST dokumentoi lähteet/ympäristön; raw-tiedostojen hashit RESULTS.json:ssa.

## Selain

`npx playwright install chromium` yritettiin: exit1, truncated ZIP ja HTTP400 GatewayExceptionResponse; executable puuttuu eikä system-chromiumia löydy PATHista. BROWSER_INSTALL_LOG.txt ja BROWSER_STATUS.json säilyttävät eston. Selainharnessia ei toteutettu eston jälkeen; selain/Android NOT RUN. Node-tulosta ei saa nimetä selaintestiksi. Node tarvitsee samat D:n erilliset toHex-aputoiminnot; baselinea tai PDF.js:ää ei muuteta.

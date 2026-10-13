# Toistaminen

Tarvitaan Git, Node 24.19.0 ja npm 11.9.0, verkkoyhteys npm-paketteihin ja julkiseen repoon. Ei HOLDOUTia eikä maksullisia palveluja.

```bash
git clone https://github.com/naatti21/appeja-import-engine.git baseline-v07-dev
cd baseline-v07-dev
git checkout research/baseline-v07-dev
npm ci --ignore-scripts --no-audit --no-fund
git fetch origin research/blindtest-v1
mkdir -p ../dev-fixtures
git archive 72520b612444994741f6d09655e8c2f08f279308 research/blindtest-v1 | tar -x -C ../dev-fixtures
node --import ./research/baseline-v07-dev/node-compat.mjs research/baseline-v07-dev/harness.mjs ../dev-fixtures/research/blindtest-v1 research/baseline-v07-dev > research/baseline-v07-dev/RUN_LOG.txt 2>&1
```

Tarkista ennen ajoa, että tutkimuscommitin parent on `8f28544651a27225c1212228753fbc6c6a265c38`, ja `git diff 8f28544651a27225c1212228753fbc6c6a265c38 -- src package.json package-lock.json` on tyhjä. Älä käytä myöhempää parseriversiota. Tutkimuspolun alkuperäisten tulosten säilyttämiseksi voi antaa viimeiseksi parametriksi uuden output-kansion.

Harness lukee manifestin, tarkistaa SHA-256:t ja käyttää vain kuutta DEV-PDF:ää/annotaatiota. Viallinen PDF/annotaatiopari saa BLOCKED_INTEGRITY-tuloksen. Testaa manifestin kaikkien tiedostojen match-arvot erikseen. PDF.js-versio assertataan 6.4.299:ksi. Harness ei ole uusi parseri: se kutsuu readPdfWithPdfJs:ää ja parsePayrollSections:ää muuttamattomina. GT-alueita käytetään vasta jälkeenpäin mittaukseen. T01–T03:n palkka-adapterikutsu on turvallisuus-/tyyppiprobe; vieraan domainin semantiikkaa ei pisteytetä.

Raw-vertailu on whitespace-normalisoitu osamerkkijono tunnetun bbox-alueen tokenien yhdistelmässä. Siksi reader-luku ei mittaa annotoimattomia merkkejä eikä irrallista solutunnistusta. Semantic exact_core_match vaatii verified-arvon ja oikeiden arvo-/otsikkoalueiden source-ID:t. Muistiluvut ovat process.memoryUsage-näytteitä, eivät huippuja; ajoajat vaihtelevat. RUN_MANIFEST:n alkuperäinen source_unchanged-lippu perustuu tämän tutkimuksen erilliseen git-blob-tarkistukseen: uusinta-ajossa tee yllä oleva git diff itse, älä luota lippuun yksin.

Ensimmäisen runtime-virheen voi toistaa ilman --import-apua Node-versiossa, josta Uint8Array.toHex puuttuu. Tallenna erilliseen outputiin, älä peitä nykyisiä tuloksia. Chromium-asennuksen lokissa nähtiin tyhjä/katkennut ZIP ja GatewayExceptionResponse; selaintestiä ei tehty. Myöhempi selainvarmennus on erillinen ympäristökoe ja saa käyttää samoja kuutta tiedostoa, mutta sen tuloksia ei pidä sekoittaa tähän Node-ajoon.

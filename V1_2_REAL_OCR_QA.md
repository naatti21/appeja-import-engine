# v1.2: oikea paikallinen selaimen OCR-QA

**Tavoite:** ennen mobiilikäyttäjää oikeasti renderöidyt synteettiset kuvat luetaan Tesseract.js:n avulla selaimessa, eikä vain valmiiksi purettua TSV-tekstiä. Riippumaton testioraakkeli sisältää ennen piirtoa syntyneen instrumenttitunnuksen, määrän, kurssin ja nykyarvon.

## Toteutus

- `scripts/prepare-local-ocr.mjs`: stageaa npm:n Tesseract.js 5.1.0 -skriptit ja core-WASM-tiedostot sekä **pinnatut** `eng`- ja `fin`-kielimallit Tesseractin tessdata_fast Git-commitista `87416418657359cb625c412a48b6e1d6d41c29bd`. Luo SHA256-manifestin CI-artefaktien todentamiseen.
- Ajossa selain hakee OCR-työntekijän, koodin ja koulutetut mallit **vain samasta alkuperästä** `/demo/vendor/ocr`. Testi estää muut HTTP-isännät. Käyttäjän tiedostoa ei lähetetä ulkopuoliselle OCR-palvelulle.
- `demo/review.mjs` ei enää lataa ajettavaa OCR-koodia CDN:stä. Jos paikalliset assetit puuttuvat, analyysi **epäonnistuu näkyvästi**, ei putoa CDN-varareitille.
- `tests/e2e/qa-real-ocr.spec.mjs`: 16 pikseleinä renderöityä fiktiivistä salkkukorttia; 2 determinististä siementä, vaalea/tumma teema, kolme luettavuustasoa, PNG/JPEG, 4 kentän itsenäinen oracle, ei hiljaista hyväksyntää. Lisäksi selaimen oikean UI:n `fin+eng` OCR -smoke ja todiste `review-required`-käyttäytymisestä. Tulos raportoidaan **täsmällisen kenttäosuman** ja koko rivin osuman mukaan.
- QA-portti on tarkoituksella konservatiivinen: vähintään kolme kahdeksasta selkeästä baseline-kortista kokonaan oikein ja vähintään 20/64 kenttää oikein. Tämä on *minimitoteutettavuusportti*, ei riittävä laatukynnys varsinaiseen käyttäjätestiin. Kaikki virheelliset rahaluvut pidetään epävarmoina.

## Riskit ja rajoitukset

- OCR-mallit ja ajettava kirjasto ladataan **build/QA-vaiheessa** julkisista upstream-lähteistä; ne tarjotaan selaimelle saman palvelimen kautta. Tämä ei vielä tarkoita offline-PWA:ta, turvallista sovellukseen integrointia tai kolmannen osapuolen riippumattomasti auditoitua koodia.
- NPM:n QA-työ `npm install --no-save --no-package-lock` käyttää pinned top-level -versiota, mutta kaikkia transitiivisia riippuvuuksia ei ole vielä lukittu ohjelmiston varsinaiseen lockfileen. Ennen julkaisemista ne lukitaan ja koko paketti auditoidaan.
- Selaimen OCR voi palauttaa vääriä numeroita ja jopa hyvän confidence-arvon. **Sitä ei saa hyväksyä automaattisesti.** Kuvan pikseleistä tunnistettujen sanojen oikea sarakemääritys ei vielä ole valmis.
- Käyttäjän alkuperäisiä henkilötietoja tai sijoituksia **ei** koskaan käytetä näissä GitHub-testeissä. Vain itse tehtyjä synteettisiä kuvia ja määriä.
- Riippumaton QA, fyysinen Android, vieraiden välittäjien tosiaineisto, tilien tunnistaminen ja tuotantointegraatio **NO-GO**.

## Tarkka uusinta-ajo

`npm ci` → `npm install --no-save --no-package-lock --ignore-scripts tesseract.js@5.1.0` → `node scripts/prepare-local-ocr.mjs` → `npm run test:e2e -- --grep "QA genuine same-origin|QA real on-device"`. Toistettavuus varmistetaan PINNATULLA kielimallin Git-SHA:lla ja deterministisillä siemenillä; mutta npm:n transitiiviset riippuvuudet voivat vielä vaihdella.

Kaikki tuotantosovellukset ja LABin main-haara ennallaan; PR pysyy Draft.

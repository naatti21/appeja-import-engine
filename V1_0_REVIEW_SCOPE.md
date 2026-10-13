# LAB v1.0 — mobiilin esitarkistus (vain tutkimus)

## Toteutetut reitit

- `demo/review.html` + `demo/review.mjs`: tiedoston valinta → paikallinen lukija → lähdeviitteet → kenttäehdokkaat → estot. Ei tallennustoimintoa.
- CSV/TSV: salkkuehdokkaat nykyisestä CSV-sovitinlogiikasta.
- XLSX: oikeat pakatut OOXML-tavut, useita välilehtiä ja solulähdeviitteet. Tuntematon välilehti / kaavat jäävät tarkistettaviksi.
- PDF: oikea PDF.js, tunnetun palkkadokumentin neljä ydinkenttää lähdeviitteineen; tuntematon PDF pelkkinä havaintoina.
- Kuva: käyttäjän käynnistämä Tesseract.js:n fin+eng-kirjasto ja OCR-tekstirivien näyttö. **EI** vielä automaattista osakesalkun tulkintaa.
- Kaikki: ei kirjoitusta Palkka- eikä Osakevahti-sovellukseen, ei pysyvää tallennusta, ei automaattista hyväksyntää.

## Tietosuoja ja puutteet

Alkuperäiset viisi yksityistä palkka-PDF:ää ja neljä kuvakaappausta eivät ole julkisessa repossa eivätkä CI:ssä. Vain synteettisiä testitiedostoja käytetään. PDF.js on paikallisesti versiolukittu. **OCR-koodi ja kielimallit ladataan kokeessa kolmannen osapuolen CDN:stä**. Ennen auditoitua itse hostattua OCR-kirjastoa oikeiden arkaluonteisten kuvien käsittelyä tämän LAB-UI:n kautta ei suositella. Tavoiteltu offline-käsittely ei siis vielä ole valmis.

Chromiumin kuva-OCR UI -testi käyttää **simuloitua Tesseract TSV -tulosta**, ei todellista kuvapikseleistä tehtyä OCR-luentaa. Aiempi yksityinen paikallinen Tesseract CLI -koe on eri asia. PDF:n tuntemattomien palkka-asettelujen virheetöntä tulkintaa ei ole vielä osoitettu.

## Testaaminen

`npm ci && npm run test:e2e`, katso `tests/e2e/mobile-review.spec.mjs`. PR-haaran GitHub Pages -esikatselun toimivuutta **ei ole oletettu**. Erillinen turvallinen puhelimella avattava preview pitää toteuttaa hyväksytyllä jakelutavalla.

**Tuotanto / riippumaton QA / oikea Android / pilvijakelu: NO-GO.**
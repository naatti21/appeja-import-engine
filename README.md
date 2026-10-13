# Äppejä Import Engine Lab — v0.2 (eristetty koe)

**Tila 13.10.2026:** paikallinen synteettinen prototyyppi. **EI tuote, EI tuotantointegraatio, EI riippumaton QA-hyväksyntä.** Ei oikeaa käyttäjädataa.

Tämä on oma tutkimusrepo. Palkka PWA:n, Osakevahdin ja Visual Academyn päähaarat, QA-kandidaatit sekä käyttäjätiedot pysyvät koskemattomina.

## Mitä prototyypissä on

- `src/layout.mjs`: PDF.js:n tekstielementtien sijaintitiedon säilyttävä rajattu käsittely. Tukematon geometria jää havaintona ja estävänä ongelmana näkyviin.
- `src/payroll.mjs`: synteettisten palkkakertymätaulukoiden geometriakoe. 42 000 / 43 000 -ristiriita estää automaattihyväksynnän; identtiset toistot eivät ole ristiriita.
- `src/csv.mjs`: CSV/TSV, lainausmerkit ja rivinvaihdot lainausmerkkien sisällä; lähdesolujen jäljitys.
- `src/holdings.mjs`: CSV-omistusehdokkaat; puuttuva hankintahinta eroaa nollasta, välittäjä on eri asia kuin tilityyppi, erilaiset MIC-listaukset pysyvät erillisinä.
- `src/numbers.mjs`, `src/evidence.mjs`: numeroiden tiukka jäsennys ja lähteisiin sidottu ristiriitatarkistus.
- `demo/`: mobiiliystävällinen selainkoe **vain synteettisillä tiedoilla**.
- `tests/`: riippuvuudettomat Node-testit; testauksen rajat kuvataan tiedostossa `QA_STATUS.md`.

## Testaaminen

```bash
npm test
```

Demon paikallinen käyttö (tarvitsee HTTP-palvelimen ES-moduuleille):

```bash
python3 -m http.server 8080
```

Avaa `http://localhost:8080/demo/`. Julkiseen GitHub Pagesiin demoa ei ole tässä työvaiheessa julkaistu. Älä syötä oikeaa PDF-, palkka- tai salkkutietoa.

## Mitä EI vielä ole

- PDF.js-kirjastoa ei ole liitetty demoon. `readPdfWithPdfJs()` käyttää injektoitua PDF.js-oliota; testit käyttävät mockia, eivät oikeaa PDF-tiedostoa. Kierretty tai rajattu PDF-sivu estetään.
- Skannattujen PDF:ien renderöinti, todellinen OCR ja XLSX eivät sisälly vaiheeseen.
- Yleiskäyttöinen taulukon ja sarakkeiden segmentointi ei ole todistettu: Palkka-adapteri tunnistaa rajattuja synteettisiä otsikoita.
- Oikean puhelimen suorituskykymittaus, selaimen E2E, nykyisten parsereiden rinnakkaisvertailu ja riippumaton QA puuttuvat.
- Ei tallennusta, API-kutsuja tai maksullista AI:tä. `canAutoAccept` tarkoittaa vain koneellisen ehdokkaan eheyttä, **ei käyttäjän hyväksyntää eikä automaattista tallennusta**.

## Seuraavat portit

1. Tarkista koordinaattimuunnokset, CSV:n rajatapaukset ja havaintojen kattavuus kriittisesti.
2. Lisää aito PDF.js ja **oikeat mutta täysin synteettiset PDF-tiedostot** selain- ja Node-testeihin.
3. Tee nykyparserien kanssa rinnakkaisvertailu 25 perusasettelulla sekä virhemuunnelmilla.
4. Mittaa Android-laitteella lataus, nopeus, muisti ja offline-käyttö. Integraatiosta päätetään erikseen.

## Tietosuoja ja turvallisuus

Demo ei tallenna tietoa IndexedDB:hen tai localStoragean eikä sisällä `fetch`-kutsuja. Kaikki syötteet käsitellään väliaikaisesti sivun muistissa. GitHub-repo sisältää vain tutkimuskoodia ja tarkoituksella keksittyjä testiarvoja. Käyttäjien todellisia dokumentteja ei viedä tähän repoon.

Lähdekoodi on kehityskandidaatti. GitHub Actionsin mahdollinen vihreä Node-tulos ei ole riippumaton QA-GO.

## v0.2: oikean PDF.js-lukupolun eristetty tutkimus

- Täysin synteettiset **oikeat PDF-tavut** luodaan paikallisesti `demo/native-pdf.mjs`-moduulissa. Käyttäjän dokumentteja ei avata.
- `pdfjs-dist` versio **6.4.299**, sama pinnaus kuin Palkan kehityskandidaatissa. `npm run prepare:pdfjs` kopioi PDF.js:n ja workerin paikalliseksi resurssiksi `demo/vendor/pdfjs/`.
- Chromium-testi käy läpi polun: oikea PDF -> PDF.js worker -> alkuperäiset tekstielementit ja koordinaatit -> sovelluskohtainen kertymätulkinta -> ristiriidan esto.
- `npm test` ajaa 34 Node-testiä; `npm run test:e2e` ajaa erilliset Chromium-testit. `npm ci` asentaa testiriippuvuudet.
- `demo/index.html` sisältää painikkeen **Oikea PDF.js · kaksisivuinen testi**. Demoon ei lisätty käyttäjän tiedoston latausta, koska tutkimus käsittelee toistaiseksi vain testiaineistoa.

Rajoitus: tämä ei tunnista mielivaltaisia palkkalaskelmia. Kierretyt/rajatut PDF-sivut, skannatut PDF:t, OCR ja puhelimen todellinen suorituskyky puuttuvat edelleen. API-laskutusta, käyttäjätietojen tallennusta tai sovellusintegraatiota ei ole.

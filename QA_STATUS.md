# Äppejä Import Engine — v0.1 QA-tilanne

**Päivä:** 13.10.2026  
**Kohde:** eristetty synteettinen LAB-prototyyppi. GitHubissa tarkka arvioitava SHA näkyy PR:n head-commitissa.  
**Tila:** paikalliset kehittäjätestit PASS; GitHub Actions tarkistettava tällä SHA:lla; riippumaton QA NOT RUN; tuotantointegraatio NO-GO.

## Ajetut paikalliset testit

- `npm test` Node: **32 / 32 PASS** (13.10.2026, prototyypin lähdekoodipaketista ennen GitHub-siirtoa).
- P0-03: saman kentän eri YTD-luvut samassa PDF-sivussa -> ristiriita.
- P0-04: kahden sivun YTD 42 000 / 43 000 -> molemmat havainnot säilyvät ja automaattihyväksyntä estyy.
- Identtiset toistot ja sarakejärjestyksen vaihto, puuttuva sarake, virheellinen geometria, negatiivinen määrä.
- CSV: lainausmerkkien sisäiset rivinvaihdot, eri erottimet, nolla vs. puuttuva, MIC-erot, ISIN-tarkiste, virheelliset määrät, tuntematon sarake ja koko erän esto.

## Ei testattu / ei väitetä läpäistyksi

- **Chromium-selaininteraktio: NOT RUN.** Aiemman paikallisen kokeen navigointi pysähtyi `ERR_BLOCKED_BY_ADMINISTRATOR` -rajoitukseen; ei merkitä tuotteen virheeksi eikä PASSiksi.
- **Oikea PDF.js todellisella synteettisellä PDF-tiedostolla: NOT RUN.** Nykyisissä Node-testeissä mockattu PDF.js-rajapinta.
- **Todellinen Tesseract/OCR: NOT RUN.**
- **Fyysinen Android-PWA: NOT RUN.** Ei julkaistua koetta.
- **Nykyisen Palkka/Osakevahti-parserin rinnakkaisvertailu samalla aineistolla: NOT RUN.**
- **Riippumaton QA: NOT RUN.**
- **Tuotanto / integraatio: NO-GO.**

## Seuraava tekninen portti

Rakennetaan oikeat synteettiset PDF:t ja testataan todellinen PDF.js-selainpolku sekä koordinaattien ja sarakerajojen jäljitettävyys. Laajennetaan koesarja 25 perusasetteluun ja niiden vaikeutettuihin muunnelmiin. Käyttäjän puhelintesti ja riippumaton QA vasta myöhemmin.

## v0.2 — tutkimuslisäys 13.10.2026

- Uusi PDF-tavugeneraattori tuottaa synteettisen kaksi-/monisivuisen PDF:n, ei mockattua PDF.js-ulostuloa.
- Paikalliset alkuperäiset 32 Node-testiä edelleen PASS; PDF-fixtureille lisätty kaksi Node-testiä. Chromiumin tulos tarkistetaan GitHub Actionsista lukitulle SHA:lle.
- Aidon PDF.js:n browser-P0-03, browser-P0-04, käänteiset sarakkeet, identtiset toistot ja puuttuva sarake testataan Playwrightilla. Ei merkintää PASS ennen CI-tulosta.
- **Android, OCR, skannatut dokumentit, tuntemattomat layoutit, riippumaton QA ja tuotantointegraatio: NOT RUN / NO-GO.**

## v0.3 change-specific developer QA (2026-10-13)

- Node baseline and new regression tests (36 total) completed in local isolated source copy: **36/36 PASS**.
- GitHub Actions on immutable PR commit must be read before classifying Chromium matrix results. New expected cases: 30 synthetic PDF layout scenarios plus baseline same-document line-folding evidence audit.
- **Important interpretation:** matching source token count or exact column boxes does not prove the production Palkka app has higher pay-field accuracy. The legacy comparator copies only the line-folding stage, not the full payroll parser or acceptance workflow.
- Gate: 0 silent false auto-accepts in this synthetic adversarial corpus, all intentionally conflicting/missing/unaligned data visibly blocked, normal layouts correct. Any FAIL requires a test-linked source change and a fresh full CI run.
- No live users, no uploads, no backend, no OCR; mobile device and independent QA **NOT RUN**, production **NO-GO**.

## v0.4: samadokumenttinen parserivertailu — tarkastamatta CI-portin yli

- Jäädytetty Palkka kehityskandidaatti: commit `550c765413c0916259c67b44ba8dfdb9b3f06da6` (parser.js, semantic-evidence.js; pdf-reader.js:n rivivaihe testidatan koostamisessa).
- 25 hallittua pohjakonfiguraatiota × (ehjä + ristiriitainen YTD + puuttuva YTD) = 75 täysin synteettistä oikeaa PDF-dokumenttia. Toisella sivulla oleva puuttuva YTD on rakenteellinen vaara, vaikka muilla sivuilla arvo säilyisi.
- CI:n hyväksyntäehto: uusista 25 ehjästä 25 täsmälleen oikein kaikissa 3 yhteisessä rahakentässä; 50 negatiivisesta 50 pysäytetty, oikealla perustelulla; 0 hävinnyttä geometriahavaintoa.
- Koko vanha `parsePayslip` suoritetaan; sen brutto/YTD/edellinen vuosi -osumien määrä, blokkausvaroitusten määrä sekä havaintojen granulaation ero kirjataan erikseen. Vain näiden kolmen yhteisen rahakentän vertailu on mielekäs tässä tutkimuksessa.
- Tämä on **kehittäjän synteettinen hyväksymiskoe**, ei tilastollinen näyttö oikeiden palkkalaskelmien tarkkuudesta tai automaattitallennuksen turvallisuudesta.
- **V0.4 Chromium ja Node tulos: NOT YET VERIFIED** tässä kirjallisessa muutoksessa. Riippumaton QA, fyysinen Android, OCR, todelliset tuntemattomat pohjat NOT RUN. Tuotanto NO-GO.

## v0.4 audit: isolated 3-column source-label correction

The initial frozen-parser comparison was **invalid as an accuracy competition**: our synthesized multi-column money row used only one field label, while Palkka `parallelCumulativeSummary()` intentionally requires individually labeled numeric columns. It correctly flagged the synthetic input as uncertain rather than inventing a mapping.

The latest laboratory-only fixture puts one `Ennakonpid.al.tulo` label beside each cumulative numeric cell on each test page. Neither the frozen Palkka parser nor any production app was modified. Re-check the **exact final CI run** before using the comparative counts. This remains synthetic exploratory evidence, not real-world sensitivity/specificity data.

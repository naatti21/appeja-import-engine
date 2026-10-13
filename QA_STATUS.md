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

# YÖAJO 06 — Structure Reliability V1

Tila: **rajattu Node-kehityskoe valmis**. E täyttää toimeksiannon DEV-tavoitteet, mutta tämä ei ole tuotantohyväksyntä eikä riippumaton yleistymisvalidointi.

Lukitut lähtökohdat:
- Parent ja muuttumaton D: `7d7498983c78825c9fde48d31893ae5a3a416601`.
- Alkuperäinen v0.7: `8f28544651a27225c1212228753fbc6c6a265c38`.
- Julkinen DEV: `72520b612444994741f6d09655e8c2f08f279308` / `research/blindtest-v1/`.
- PDF.js 6.4.299, Node 24.19.0, Playwright 1.57.0.

Tulokset RESULTS.md / RESULTS.json. Malli STRUCTURE_DESIGN.md, regressiot REGRESSIONS.md, puutteet FAILURES.md ja päätösehdotus DECISION.md. REPRODUCE.md sisältää ajokomennot. raw/ säilyttää kuusi oikeaa reader-outputia sekä 12 D/E-outputia. SOURCE_PINS.json, RUN_MANIFEST.json, PREREGISTRATION.json ja ARTIFACT_HASHES.json lukitsevat lähteet, odotukset ja artifaktit.

Vanha tutkimuskansio, src/, package.json ja package-lock.json ovat muuttumattomat. Uusi haara pohjautuu täsmälleen YÖAJO 05:n commitiin. Ei PR:ää, mergeä, tuotantointegraatiota tai muita LAB-versioita.

## Rajat ja riippumattomuus

Käytettiin vain kuutta julkista DEV-PDF:ää ja niiden muuttumattomia annotaatioita. HOLDOUTia, sen annotaatioita, ZIPiä tai luontiskriptejä ei avattu, haettu eikä käytetty tässä tehtävässä. Aiemmasta aineistonluontityöstä työtilassa on HOLDOUT-artifakteja; sama agentti on ollut aiempi tekijä. Kokonaan riippumatonta tekijäsokkoutusta ei siten väitetä. Myös uudet vastatestit ovat kehityskokeita.

Chromiumin lataus epäonnistui. Selain ja Android NOT RUN. Node käyttää samaa erillistä toHex-ympäristöapua kuin D:n aiempi mittaus; alkuperäistä PDF.js:ää tai parseria ei muutettu. Ei oikeita henkilötietoja eikä maksullisia palveluja.

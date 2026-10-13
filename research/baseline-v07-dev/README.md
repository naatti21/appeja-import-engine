# LAB v0.7 DEV-baseline — valmis rajattu mittaus

Tutkimus 13.10.2026. Baseline `8f28544651a27225c1212228753fbc6c6a265c38`; DEV-lähde `72520b612444994741f6d09655e8c2f08f279308`, polku `research/blindtest-v1/`. Kaikki kuusi DEV-PDF:ää käsiteltiin oikealla PDF.js 6.4.299:llä ja baselinen omilla reader-/adapterifunktioilla. Parseria tai riippuvuuksia ei muutettu. Tämä ei ole selaintestin tulos.

Node 24.19.0 tarvitsi erillisen Uint8Array.toHex-ympäristöavun. Ensimmäinen estynyt ajo säilyy ENVIRONMENT_FAILURE.json:ssa. Chromiumin lataus epäonnistui, joten selain-/Android-tuloksia ei ole. Tarkat mittausrajat: RESULTS.md; toisto: REPRODUCE.md; koko output: raw/*.json.

## Riippumattomuus ja sokkoutus

Sama agentti laati aiemman synteettisen aineiston ja tämän mittauksen. Mittaus ei siten ole tekijästä riippumatonta QA:ta. Ground truthia ei muutettu eikä syötetty parserille. HOLDOUTia ei avattu, ladattu tai käytetty tässä työvaiheessa. Aikaisemmasta aineistonluontityöstä on työtilassa HOLDOUT-artifakteja ja sama tekijä on aiemmin tuntenut aineiston: koko projektin sokkoutusta ei voi tämän perusteella todistaa. Vain julkinen DEV on tässä commitissa.

## Sisältö

RUN_MANIFEST.json: lukitukset, tarkisteet ja ympäristö. RESULTS.json / RESULTS.md: dokumenttikohtaiset tulokset. FAILURE_ANALYSIS.md: juurisyyt. harness.mjs / node-compat.mjs: rajattu mittauskoodi. raw/: kuusi todellista reader- ja adapteritulosta sekä annotaatiovertailut. RUN_LOG.txt: viimeisen mittauksen loki. ENVIRONMENT_FAILURE.json: ensimmäisen estyneen ajon tulokset.

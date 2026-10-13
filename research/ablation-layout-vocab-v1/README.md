# YÖAJO 05 — rakenne vastaan semantiikka

**Tila: neljän vaihtoehdon Node-koe valmis; selainajo estynyt.** Tutkimuspäivä 14.10.2026 Suomen aikaa (ajolokin UTC voi olla 13.10.). Kuusi julkista DEV-PDF:ää, 24 variantti-/dokumenttiarviointia, lisäksi 8 erillistä muistihavaintoregressiota × 4 varianttia. Ei tuotantohyväksyntää.

Lukitukset:
- LAB v0.7: `8f28544651a27225c1212228753fbc6c6a265c38`.
- YÖAJO 04: `1af65c9b8648dafbc8f44ec9d202884be0ace052`.
- DEV: `72520b612444994741f6d09655e8c2f08f279308`, `research/blindtest-v1/`.
- PDF.js 6.4.299; Node 24.19.0; Playwright 1.57.0. Alkuperäinen package-lock muuttumaton.

Lue RESULTS.md ja DECISION.md. Kokeen rajaus ja sanastolähteet EXPERIMENT_DESIGN.md:ssä. Toisto REPRODUCE.md:ssä. raw/ sisältää kuusi oikeaa lukutulosta ja 24 varianttitulosta. REGRESSION_RESULTS.json sisältää kaikki 32 erillistä regressio-outputia. Tarkisteet RUN_MANIFEST.json, SOURCE_PINS.json ja ARTIFACT_HASHES.json.

## Riippumattomuus

Tämä on DEV-kehityskoe. Sama agentti laati aiemmin aineiston, mittasi baselinen ja toteutti tämän kokeen. Ei riippumatonta yleistymisnäyttöä eikä riippumatonta ihmisvalidointia. Otsikkosanasto käyttää tehtävän esimerkkejä ja DEV:n julkisia otsikkotekstejä; tämä on tarkoituksellista kehitysaineistoon sovittamista, ei sokkotesti.

HOLDOUTia, sen annotaatioita tai luontiskriptejä ei tässä työssä avattu/hankittu/käytetty. Aiemmasta luontityöstä työtilassa on HOLDOUT-artifakteja ja tekijä on aiemmin tuntenut aineiston: koko aiemman sokkoutuksen puhtautta ei väitetä. Tässä haarassa on vain tämän DEV-kokeen koodi ja tulokset. LAB v0.8–v1.0 -koodia ei käytetty.

Baselinen src/, package.json ja package-lock.json säilyvät tavuiltaan alkuperäisinä. GitHub-haara perustuu täsmälleen v0.7-commitiin. Ei PR:ää, mergeä, tuotantosovellusten muutoksia eikä maksullisia palveluja.

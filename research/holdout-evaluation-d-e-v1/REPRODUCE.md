# Toisto

Checkout E:n SHA tai tämän tutkimuksen commit. Asenna alkuperäisellä lockfilella `npm ci --ignore-scripts --no-audit --no-fund`. Älä muuta kandidaatteja. Varmista yksityisen alkuperäis-ZIPin SHA-256; pura vain kuusi HOLDOUT/*.pdf -tiedostoa erilliseen private/input-hakemistoon, ei SOURCES-tiedostoja.

Ennen ajoa varmista PREREGISTRATION.json:n harness-/protokollatarkisteet ja SOURCE_PINS.json. Käytä uutta yksityistä output-hakemistoa.

```bash
node --import ./research/ablation-layout-vocab-v1/node-compat.mjs research/holdout-evaluation-d-e-v1/run.mjs /private/input /private/results
```

Vasta OUTPUT_FREEZE.json:n synnyttyä pura ANNOTATIONS/HOLDOUT/*.json erilliseen private/annotations-hakemistoon. Parserin outputit ovat jäädytettyjä. Älä syötä manifestia tai annotaatioita run.mjs:lle.

```bash
node research/holdout-evaluation-d-e-v1/evaluate.mjs /private/annotations /private/results
```

Kaikki lokit ja outputit yksityisesti. Älä tallenna niitä repoon, CI:hin tai Actionsiin. Kellonaika/muisti vaihtelevat; layout/parsed-outputien tulee toistua. Ei oletusarvoista artifact-uploadia. Julkinen raportti käyttää vain aggregaatteja. Varmista erikseen ettei diff sisällä yksityisiä tiedostoja. Sivujatkos/monirivi-mittarin rajat protokollassa. Ei toimivaa selainharnessia; NOT RUN.

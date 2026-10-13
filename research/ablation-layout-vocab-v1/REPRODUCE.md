# Täsmällinen toisto

Tarvitaan Git, Node 24.19.0 ja npm 11.9.0. Maksullisia palveluja ei tarvita. HOLDOUTia ei haeta.

```bash
git clone https://github.com/naatti21/appeja-import-engine.git ablation-v1
cd ablation-v1
git checkout research/ablation-layout-vocab-v1
npm ci --ignore-scripts --no-audit --no-fund
git fetch origin research/blindtest-v1 research/baseline-v07-dev
mkdir -p ../ablation-dev-input ../ablation-04-input
git archive 72520b612444994741f6d09655e8c2f08f279308 research/blindtest-v1 | tar -x -C ../ablation-dev-input
git archive 1af65c9b8648dafbc8f44ec9d202884be0ace052 research/baseline-v07-dev | tar -x -C ../ablation-04-input
node --import ./research/ablation-layout-vocab-v1/node-compat.mjs research/ablation-layout-vocab-v1/harness.mjs ../ablation-dev-input/research/blindtest-v1 ../ablation-04-input/research/baseline-v07-dev ../ablation-rerun > ../ablation-rerun-log.txt 2>&1
node research/ablation-layout-vocab-v1/regressions.mjs ../ablation-regressions-rerun.json
```

Harness assertataa PDF.js-version, alkuperäisten importoitujen moduulien ja lockfilejen git-blob-tarkisteet, aiemmat viisi baseline-raporttia, julkisen manifestin sekä DEV-tiedostojen SHA-256:t ja blobit. A:n core-output, verified-fields ja decision verrataan lukittuun YÖAJO 04:ään; ero pysäyttää ajon. RUN_MANIFEST sisältää käytetyt lähdekoodi-/aineistotarkisteet ja ympäristön; raw-outputien SHA-256:t RESULTS.json:ssa. check-isolation.mjs assertataa kokeellisen parserikopion rajatun diffin.

Tarkista lisäksi `git diff 8f28544651a27225c1212228753fbc6c6a265c38 -- src package.json package-lock.json`: tyhjä. Tutkimuscommitin parent on lukittu v0.7. Uusinnan kellonaika, ajankesto ja prosessin muistinäytteet vaihtelevat; tuloskenttien ja lähdeviitteiden pitää täsmätä. ARTIFACT_HASHES.json:n tarkisteet koskevat arkistoitua ajoa, eivät uusinnan muuttuvia mittauslukuja.

## Mittauksen rajat

Raw-match whitespace-normalisoi tunnetun GT-alueen yhdistettyjä tekstejä ja käyttää includes-vertailua. Ei täydellinen CER. Core exact-match vaatii oikean arvon sekä lähde-ID:n osuman oikeaan arvo- ja otsikkoalueeseen. Aluevertailu käyttää tokenin keskipistettä ±2/3 pt; GT:n solualue ei ole glyfien tiukka bbox, joten IoU-lukuja ei keksitä.

Structure-pair precision arvioi vain eksplisiittisiä label/value-source-ID-pareja, joiden arvolle GT määrittelee otsikon. Pairs_scored-denominaattoria ei pidä sekoittaa 87 GT-kenttään tai koko taulukon kattavuuteen. Record-probe mittaa yhden rivin kaikkien GT-lähdehavaintojen läsnäoloa ja muiden recordien sekoittumista; ei vaadi tuntematonta graph-outputia.

no_notice_essential erottaa verified-kentän/rivin viitteen, paikallisen UNACCOUNTED_MATERIAL-varoituksen ja ydinkentän MISSING_FIELD-varoituksen. Mukana on myös tukemattomia domainhavaintoja. unassigned_numeric_observations on sama raportointiapu kaikille vaihtoehdoille eikä vaikuta parseriin tai hyväksyntään.

Regressiot ovat erillisiä synteettisiä in-memory-havaintoja. Niiden 32/32 ei lisää DEV:n denominatoriin yhtään kenttää eikä dokumenttia. Muistinäytteet ovat koko Node-prosessista, eivät peak- tai mobiilimittoja. Sama readeroutput kaikille vaihtoehdoille estää lukuversion vaihtumisen.

## Selain

`npx playwright install chromium` suoritettiin: exit1, tyhjä/katkennut ZIP ja HTTP400 GatewayExceptionResponse. BROWSER_INSTALL_LOG.txt säilyttää eston, BROWSER_STATUS.json merkitsee NOT RUN. Tässä paketissa ei ole toteutettua selainharnessia eikä väitettyä Chromium-PASSia. Yhteinen toHex-shim on v0.7 Node-ympäristöapu, ei parseri-/PDF.js-päivitys. Saatavilla olevalla selaimella myöhempi selainvarmennus on erillinen koe, ei tämän ajon täydentämistä simuloidulla tuloksella.

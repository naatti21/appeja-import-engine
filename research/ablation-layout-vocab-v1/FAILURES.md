# Epäonnistumiset ja juurisyyt

Koodiviitteet ovat tutkimuskansion moduuleihin, ellei src/-polkua mainita. Raw/<variant>/<id>.json sisältää todellisen layoutin, parsed-outputin, core-arvioinnin ja muutostekstit. RESULTS.json sisältää pair_evaluations- ja record_links-todisteet.

|Tapaus|Odotus / havainto|Vaihe ja vakavuus|Juurisyy / seuraava rajattu koe|
|---|---|---|---|
|P01 payDate A/C|Odotettu 2026-05-22; missing ja UNPARSEABLE_LABELED_AMOUNT. B/D oikein|Rakenne → semantiikka; korkea kattavuusvaikutus|src/layout.mjs rowsFromObservations yhdistää Jakson päivään; strict isoDate ei hyväksy rivin koko häntää. structure.mjs paikallispari erottaa ne|
|P01 gross A/B/C|Brutto oikein vain D:ssä|Rakenne × sanasto; korkea|Rivi alkaa Vero-labelista; bruttoalias ei ankkuroitu rivin alkuun ennen paritusta. D erottaa ensin ja normalisoi sitten|
|P02 gross/net/YTD A/B/C|Arvot luettu, mutta oikein vain D:ssä|Pystyrakenne × sanasto; korkea|Labelit ja arvot eri riveillä; C ei saa hakea arvoa toiselta riviltä. B:n samassa kortissa tehty paritus sekä C:n alias tarvitaan|
|P03 payDate kaikki|missing vaikka GT määrittelee päivämäärän|Semanttinen epävarmuus; dokumenttivalmius estyy|Maksu kirjataan voi tarkoittaa kirjaamispäivää. Ei turvallista olettaa paymentDateksi pelkän DEV-GT:n vuoksi. GT:n roolimääritys on suunnittelijan tavoite, ei yksin semanttinen auktoriteetti; tarvitaan eksplisiittinen rooli/käyttäjän vahvistus|
|P02/P03/T01/T02 soluehdotukset B/D|7/33 väärin; P02 cell-8/9, P03 cell-2/3, T01 cell-1/2, T02 cell-2|Rakenne; korkea yleiskäyttöisyyden rajoite|structure.mjs horizontal-local tulkitsee label + useita numerokenttiä yhdeksi soluksi eikä käytä sarakeotsikoita. Erota numerorunit ja moninumeroinen taulukkorivi; palautetaan epävarma row, ei varmaa solua|
|T01 h1/h2 B/D|Kaikki tekstit säilyvät mutta valuutta irtoaa record-rivistä: 0/2 kokonaisia vs A/C 2/2|Rakenne; todellinen regressio|Teksti→numero→teksti -splitteri tulkitsee suffix-valuutan seuraavaksi labeliksi. Seuraava koe: pair-splitti vain yksiselitteisille paikallispareille, muut rivit säilyvät row-ehdokkaina|
|P01 r4 / P03 r3 / T02 i2 kaikki|Monirivinen record ei yhdessä rivissä|Osittain toteuttamaton rakenne|Baseline y-kynnys erottaa osat. Tutkimus säilyttää osat ja joitakin multiline-proposals, mutta ei varmista tietuetta; täydellistä onnistumista ei väitetä|
|P01–P03 palkkarivit kaikki|0/9 GT-palkkariviä|Semantiikka, tarkoituksellinen rajaus|src/payroll-lines.mjs RULES ja osion otsikot rajalliset; koodeja ei lisätty tässä. Yleinen tuntematon row-representation on jatkotutkimuskohde|
|Kaikki kattavuus|44/87 GT-havainnosta ei localized material/core-missing-noticea|Kattavuus/hyväksyntä; latentti turvallisuusriski|src/payroll-sections.mjs moneyRegex rajaa materialin; structure/vocab ei korjaa tätä. Kaikki testidokumentit kuitenkin review-required; actual silent acceptance 0/6 per variantti|

## Mitä ei luokitella bugiksi

Lasku-/varasto-/PDF-omistusadapteria ei ole. UNKNOWN_DOCUMENT_TYPE on oikea turvallisuusratkaisu, eikä palkkasemantiikan prosenttia lasketa T01–T03:sta. P03:n aidosti puuttuva nettopalkka on oikein käsitelty kaikissa. Sarake-/record-probe ei ole täydellisen solugridin tai sivujatkograafin mittaus.

## Kehityskorjaukset ja jäävät riskit

Kokeen vertical-local-sääntöön lisättiin usean mahdollisen arvon torjunta ja sanastoon rajattu verokortti-/vuosiosion kontekstisuoja. Lopulliset regressiot 32/32. Solujen väärät 7 ehdotusta ja valuuttarivin pilkkominen jätettiin raportoitaviksi; niitä ei peitetty tuottamalla uusi aineisto. Semanttinen konteksti on edelleen heuristinen. Esimerkiksi verokorttikonteksti voi olla ilmaistu muodossa, jota poissulkeva osio-otsikko ei tunne. Pienet negatiiviset testit eivät todista, ettei uusia väärinkäsityksiä voisi syntyä.

## Ympäristö

Chromiumin asennus epäonnistui exit1:een. BROWSER_INSTALL_LOG.txt/BROWSER_STATUS.json ovat todennettava esto. Node-tulos on oikea PDF.js-tulos, ei selaintulos. StandardFontDataUrl-varoitukset ja toHex-shim ovat yhteisiä kaikille vaihtoehdoille; vaihtoehtojen ero ei johdu vaihdetusta readerista.

# Ennakkoon lukittu arviointiprotokolla — YÖAJO 07

Lukitus tehdään ennen toimitetun ZIPin PDF:ien tai annotaatioiden avaamista. D 7d7498983c78825c9fde48d31893ae5a3a416601; E 4bbcb110acecbe4cd162115dc699f9b951fe7093; baseline 8f28544651a27225c1212228753fbc6c6a265c38. Paketti 762f0ac71a1c9134ba9e932bd11480e012e42eb07e1b24540f63b0566d002cbc.

run.mjs saa vain PDF-hakemiston. Se ei tuo scoring-moduulia eikä lue manifestia, annotaatioita tai authoring-sources-tiedostoja. Samat PDF-bitit, PDF.js 6.4.299 ja alkuperäinen readPdfWithPdfJs; sama reader-layout kloonataan D/E:lle. SOURCE_PINS tarkistetaan ennen ja jälkeen. Molempien kaikkien outputien SHA-256 jäädytetään ennen annotaatioiden purkua. evaluate.mjs on erillinen myöhempi prosessi, joka tarkistaa output-tarkisteet.

Mittausfunktiot kopioidaan muuttumattomina YÖAJO 06:n harnessista. Core verified vaatii arvon, arvoalueen ja otsikkoalueen osuman oikealla sivulla (keskipiste ±2/3 pt). Kausi/merkitys tulee annotaation roolista ja sen osoittamasta lähdealueesta; erillistä semanttista ihmistuomiota ei väitetä. Vain payroll-core pisteytetään semantiikkana.

Rakenne: jokaisen lähdetokenin tulee olla oikealla alueella ja koko arvoraw täsmätä whitespacea lukuun ottamatta. D horizontal/vertical-local on implisiittinen certain, E unambiguous eksplisiittinen. Precision-denominaattori sisältää vain GT:hen paikannettavat sidokset; muut unscored. Recall kaikki essential label-bbox -kentät; saman GT-sidoksen varma onnistuminen vain kerran. Epävarma primary ja column pisteytetään erikseen; unscored ei tulkita onnistumiseksi. Moniriviset ehdotukset ilman eksplisiittistä value-linkkiä jäävät ratkaisemattomiksi, eivät oikeiksi sidoksiksi.

Record-mittari on single-row/purity-probe, ei täydellinen graafi. Jokaisen GT-recordin kaikki lähteet samassa rivissä, ilman foreign-recordia. Moniriviset recordit voivat epäonnistua tarkoituksellisen epävarmuuden vuoksi. Sivujatkosgraafi ei ole toteutettu: NOT SUPPORTED. Rinnakkaisuuden ja jatkotaulukoiden lisätulkinta dokumentoidaan yksityisesti, ei keksitä onnistumisia.

Kattavuus: essential GT:n raakapaikannus, viite verified-kentässä/payline:ssa, paikallinen UNACCOUNTED_MATERIAL-varoitus, generic core MISSING_FIELD, tai kokonaan ilman näitä. Viite-kattavuus ei ole ei-core-kentän semanttisen oikeellisuuden todiste. Sisäinen coverage säilytetään erikseen yksityisessä raportissa.

Turvallisuus: väärä verified-core; missing→0; foreign-domain candidate-ready; candidate-ready kun GT vaatii tarkistuksen tai core on väärä/puuttuva; havaintojen tai row-tokenien menetys. Turha review: payroll, GT review_reasons tyhjä mutta review-required. canPersist=false ei turvallisuustodiste.

Päätös: NO-GO jos E vaarallinen candidate-ready tai olennaisen datan menetys. MIXED/REVISE jos E lisää verified/certain-virheitä, record-purity heikkenee tai oikeita certain/core-onnistumisia menetetään ≥20 % D:stä (tai vähintään yksi jos D:n n<5). GO vain ilman näitä ja konkreettisella HOLDOUT-hyödyllä. Tasatulos ilman hyötynäyttöä MIXED/REVISE. Nämä portit koskevat jatkotutkimusta, eivät tuotantoa.

Node-aika ja koko prosessin muistinäyte yhden ajon yhteydessä: ei benchmark-rankkausta, huippumuistia tai Android-väitettä. Selain erillinen; puuttuessa NOT RUN. Ei kandidaattimuutoksia eikä tulosperusteista harness-muutosta. Mahdollinen arviointivirhe kirjataan alkuperäisen ja korjatun version rinnalle.

Aineisto on aiemman Work-agenttityön synteettinen tuotos; samalla työtilalla on luontityön jäänteitä. Niitä tai vanhoja HOLDOUT-vastauksia ei avata. Nykyinen arvioija on ChatGPT/Codex; erillistä kolmannen osapuolen tekijyyttä tai täysin riippumatonta QA:ta ei väitetä. Aiemman sisällöllisen kehitysaltistuksen puuttumista ei voida todistaa.

# Päätösraportti — mitattu 2×2-koe

**Sanasto yksin paransi ydinkenttiä enemmän kuin rakenne yksin. Suurin hyöty tuli niiden yhdistelmästä.** Tulos on DEV:hen sovitetusta kokeesta; ei yleistymisnäyttöä.

|Vaihtoehto|Oikea arvo + arvo-/otsikkoviite|Lisäys A:han|Läsnä mutta missing|Väärä verified-ydinkenttä|
|---|---:|---:|---:|---:|
|A baseline|1/11 (9,1 %)|—|10/11|0/1 verified|
|B rakenne|2/11 (18,2 %)|+1 kenttä, +9,1 prosenttiyksikköä|9/11|0/2 verified|
|C sanasto|5/11 (45,5 %)|+4 kenttää, +36,4 prosenttiyksikköä|6/11|0/5 verified|
|D yhdistelmä|10/11 (90,9 %)|+9 kenttää, +81,8 prosenttiyksikköä|1/11|0/10 verified|

D lisää B:hen 8 ja C:hen 5 oikeaa kenttää. Additiivinen ennuste A+(B−A)+(C−A) olisi 6/11; D saavuttaa 10/11, joten tämän aineiston count-interaktio D−B−C+A on **+4 kenttää**. Ei tilastollista merkitsevyyttä tai markkinatason tarkkuusväitettä.

|Dokumentti|Raakateksti lähdealueella|A core|B core|C core|D core|
|---|---:|---:|---:|---:|---:|
|P01|26/26|1/4|2/4|2/4|4/4|
|P02|13/13|0/4|0/4|1/4|4/4|
|P03|14/14|0/3|0/3|2/3|2/3|
|T01|13/13|ei sovellu|ei sovellu|ei sovellu|ei sovellu|
|T02|14/14|ei sovellu|ei sovellu|ei sovellu|ei sovellu|
|T03|7/7|ei sovellu|ei sovellu|ei sovellu|ei sovellu|

## Miksi vaihtoehdot erosivat?

- P01: B erottaa maksupäivän viereisestä Jaksosta. C löytää YTD:n. D löytää myös bruton, jonka label on alkuperäisessä rivissä toisen palstan Vero-summan jälkeen. Siten 1 → 2 / 2 → 4.
- P02: C löytää ISO-maksupäivän englanninkielisen otsikon avulla. B yhdistää erilliset korttien label-/arvorivit ja jaetun numeron, mutta alkuperäinen sanasto ei tunne käsitteitä. D löytää kaikki neljä: 0 → 0 / 1 → 4.
- P03: C ja D löytävät bruton ja vuosiveronalaiset. Maksu kirjataan ei hyväksytä maksupäiväksi. Nettopalkka on aidosti puuttuva ja pysyy missing/null kaikissa: 1/1 varianttia kohti. Siten 0 → 0 / 2 → 2.

Baseline A:n core-ehdokkaat, verified-kentät ja päätökset täsmäävät aiempaan mittaukseen **6/6**. Lukua ei verrattu mainiin tai myöhempiin LAB-versioihin.

## Rakenne ei ole valmis

B:n ja D:n eksplisiittisistä GT:hen arvioitavista otsikko–arvo-soluehdotuksista **26/33 (78,8 %)** on oikein ja **7/33 (21,2 %)** väärin. Tämä on ehdotusten precision, ei kaikkien 87 GT-sidoksen recall; rakenteen mittari ei korvaa semanttista ydinkenttämittaria. A/C:llä ei ole solugraafia: mittari NOT IMPLEMENTED.

|Dokumentti|B/D oikeat soluehdotukset|Virheelliset|
|---|---:|---:|
|P01|8/8|0/8|
|P02|7/9|2/9|
|P03|4/6|2/6|
|T01|1/3|2/3|
|T02|5/6|1/6|
|T03|1/1|0/1|

Virhe: taulukon koko moninumeroinen rivi tulkitaan yhdeksi label–arvo-soluksi, vaikka GT:n oikeat otsikot ovat taulukon sarakeotsikoissa. Output säilytetään; virheitä ei poisteta mittauksen denominatorista.

T03:n kaksi tietuetta ovat A/C:n yhteisessä rivissä sekoittuneina: puhtaat kokonaiset tietueet **0/2**. B/D erottaa ne: **2/2**. T01 heikkenee vastakkaiseen suuntaan: A/C pitää molemmat tietueet yhdessä rivissä **2/2**, B/D pilkkoo valuutan erilleen ja tulos on **0/2** kokonaisena rivinä. Numerot eivät sekoitu eri tileihin, mutta recordin eheys heikkenee. Kaikkien 16 annotoidun rivitietueen single-row/purity-probe on **11/16** jokaisella vaihtoehdolla; parannus T03:ssa ja heikennys T01:ssä kumoavat toisensa. Tämä ei ole täydellisen tietuegraafin mittari, vaan sijaintiin sidottu riviauditointi.

Moniriviset solut, yhdistetyt taulukkosolut, täydellinen sarakeotsikon propagointi ja sivujatkoksien tietuegraafi jäävät osittain toteuttamatta. P03:n kaikki havainnot molemmilta sivuilta säilyvät, mutta jatkotaulukon oikeaa row-bindingia ei osoitettu.

## Turvallisuus ja kattavuus

- Väärät verified-ydinkentät: A 0/1, B 0/2, C 0/5, D 0/10. Myös oikea lähdealue ja otsikkosidos vaadittiin onnistumiseen; pelkkä sama numero ei riitä.
- P03:n puuttuva netto pysyy missing/null 1/1 jokaisessa. Edellisen tilisiirron arvoa ei arvata netoksi.
- Virheelliset candidate-ready-päätökset 0/6 jokaisessa. Kaikki kuusi pysähtyvät kaikissa vaihtoehdoissa. Vieras dokumenttityyppi estetään 3/3 jokaisessa. canPersist=false pysyy samana, mutta sitä ei lasketa turvallisuustodisteeksi.
- P01/P02:n käyttökelpoinen valmius on edelleen **0/2** varianttia kohti. D:n neljä ydinkenttää eivät riitä, kun muut olennaiset palkkarivit ovat tuntemattomia. Tämä on turvallinen coverage-refusal, ei väärän tiedon hyväksyntä.
- Raw-teksti oikean sivun tunnetulla GT-alueella **87/87** jokaisessa. Whitespace-normalisointi, token-keskipiste ±2 pt x/±3 pt y. Ei koko sivun CER eikä itsenäisen solutunnistuksen tarkkuus. PDF.js:n baselineobservaatioiden säilyminen **201/201**, ei kaikkien whitespace-textItemien säilymisväite.
- GT-havaintoja ilman verified-kentän/rivin viitettä ja ilman paikallista material-varoitusta **sekä** ilman kyseisen core-kentän generic missing-ilmoitusta: **44/87** jokaisessa. Luku sisältää myös adapterin tukemattomia koodeja, kuvauksia ja määriä. Ei hiljaisen hyväksynnän luku. Laajempi unassigned_numeric_observations-lista on vain auditointiraportti; se ei muuta hyväksymisporttia eikä ole täysi relevanttiusluokitin.
- Palkkarivejä tunnistuu 0/9 GT-riviä jokaisessa. Palkkalajikoodistoa ei laajennettu. Palkka-adapterin vieraan domainin turvallinen kieltäytyminen ei ole semantiikkavirhe.
- DEV:n konfliktirecall NOT AVAILABLE: ei yksiselitteisiä truth-konfliktitapahtumia. Erillinen ristiriitaprobe säilyttää kaksi nettopalkkaehdokasta ja conflict-tilan kaikissa vaihtoehdoissa.

## Erilliset regressiot

8 muistissa luotua havaintotapausta × 4 vaihtoehtoa: **32/32** tarkistusta täyttyy. Vieraat aliasotsikot, verokortin qualified-label, verokorttiosio, vuosiosion gross-sekaannus, kolmen desimaalin epävarmuus, kilpailevat pystyarvot, saman roolin ristiriita ja edellinen tilisiirto. Ei uusia PDF:iä; ei PDF.js-lukemisen tai todellisen yleistymisen testi. Kaikki todelliset probe-outputit REGRESSION_RESULTS.json:ssa.

## Ajat ja muistinäytteet

|Variantti|Kuuden dokumentin clone/rakenne yhteensä, ms|Adapteri yhteensä, ms|Prosessin RSS-näytteet, MiB|
|---|---:|---:|---:|
|A|0.59|4.10|68.2–83.0|
|B|2.75|2.41|69.9–83.3|
|C|0.57|3.71|70.0–83.5|
|D|1.92|2.10|70.0–83.9|

Yksi Node-ajo, aina järjestys A→B→C→D, sama prosessi. A/C:n rakenneaika on clone-overheadia. PDF-lukuaika mitattiin kerran dokumenttia kohti eikä sisälly taulukkoon. Kaikki raakakohtaiset ajat ja heap/rss-arvot JSON:ssa. Muisti kasautuu myös mittausharnessin tuloksista; luvut eivät ole variantin lisämuisti, peak-RAM tai Android-benchmark. Vähäisestä ms-erosta ei voi päätellä nopeinta tuotantoratkaisua. Akku, mobiili-UI, käyttäjän korjausaika ja muistihuippu NOT MEASURED.

Chromium 143.0.7499.4 / build1200:n lataus estyi: truncated ZIP ja HTTP400 GatewayExceptionResponse. Selaintesti NOT RUN. Node käytti samaa toHex-ympäristöapua kuin YÖAJO 04; PDF.js:n standard-build-/fonttivaroitukset säilyvät lokissa. Ei LLM-parseria, OCR:ää eikä maksullisia API-kuluja.

## Johtopäätös

Pelkkä rakenne ei riitä eikä laaja sanasto yksin ratkaise pystysuuntaisia label–arvo-pareja. D on paras **ydinkenttien tutkimuskandidaatti**, mutta ei yleiskäyttöisen rakennekerroksen voittaja: seitsemän väärää soluehdotusta ja T01:n record-regressio ovat todellisia vastanäyttöjä. Seuraavan kokeen pitää korjata paritusehdotuksen tarkkuutta ja record-eheyttä ennen riippumatonta HOLDOUT-ajoa. Tuotantointegraatiosta ei tehty päätöstä.

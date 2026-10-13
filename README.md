# Äppejä Import Engine Lab — v0.2 (eristetty koe)

**Tila 13.10.2026:** paikallinen synteettinen prototyyppi. **EI tuote, EI tuotantointegraatio, EI riippumaton QA-hyväksyntä.** Ei oikeaa käyttäjädataa.

Tämä on oma tutkimusrepo. Palkka PWA:n, Osakevahdin ja Visual Academyn päähaarat, QA-kandidaatit sekä käyttäjätiedot pysyvät koskemattomina.

## Mitä prototyypissä on

- `src/layout.mjs`: PDF.js:n tekstielementtien sijaintitiedon säilyttävä rajattu käsittely. Tukematon geometria jää havaintona ja estävänä ongelmana näkyviin.
- `src/payroll.mjs`: synteettisten palkkakertymätaulukoiden geometriakoe. 42 000 / 43 000 -ristiriita estää automaattihyväksynnän; identtiset toistot eivät ole ristiriita.
- `src/csv.mjs`: CSV/TSV, lainausmerkit ja rivinvaihdot lainausmerkkien sisällä; lähdesolujen jäljitys.
- `src/holdings.mjs`: CSV-omistusehdokkaat; puuttuva hankintahinta eroaa nollasta, välittäjä on eri asia kuin tilityyppi, erilaiset MIC-listaukset pysyvät erillisinä.
- `src/numbers.mjs`, `src/evidence.mjs`: numeroiden tiukka jäsennys ja lähteisiin sidottu ristiriitatarkistus.
- `demo/`: mobiiliystävällinen selainkoe **vain synteettisillä tiedoilla**.
- `tests/`: riippuvuudettomat Node-testit; testauksen rajat kuvataan tiedostossa `QA_STATUS.md`.

## Testaaminen

```bash
npm test
```

Demon paikallinen käyttö (tarvitsee HTTP-palvelimen ES-moduuleille):

```bash
python3 -m http.server 8080
```

Avaa `http://localhost:8080/demo/`. Julkiseen GitHub Pagesiin demoa ei ole tässä työvaiheessa julkaistu. Älä syötä oikeaa PDF-, palkka- tai salkkutietoa.

## Mitä EI vielä ole

- PDF.js-kirjastoa ei ole liitetty demoon. `readPdfWithPdfJs()` käyttää injektoitua PDF.js-oliota; testit käyttävät mockia, eivät oikeaa PDF-tiedostoa. Kierretty tai rajattu PDF-sivu estetään.
- Skannattujen PDF:ien renderöinti, todellinen OCR ja XLSX eivät sisälly vaiheeseen.
- Yleiskäyttöinen taulukon ja sarakkeiden segmentointi ei ole todistettu: Palkka-adapteri tunnistaa rajattuja synteettisiä otsikoita.
- Oikean puhelimen suorituskykymittaus, selaimen E2E, nykyisten parsereiden rinnakkaisvertailu ja riippumaton QA puuttuvat.
- Ei tallennusta, API-kutsuja tai maksullista AI:tä. `canAutoAccept` tarkoittaa vain koneellisen ehdokkaan eheyttä, **ei käyttäjän hyväksyntää eikä automaattista tallennusta**.

## Seuraavat portit

1. Tarkista koordinaattimuunnokset, CSV:n rajatapaukset ja havaintojen kattavuus kriittisesti.
2. Lisää aito PDF.js ja **oikeat mutta täysin synteettiset PDF-tiedostot** selain- ja Node-testeihin.
3. Tee nykyparserien kanssa rinnakkaisvertailu 25 perusasettelulla sekä virhemuunnelmilla.
4. Mittaa Android-laitteella lataus, nopeus, muisti ja offline-käyttö. Integraatiosta päätetään erikseen.

## Tietosuoja ja turvallisuus

Demo ei tallenna tietoa IndexedDB:hen tai localStoragean eikä sisällä `fetch`-kutsuja. Kaikki syötteet käsitellään väliaikaisesti sivun muistissa. GitHub-repo sisältää vain tutkimuskoodia ja tarkoituksella keksittyjä testiarvoja. Käyttäjien todellisia dokumentteja ei viedä tähän repoon.

Lähdekoodi on kehityskandidaatti. GitHub Actionsin mahdollinen vihreä Node-tulos ei ole riippumaton QA-GO.

## v0.2: oikean PDF.js-lukupolun eristetty tutkimus

- Täysin synteettiset **oikeat PDF-tavut** luodaan paikallisesti `demo/native-pdf.mjs`-moduulissa. Käyttäjän dokumentteja ei avata.
- `pdfjs-dist` versio **6.4.299**, sama pinnaus kuin Palkan kehityskandidaatissa. `npm run prepare:pdfjs` kopioi PDF.js:n ja workerin paikalliseksi resurssiksi `demo/vendor/pdfjs/`.
- Chromium-testi käy läpi polun: oikea PDF -> PDF.js worker -> alkuperäiset tekstielementit ja koordinaatit -> sovelluskohtainen kertymätulkinta -> ristiriidan esto.
- `npm test` ajaa 34 Node-testiä; `npm run test:e2e` ajaa erilliset Chromium-testit. `npm ci` asentaa testiriippuvuudet.
- `demo/index.html` sisältää painikkeen **Oikea PDF.js · kaksisivuinen testi**. Demoon ei lisätty käyttäjän tiedoston latausta, koska tutkimus käsittelee toistaiseksi vain testiaineistoa.

Rajoitus: tämä ei tunnista mielivaltaisia palkkalaskelmia. Kierretyt/rajatut PDF-sivut, skannatut PDF:t, OCR ja puhelimen todellinen suorituskyky puuttuvat edelleen. API-laskutusta, käyttäjätietojen tallennusta tai sovellusintegraatiota ei ole.

## v0.3 adversarial layout research (Draft)

- Thirty deterministic, entirely synthetic page-layout scenarios are generated at test time; there are no real paycheck samples or user files.
- New safety rules: nearby known headers can be reconstructed from text fragments; amount positions are matched only when the nearest column is within a narrow, unambiguous range; suspicious unanchored amounts inside a detected table block review.
- A **test-only** copy of Palkka's old PDF row folding (pdf-reader.js, frozen snapshot 550c7654…) is run on the **same synthetic PDF**, solely to measure preservation of word-level geometry vs folded-line geometry. It is **not** a head-to-head accuracy test of full Palkka parsing logic.
- The 30-case matrix and a legacy granularity comparison run through real PDF.js in Chromium on GitHub Actions.
- Commands remain npm test and npm run test:e2e. Node smoke on the isolated local sources: **36/36 PASS** before GitHub transfer; exact PR HEAD CI result recorded separately.
- Cross-layout generalization, scanned images/OCR, physical Android and independent QA remain **NOT RUN**; production integration **NO-GO**.

## v0.4: 75 synteettistä PDF:tä ja jäädytetty koko Palkka-parseri

Koe käyttää **25 hallittua asettelukonfiguraatiota**, joista jokaisesta tehdään (1) ehjä tapaus, (2) erillisen sivun ristiriitainen YTD sekä (3) erillisen sivun puuttuva YTD. **25 ei tarkoita 25 eri työnantajaa tai autenttista palkkalaskelmapohjaa.** Yhteensä 75 PDF:tä käsitellään todellisella, versiopinnatulla PDF.js:llä Chromiumissa.

Vertailu ei käytä pelkkää vanhaa rivifunktiota: jäädytetty **koko** `parsePayslip({text,lines})` ja sen `semantic-evidence.js` kopioidaan testiriippuvuudeksi lähdecommitista `naatti21/Palkan-laskenta@550c765413c0916259c67b44ba8dfdb9b3f06da6`, joka on Palkka Draft PR #13:n kehityskandidaatti, ei julkaisun tuotantokoodi. PDF:n riviteksti muodostetaan saman commitin `pageItemsToLines`-funktion mukaan. **Molemmat parserit saavat täsmälleen saman generoivan PDF-dokumentin lähtötiedoksi.**

Mittaamme vain kolmea yhteistä rahakenttää: `grossPay`, `ytdTaxableIncome` ja `previousYearTaxableIncome`. Vanha parseri kyllä ajetaan kokonaisena, ja sen `documentType`, kentät sekä `validate()`-tarkistusvaroitukset luetaan, mutta uuden laboratorion adapteri ei vielä tue kaikkia Palkan ominaisuuksia (nettopalkka, maksupäivä, maksuerittely, käyttäjän hyväksyntä). Tätä ei saa kutsua täydelliseksi Palkka-sovelluksen pariteettitestiksi.

Tulokset syntyvät GitHub Actionsin Chromium-jobin lokiin `FULL_FROZEN_PARSER_VS_LAB_75`. Kunnes **tarkka SHA:n ajokerta** on tarkastettu, v0.4 on NOT VERIFIED. Positiivinen testi vaatii täsmälliset kolme arvoa; negatiivinen testi vaatii eston ja sille oikean syyn. Vanhan parserin blokkausten erot esitetään kuvailevana analyysinä, ei oikeuksien tai tuotantotallennuksen väitteenä.

**Turvaraja:** synteettiset tiedot, ei oikeita palkkalaskelmia, ei käyttäjätietojen latausta, ei pilvipalvelua eikä maksullista AI:ta. Ei integroitu muihin repoihin. Riippumaton QA ja puhelintesti NOT RUN, tuotanto NO-GO.

## LAB v0.5: yhteinen hyväksymissopimus + kokonaiset synteettiset palkkalaskelmat

Lue **[ACCEPTANCE_CONTRACT.md](./ACCEPTANCE_CONTRACT.md)** ennen uusia integraatioita. Sopimus on toteutettu puhtaana paikallisena funktiona `src/acceptance.mjs` ja sen vastatestit tiedostossa `tests/acceptance-contract.test.mjs`. Erottelu on ehdoton: `candidate-ready` on vain ehdotus, `canPersist=false` aina. Palkka ja Osakevahti käyttävät omia pakollisia kenttiään saman lähdehavaintoihin perustuvan turvallisuuskehikon sisällä.

Lisättiin kolme todellista, mutta keksityllä testidatalla täytettyä PDF-tiedostoa **ajon aikana luovaa fixtureä**. Niiden tekstipohjat ovat jäädytetyt nykyisestä Palkan julkisesta hyväksymistestistöstä commitista `550c7654…` (`tests/fixtures/complete-payslips/`). `demo/complete-pdf.mjs` tekee aidot yksisivuiset WinAnsi-PDF-tavut ilman käyttäjätietoja. Chromium lukee ne oikealla PDF.js:llä ja ajaa saman tekstin jäädytetyn `parsePayslip()`-parserin läpi.

Tämän kokeen **positiivinen** tavoite on, että Palkan neljä pakollista kenttää säilyvät oikeina myös PDF-lukuvaiheen jälkeen (ei vain raakana tekstinä). Samassa ajossa tutkitaan, riittävätkö LABin nykyiset 3 kertymäkenttää yleisen sopimuksen täyttämiseen: eivät, koska LAB ei vielä poimi maksupäivää eikä nettoa. Sopimus vaatii tarkistuksen eikä koskaan tallenna. **Älä vertaa näitä kuin kaksi täyttä palkkaparseria.** Testiajon tulokset lukitaan SHA:han ja raportoidaan erikseen.

## LAB v0.6 — osioihin jaettu palkkalaskelma

`src/payroll-sections.mjs` on uusi **rinnakkainen tutkimusadapteri**, joka käyttää vain PDF.js:n alkuperäisiä havaintoja (`id`, `page`, `box`). Sillä ei ole kutsua jäädytettyyn Palkka-parseriin eikä tallennustoimintoa. V0.5:n `src/payroll.mjs`-taulukkoadapteri pysyy ennallaan.

A/B/C-kokonaislaskelmissa poimitaan maksupäivä, kauden brutto, nettopalkka ja vuoden veronalainen kertymä myös osioitujen tekstirivien ja vaihtoehtoisten otsikoiden avulla. Kausi- ja vuosipidätykset erotetaan vain niiden otsikoiden alla; signed deduction säilyy lähderivissä ja esitetään positiivisena pidätyksen suuruutena. Jokaisella ehdotuksella on `sourceIds` ja kaikki saman kentän toistuvat ehdokkaat säilyvät. Eri arvot antavat `conflict`, puuttuva antaa `missing`.

Vertailussa tarkastellaan vain omista PDF.js-havainnoista poimittuja kenttiä. Vanhasta jäädytetystä parserista ei siirretä arvoja LABiin. `src/acceptance.mjs` pysyy riippumattomana ja `canPersist=false`. Tunnistamattomat olennaiset palkkaerittelyn rivit jätetään näkyviin ja ne estävät koneellisen valmistumisen, mikä on tässä vaiheessa tarkoituksellista.

Testaus: `tests/payroll-sections.test.mjs` sekä `tests/e2e/payroll-sections.spec.mjs` (oikeat PDF.js-lukukierrokset A/B/C sekä rikkovat muunnelmat). OCR, muiden työnantajien laskelmapohjat, Android, suorituskyky ja riippumaton QA **NOT RUN**. Integraatio **NO-GO**.

## LAB v0.7 — oikeat askeleet: palkkarivien lähdejälki ja vertailumittari

Erillinen `src/payroll-lines.mjs` tunnistaa **rajatun sallitun palkkakoodijoukon** (13001, 13101, 20040, 20050, 20060, 20070, 20110, 20120, 20511, 20512, 30020, 90000). Jokainen oikein tunnistettu rivi palauttaa `code`, alkuperäisen selitteen, määrän, yksikköhinnan, rahasumman, laskentakertoimen (jos soveltuu) ja alkuperäiset PDF.js-`sourceIds`-viitteet. Koodin ja tekstin ristiriita, väärä sarakemäärä, tuntematon koodi, toistuva koodi, aritmeettinen poikkeama sekä ennakonpidätysrivin ja kausiyhteenvedon erotus aiheuttavat **estäviä** syitä. Ne eivät saa `accountedEvidenceIds`-merkintää.

Ennakonpidätyksen koodirivillä oleva **verokortin kertymä ei ole vuoden veronalainen palkkakertymä**. Vähennyssumma säilyy etumerkillisenä; kuukausittaisen pidätyksen tunniste on erillinen. LAB ei päättele puuttuvaa kausipidätystä yksittäisestä koodirivistä.

`src/payroll-sections.mjs` liittää rivikirjanpidon olemassa olevaan kenttäevidenssiin. Uusi `coverage` raportoi `materialObservations`, `coveredObservations`, `unresolvedObservations`, `unresolvedIds`, `paylineRowsRecognized` ja `paylineRowsUnrecognized`. Kattavuus ei tarkoita sitä, että koko palkkalaskelma hyväksytään: KTA/PP, prosentit, verokortti ja muut rahahavainnot voivat jäädä erillistä selvitystä vaativiksi. **V0.5:n hyväksymissopimus ja `canPersist=false` säilyvät koskemattomina.**

Testit käyttävät samoja kolmea kokonaista **synteettistä PDF:ää**. `tests/e2e/payroll-lines.spec.mjs` vertailee alkuperäisten PDF-tavujen perusteella uuden adapterin palkkarivien lukumäärän, koodit, määrät, yksikköhinnat ja summat jäädytetyn nykyisen Palkka-parserin tuloksiin. Negatiiviset testit muuttavat yhden rahasumman, lisäävät tuntemattoman koodin ja aiheuttavat pidätyksen ristiriidan. Ne todentavat käsittelemättä jääneet havainnot ja estoilmoitukset.

**Päätösraja:** tämä on näyttö tunnettujen rivien käsittelykyvystä, ei täysi laskelmien automaattinen hyväksyntä eikä kattavuus vieraista työnantajapohjista. Muiden palkkalajien käsittelyä ei arvata. Riippumaton QA, Android, OCR, todelliset palkkatiedot ja tuotantointegraatio **NOT RUN / NO-GO**.


## LAB v0.8: PDF, CSV/TSV, XLSX ja OCR-havainnot

Lue [MULTIFORMAT_PLAN.md](./MULTIFORMAT_PLAN.md). Tämä vaihe lisää erillisen yhteisen havaintokerroksen, ei uutta palkkaparseria. Excelin aitoon ZIP/OOXML-luentaan ja synteettiseen osakeaineistoon liittyvät Node- ja Chromium-testit ovat tiedostoissa `tests/multiformat.test.mjs` ja `tests/e2e/multiformat.spec.mjs`. OCR-TSV on jälkikäsittelyn testi, ei oikean kuvapikselin OCR-koe. Production: NO-GO.


## LAB v0.9 — todellisten kuvien paikallisen QA:n pohjalta turvallisuussäännöt

Neljä todellista kuvakaappausta ja viisi eri rakenteista palkka-PDF:ää tarkastettiin **vain erillisessä paikallisessa ympäristössä**. Niiden sisältöä, henkilö-, tili- tai oikeita taloudellisia tietoja **ei** kopioitu tähän julkiseen repoon eikä GitHub Actionsiin. Todellista OCR:tä kokeiltiin paikallisella Tesseract-moottorilla: OCR:n desimaalipilkku voi kadota; nimiosuma ei todista oikeaa rahalukua.

Uusi `src/portfolio-review.mjs` on **post-extraction REVIEW GATE**, ei vielä valmiiksi toimiva kuvasta-salkku-parseri. Se hyväksyy vain jo luetut ja lähde-ID:llä perustellut kenttäehdokkaat. Kuvitteellisia tietoja käyttävät regressiot kattavat nykyarvon ja ostohinnan eron, saman salkkunäkymän uusinnan, rahaston erillisen detail-näkymän, tilien erilläänpidon, OCR:llä kadonneen desimaalin, korkeamman nykykurssin ja ostohinnan sekoittumisen, taseen laskentatarkistuksen ja väärät lähdeviitteet. `canPersist=false` aina.

**Nämä testit eivät validoi tuotannon Tesseract.js:n OCR-tarkkuutta**, eivätkä yhteisen moottorin automaattista PDF-/kuva-taulukon kohdistusta. Yksityisten tiedostojen paikallinen arvio löytyy vain käyttäjälle toimitetusta erillisestä anonymisoidusta raportista, ei reposta. Draft PR ja tuotantointegraatio edelleen NO-GO.


## LAB v1.0 – paikallinen mobiili-esitarkistus

[Demo ja rajaus](./V1_0_REVIEW_SCOPE.md) · [Selainkäyttöliittymä](./demo/review.html) · testi: `tests/e2e/mobile-review.spec.mjs`. Ei julkaisulupaa eikä tuotantointegraatiota.


## LAB v1.1 — automaattinen QA-agentti

[QA-protokolla](./QA_AGENT_PROTOCOL.md) määrittelee itsenäiset oracle-tarkistukset, siemenillä toistettavat CSV/XLSX/OCR/PDF-vaihtelut ja GitHub Actions -portit. Varsinaisten tuotantosovellusten testaus, merge ja deploy eivät ole automaattisia.

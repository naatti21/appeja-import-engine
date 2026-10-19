# Issue #63 — P1-64-01-korjaus ja fiktiiviset rakenneanalogiat

Kehittäjän raportti 19.10.2026. Ei riippumaton hyväksyntä. Pohja: PR #64, `c6afec38b6b38e4907f07e8107bc5edeb6b08188`. Toimituksen tarkka SHA kirjataan PR-handoffiin ja CI:n `tested-sha.txt`:hen.

## RED → korjaus → GREEN

Workin tehtävä luettiin kokonaan: https://github.com/naatti21/appeja-import-engine/pull/64#issuecomment-6265695603 .

`tests/fixtures/fund-binding.mjs` toistaa täsmälleen Workin 1100×1000-kuvan: Cedar Valley Index, 37,6 kpl, 1962,14 EUR, NAV 52,1846 EUR, vasemmalla tyhjä keskihankintahintakenttä. GAV-label on hyökkäyksessä y=415, kontrollissa y=390. Muuta eroa ei ole. PNG→paikallinen fin+eng/eng→parseri→UI on oikea, ei mockattu.

Ennen lähdekoodin muutosta Node: **1 PASS / 1 FAIL / 0 SKIP**; oikea selain-OCR: **1 PASS / 1 FAIL / 0 SKIP**. Hyökkäyksen assertion odotti GAV `missing`, sai `observed`. Kontrolli läpäisi. Ensimmäinen laskennallinen bbox-fixture ei toistanut virhettä; se korjattiin vastaamaan tekstin todellista korkeusaluetta ennen lähdekoodin korjausta. PNG-oraakkelia tai numeerista odotusta ei muutettu.

Paikallisten PNG-tiedostojen SHA256:t ovat samat kuin Workin riippumattoman aineiston:

- Hyökkäys: `72f6dd225cb5dd3ca50e9ea4f915e87c4663b37e817efe5d80cbef733397fda6`
- Kontrolli: `48af7b226a9245e5dba51fa0e8b8ea695261e4cb29ade01643afee5e29fb3a2e`

Korjaus:

- Sarakeraja sidotaan koko kortin labelien x-sijainteihin, ei vain samankorkuisiin labeleihin. Numero pysyy labelin alapuolella, lähellä sen x-alkua ja oman sarakkeen sisällä.
- Numeeristen lähde-ID:iden omistajuus tarkistetaan koko dokumentissa määrän, nykyarvon, NAV:n ja GAV:n välillä. Monelle roolille kelpaavat kentät muuttuvat `ambiguous`, eivätkä säilytä desimaaliväitettä. Johdettu valuuttahavainto saa tarkoituksellisesti käyttää rahaevidenssiä.
- Sama nimilähde ei saa tukea kahta eri korttia. Päällekkäiset kortit jäävät epäselviksi.
- Täsmällinen Work-hyökkäys ja kontrolli: korjauksen jälkeen **2 Node PASS, 2 oikea OCR/UI PASS**. Molemmissa NAV pysyy 52.1846, GAV puuttuu ja Täydennä/Myöhemmin näkyvät.

## Rakenteiden laajennus ja rajat

Uudet kuvat ovat kokonaan keksittyjä rakenneanalogioita, eivät pankkien kuvia tai tarkkoja ulkoasukopioita. Näkyvä `Rahastot`-otsikko, kaksirivinen labeloimaton nimi ja oikealla inline-arvo/kpl sekä viisi labeloimatonta nimeä, Arvo/Tuotto/päivämäärä/NAV/Keskikurssi-korttia. Määrä sidotaan näkyvään yksikköön; hintaa ei päätellä laskemalla. Päivämäärä ja prosentti eivät kelpaa hintakenttään.

Oikean paikallisen OCR:n peruskuvat: **6/6 oikeaa nimihavaintoa, 22/22 oikeaa näkyvää numerokenttää, 0 väärää, 0 estettyä perusriviä**. Ulkoisesti varmennettuja instrumentteja **0**. Tiiviin kuvan puuttuva GAV kysytään kerran vapaaehtoisena täydennyksenä; korttien näkyvää GAV:ta ei kysytä uudelleen. Todellinen pankkiyhteensopivuus **NOT RUN / ei osoitettu**. Muut kieli-/geometriavariaatiot voivat edelleen jäädä turvallisesti estetyiksi. Kahden saman Tesseract-perheen luku ei todista oikeaa instrumenttia tai lähdetekstin totuutta.

## Täydennyksen elinkaari

Lisäkokeet paljastivat kaksi korjattavaa UI-rajaa: eri rahaston tietokuvan hintaa tarjottiin kopioitavaksi, ja yhden kortin toiminto rakensi muut lomakkeet uudelleen. Eri tai epäselvä nimihavainto estää nyt tietokuvan kopiointipainikkeen, samoin eri valuutta. Täsmäävä nimiteksti on vain ristiriidan tarkistus, ei markkinaidentiteetin varmennus. Käyttäjä tekee edelleen erillisen kohdistuksen ja vahvistuksen.

Kortit päivittyvät erikseen. Toisen kortin käsittely säilyttää aiemman lomakkeen DOM-solmun ja syötteen. Uusi tietokuva tyhjentää edellisestä tietokuvasta kopioidun hinnan; käsin muokattu hinta erotetaan kuvan evidenssistä. Myöhemmin ei säilytä vanhaa vahvistusta. Peruutus/uusi tiedosto estää myöhäisen detail-OCR:n palautumisen. Alkuperäinen puuttuva GAV ei muutu OCR-havainnoksi.

## Paikallinen kehittäjän testinäyttö

Linux, Node 24.19.0, Playwright 1.57.0, Chromium 143.0.7499.0 headless, Tesseract.js 5.1.0 / core 5.1.1. Paikalliset samasta originista ladatut fin+eng/eng-mallit; ei CDN-koetta. Mobiilileveydet 320/360/393: ei vaakavuotoa, näkyvät painikkeet vähintään 44×44. Vierityspituus kirjataan artefaktiin. Kontrolloiduissa elinkaarikokeissa OCR on eksplisiittisesti mockattu; niitä ei lasketa oikean OCR:n näytöksi.

| Sarja | PASS | FAIL | SKIP | Huomio |
|---|---:|---:|---:|---|
| Kohdennettu Node | 57 | 0 | 0 | 26 rahasto + 31 vanhaa turvaporttia |
| Täysi Node | 296 | 26 | 0 | 322 yhteensä; +10 PASS pohjaan |
| Kohdennettu Chromium ennen viimeistä detail-lisäkoetta | 23 | 0 | 0 | Mukana vanhat 14 tapausta |
| Lopullinen detail/lifecycle-osajoukko | 8 | 0 | 0 | Sisältää uuden kuvanvaihtokokeen; ei lisätä 23:een erillisinä testeinä |
| Täysi opt-in Chromium paikallisesti | — | — | — | NOT RUN; täysi tavallinen selain CI:ssä |
| Fyysinen Android / oikeat pankkikuvat | — | — | — | NOT RUN |

Lopullinen kohdennettu CI suorittaa **24 testiä: 19 oikeaa OCR-skenaariota ja 5 kontrolloitua elinkaarikoetta**. CI:n toteutuneet luvut luetaan raakalokeista handoffiin. Täysi Node-FAIL-nimijoukko verrattiin pohjaan: samat 26 nimeä, 0 uutta, 0 poistunutta. Vanhoja odotuksia ei muutettu. #55:n faint/absent säilyvät RED, inherited-red-jobia ei muunnettu vihreäksi.

Testatut rajat säilyvät: `canPersist:false`, `candidates:[]`, `actions:[]`, ei resolveria tai automaattista yhdistämistä. Uusien rakennekuvien UI-kokeissa 0 Storage/IndexedDB-kirjoitusta, tyhjät tallennukset, 0 localhostin ulkopuolista pyyntöä; peruutus ja reload poistavat luonnoksen. Salkkuadapteria tai JSON-vientiä ei ole toteutettu.

## Toisto ja seuraava portti

`node --test tests/fund*.test.mjs tests/issue55-session-boundary.test.mjs tests/issue55-identity-review.test.mjs tests/portfolio-instrument-listings.test.mjs`

Riippuvuuksien ja `node scripts/prepare-local-ocr.mjs --swedish` jälkeen:

`REAL_OCR_QA=1 npx playwright test fund-snapshots.spec.mjs fund-binding.spec.mjs fund-broker-structures.spec.mjs fund-review-lifecycle.spec.mjs issue55-mobile-identity.spec.mjs --workers=2 --reporter=list`

Testifixturet, pikselit, OCR-lähde-ID:t/laatikot, mittarit ja tested-sha tallentuvat 14 vuorokaudeksi dedicated CI-artefaktiin. Riippumattoman arvioijan pitää suunnitella myös oma uusi geometriavastakoe eikä vain toistaa näitä testejä.

**Kehittäjän suositus:** valmis rajattuun riippumattomaan jatkoauditointiin uuden SHA:n CI:n tarkistuksen jälkeen. Ei kehittäjän antamaa riippumatonta GO:ta. NO-GO tuotantoon, julkaistuun LABiin, oikeaan pankkidataan, Alpha-integraatioon, salkkutallennukseen, mergeen ja deployhin. #55 pysyy avoimena. Käyttäjän synteettinen puhelintesti vasta riippumattoman arvion ja erillisen luvan jälkeen.

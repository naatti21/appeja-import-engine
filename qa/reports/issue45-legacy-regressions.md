# Issue #45: 17 vanhan regression riippumaton tekninen auditointi

18.10.2026. Kohde: `631a47dd1dc325bc60f2ece635b71d05b3f410f5`.
Työhaara: `audit/issue45-legacy-regressions`. PR #44:n haaraa tai visual-adapteria
ei muutettu. Tämä raportti on kehittäjäauditointi, ei riippumaton julkaisuhyväksyntä.

**Johtopäätös:** kaikki ilmoitetut 17 epäonnistumista toistuvat ja ovat historiallisia,
eivät PR #44:n tuomia. Niitä ei pidä julistaa kokonaan vanhentuneiksi. Lisäksi
vanhan adapterin korttivertailusta löytyi toistettava P0-virhe, joka korjataan tässä
pienellä estolla. Kokonaisuus on **NO-GO**: testisarja jää punaiseksi eikä tässä
työssä toteuteta uutta tunnistusmoottoria tai julkaisuvalmista integraatiota.

## Historiallinen näyttö

Node 22.23.3: `node --test tests/*.test.mjs`, jokaisen commitin omat testit.
Historialliset lähteet purettiin Git-arkistosta erillisiin paikallisiin hakemistoihin;
käynnissä olevia kehityshaaroja ei palautettu tai muutettu.

| SHA | Kohta historiassa | PASS | FAIL | Testejä |
| --- | --- | ---: | ---: | ---: |
| `1938f3baabea81fb15c1e846a1cef77539587bb2` | Ennen P0-nimievidenssiporttia | 176 | 0 | 176 |
| `6ea28f626515009cdd2728b793600bbd26523968` | P0-portti | 172 | 21 | 193 |
| `8fc898ba0410983d709576c4b5e4d98b3dcc3499` | Korttivertailun lisäys, ennen visual-adapteria | 183 | 17 | 200 |
| `3333b96f7e65fa9ac16be2dccb3474f5f33b93f2` | PR #44:n pohja | 205 | 17 | 222 |
| `631a47dd1dc325bc60f2ece635b71d05b3f410f5` | Issue #45:n kiinnitetty kohde | 209 | 17 | 226 |

Viimeisten kolmen rivin epäonnistuneiden testien nimet ovat täsmälleen sama joukko.
`src/mobile-card-holdings.mjs`, `src/structure-learning.mjs`,
`src/mobile-review-session.mjs` ja kaksi alla auditoitua testitiedostoa ovat
muuttumattomat välillä `8fc898b..631a47d`, myös PR #44:n seitsemän commitin yli.
Kaikki nämä 17 testiä läpäisivät viimeksi toistetussa vanhassa versiossa
`1938f3baabea81fb15c1e846a1cef77539587bb2` (**P** alla). Tämä ei tee sen vanhasta
parserista turvallista: myöhemmät P0-vastatestit osoittivat siinä väärät nimisidokset.
Koneellinen historiallinen tulos: [issue45-history.json](issue45-history.json).

## Jokaisen testin alkuperäinen tarkoitus ja luokitus

**A:** edelleen välttämätön turvallisuusportti. **B:** vanhan adapterin rajattu
sopimus. **C:** todistetusti kumottu vaatimus. **D:** muu.
Luokitus on päävaatimuksen mukaan: 15 A, 2 B, ei C- tai D-luokituksia.
B-testeissäkin on säilytettäviä A-osaväitteitä. Mitään testiä ei poistettu.

Tiedostot: **M** = `tests/mobile-card-holdings.test.mjs`,
**R** = `tests/mobile-review-session.test.mjs`. Kaikki taulukon tulokset ovat
kiinnitetyltä kohdecommitilta; jokainen jää FAIL-tilaan myös korjatussa haarassa.
**N** tarkoittaa todettua yhteistä välitöntä syytä: otsikoimaton nimi ei täytä
P0-nimievidenssiporttia, joten rivit ovat tyhjiä ja testin positiivinen oletus
pysäyttää usein suorituksen ennen varsinaista turvallisuusväitettä.
Uudet A01–A10-kontrollit ovat `tests/issue45-legacy-audit.test.mjs`: ne antavat
synteettiselle nimelle selkeän lähdeotsikon muuttamatta vanhoja testejä.

| Tiedosto + testin nimi | Tulos; aiempi PASS | Luokka ja alkuperäinen tarkoitus | Juurisyy / turvallisuusvaikutus | Soveltaminen visual-adapteriin | Korjausvaihtoehto / kontrolli |
| --- | --- | --- | --- | --- | --- |
| M: `clear labelled cards work without learning; price never becomes cost` | FAIL 0 vs 3; P | B: yksittäinen otsikoimaton nimi riittää; A: kurssi ei ole hankintahinta | N; testin nimestä huolimatta vain muut kentät on otsikoitu. Hankintahintaväite ei toteudu loppuun. | Ei sama nimiparseri; hankintahinnan keksimiskielto koskee molempia. | Älä palauta sokkoa nimeä. A01 varmistaa hinnan eron; ehdota vain vanhan nimioletuksen myöhempää korvaamista hyväksynnällä. |
| M: `missing listing, malformed ISIN and duplicate quantity cannot be learned away` | FAIL 0 vs 2; P | A: tunniste-/määrävirhettä ei saa oppia pois | N estää myös kaksi tervettä kontrolliriviä. | Tunnistetta ei saa keksiä. Visual-B voi puuttua ticker/ISIN kokonaan; se ei ole C eikä tallennuskelpoinen. | A02: virheellinen kortti estyy, terveet lähdeotsikoidut säilyvät. Älä vaadi tickeriä visual-B:ltä vihreän testin vuoksi. |
| M: `changed layout stays unresolved; conflicting explicit corrections block` | FAIL 0 opittua vs 2; P | B: muuttumattomien korttien indeksisidos; A: opetusten ristiriita estää | Yhden kortin roolimuutos jättää vain kaksi vertailukelpoista korttia; nykyinen kolmen kortin ehto ei täyty. Myöhempää konfliktiväitettä ei saavuteta. | Uusi visual-adapteri ei käytä tätä oppijaa. Ristiriidan esto säilytettävä missä oppijaa käytetään. | Ei poisteta kolmen kortin rajaa. P0-oppimistestit tarkastavat konfliktin ja palautumisen erikseen. B-osan poistoehdotus, ei poistoa. |
| M: `duplicates do not merge or add; source accounts remain separate` | FAIL 0 vs 1; P | A: ei hiljaista yhdistämistä, tilierottelu | N peittää duplikaattien varsinaisen tarkistuksen. | Periaate välttämätön. Visual-poiminta ei vielä ratkaise salkkuun yhdistämistä tai tilisynkronointia. | A03 varmistaa vanhan adapterin duplikaatit, tilit ja listaukset; uuden integraation tilisopimus avoin. |
| M: `unknown international names and source ISINs remain generic; no currency is guessed` | FAIL tyhjä nimilista; P | A: ei yritysnimilistaa eikä valuutta-arvauksia | N, ei Unicode-virhe; testi käsittelee käytännössä nimiä ja puuttuvaa valuuttaa, vaikka otsikko mainitsee ISINin. | Kyllä: Unicode ja lähteestä saatava valuutta; ISIN-varmennus erillinen. | A04 säilyttää kansainväliset nimet ja null-valuutan. Ei kovakoodattuja yhtiöitä. |
| M: `Swedish quantities and separate listing identifiers do not merge instruments` | FAIL 0 vs 3; P | A: kieli ei sekoita määrää, MIC erottaa listaukset | N ennen varsinaista MIC-vertailua. | Määrä kyllä; symboli+markkinapaikka kuuluu erilliseen listing-vaiheeseen, ei visual-poimintaan. | A03/A09 varmistavat listaukset ja Antal-roolin. Säilytä erillisen resolverin täsmällinen listing-valinta. |
| M: `source IDs, confidence, pages and column geometry cannot silently disappear` | FAIL split-kontrolli 0 vs 2; P | A: jäljitettävyys, OCR- ja geometriaestot | Ensimmäiset negatiiviset väitteet läpäisevät; N estää terveetkin kortit viimeisessä vaiheessa. | Kyllä, mutta adapterien confidence-rajat ovat eri (85/75); tässä ei muuteta kumpaakaan. | A05 testaa jokaisen portin erikseen; visual-testit kattavat lähde-ID:t ja geometrian. |
| M: `source account cannot leak from one page to the next` | FAIL 0 vs 6; P | A: tilitieto ei saa vuotaa sivulta toiselle | N pysäyttää ennen sivurajan tiliväitettä. | Kyllä integraatiossa. Visual-B ei vielä sisällä valmista tilien yhdistämissopimusta. | A06 varmistaa null-tilin uudella sivulla; ei arvata tiliä visual-tulokseen. |
| M: `actual ISIN checksum is checked without a company table` | FAIL ei yhtään hyväksyttyä tarkistetta; P | A: tarkiste, ei yhtiölistaa | N estää ehdokkaan myös ainoalla kelvollisella tarkisteella. Ei näyttöä Luhn-virheestä. | ISINin sisältävään vaiheeseen kyllä; checksum ei koskaan yksin todista C:tä. | A07: täsmälleen yksi kymmenestä tarkisteesta kelpaa, instrumentti yhä varmentamatta. |
| M: `disagreement between OCR readings blocks identities rather than fixing characters` | FAIL 0 vs 2; P | A: ristiriitaa ei saa muuttaa merkkikorvausarvaukseksi | N peittää kaksi tervettä kontrollia. | Kyllä; visual-adapteri vertailee nimiä, ei keksi tickeriä. | A08 ja muuttumattomat visual-ristilukemisen testit; ei Q/O-poikkeuksia. |
| M: `unknown intervening section invalidates account inheritance` | FAIL ei yhtään riviä; P | A: tuntematon osio katkaisee tiliperinnän | N pysäyttää ennen null-tilitarkistusta. | Periaate kyllä, nykyinen visual-tilisopimus puuttuu. | A06 toistaa katkaisun selkeillä nimilähteillä. |
| R: `closed label accent folding does not rewrite names, tickers, or quantities` | FAIL 0 vs 3; P | A: kenttäotsikon normalisointi ei saa muuttaa nimiä/tunnisteita | N, ei havaittua aksenttinormalisoinnin rikkoutumista. | Kyllä periaatteena; visual-parserin sanasto on erillinen eikä sitä muuteta. | A09 säilyttää Äänekosken Öljy -tekstin ja oikean määrän. |
| R: `confirmed identity edit preserves original OCR, source IDs and review status; undo reinstates block` | FAIL alkutila 0 vs 2; P | A: tilapäisyys, alkuperäinen havainto, lähdeviitteet ja undo | N estää testin jo ennen korjausta. | Kyllä tarkistuspolun sopimuksena; ei lupaa uutta roolienopetus-UI:ta. | A08 testaa korjauksen ja peruutuksen alkuperäisiä havaintoja muuttamatta. |
| R: `corrections on different cards do not rewrite another account or become market verification` | FAIL `rows[1]` puuttuu; P | A: korjaus rajautuu korttiin, ei C-promootiota | N; TypeError syntyy testin puuttuvan rivin käytöstä, ei parserin poikkeuksesta. Testi ei itse vaihda tiliä, vaikka otsikko mainitsee sen. | Kyllä; käyttäjän instrumenttivahvistus ja ulkoinen varmennus erotettava. | A08 tarkastaa toisen kortin ennallaan ja C:n puuttumisen; A03 erilliset tilit. |
| R: `Q/O, I/1, l/1, S/5 and B/8 disagreements require exact local corrections, never substitution rules` | FAIL 0 vs 2; P | A: ei pysyviä merkkikorvaussääntöjä | N ennen korjauspolkua. | Kyllä myös nimien OCR:ään; summat eivät korvaa identiteettinäyttöä. | A08 toistaa kaikki viisi merkkiparia ja korjauksen peruutuksen. |
| R: `ASCII field-label variants never relax unknown numeric material or source identity checks` | FAIL `rows[0]` puuttuu; P | A: sallittu otsikkovariaatio ei löysennä muita portteja | N, TypeError testissä. | Kyllä periaatteena, sanastoa tai rajaa ei siirretä automaattisesti uuteen adapteriin. | A09: FI/SV/EN määräotsikot sekä epäselvä numero ja tuntematon määrärooli. |
| R: `untrusted source metadata cannot claim a human confirmation` | FAIL 0 vs 2; P | A: syöte ei saa väittää itseään käyttäjän vahvistamaksi | N peittää kahden muun rivin kontrollin; epäluotettua riviä ei hyväksytä. | Kyllä kaikissa syöterajapinnoissa. | A10: väärennetty metatieto ei poista epävarman tickerin estoa. |

## Uusi toistettu P0-virhe, joka ei kuulu alkuperäiseen 17:ään

`corroborateNamesAcrossCards` päätteli vaihtelevan tekstirivin nimeksi, kun toinen
tekstirivi toistui kolmessa eri tunnisteen kortissa. Sama liikkeeseenlaskijan nimi
voi kuitenkin esiintyä eri osakelajeilla tai listauksilla, samalla kun osioiden
väliotsikot vaihtelevat. Kahden väärän opetuksen jälkeen profiili ja tämä
heuristiikka vahvistivat toisensa. Näin väliotsikot muuttuivat automaattisiksi
B-omistusehdotuksiksi. C:tä tai tallennusoikeutta ei syntynyt, mutta nimi oli väärä.

Node-vastatesti tuotti lähtötilassa FAIL; kymmenen muuta selkeän nimievidenssin
kontrollia PASS. Todellinen synteettinen PNG → Tesseract → TSV → adapteri toisti
kiinnitetyllä lähtöcommitilla nimet `Growth sleeve`, `Income sleeve`,
`Reserve sleeve` (3 väärää ehdotusta). Korjauksen jälkeen 0 väärää, 3 epävarmana
estettyä. Testi ei käytä henkilötietoja tai yrityskohtaista tuotantokoodin sääntöä.
Myös tämä virhe on ennen PR #44:ää: helper tuli commitiin `9a80cfa` ja sen koodi
on sama `8fc898b..631a47d`-välillä.

**Rajattu korjaus:** korttien vertailua saa käyttää ristiriidan estämiseen mutta
ei myönteisen nimievidenssin antamiseen. Selkeä lähdeotsikko tai nykyisen
dokumentin nimen vahvistus toimii edelleen vanhassa adapterissa. Aiemmat
P0-vastatestit, konfliktien reason-koodit, OCR-portit, profiilien tallennusmuoto ja
lähdeviitteet säilyvät. `src/portfolio-visual-evidence.mjs`, sen testit, UI ja
PR #44:n workflowt ovat muuttumattomat.

Tätä ei pidä tulkita uuden käytettävyysvaatimuksen toteutukseksi vanhaan adapteriin.
Uusi visual-polku saa poimia nimen, määrän ja arvon ilman tickeriä/ISINiä ja vaatia
käyttäjältä instrumentin vahvistuksen. Se ei saa keksiä puuttuvaa tunnistetta eikä
pitää summatäsmäystä markkinavarmennuksena. Tässä työssä ei lisätä käyttäjälle
otsikkojen, OCR-roolien tai pankin kenttäkarttojen opettamista.

## Tulokset, regressiot ja rajat

- Kiinnitetty lähtöcommit: Node **209 PASS / 17 FAIL / 0 SKIP**, 226 testiä.
- Korjattu haara: Node **213 PASS / 24 FAIL / 0 SKIP**, 237 testiä. Vanhoja testejä
  ei poistettu, muokattu eikä merkitty odotetuiksi epäonnistumisiksi.
- Uusi auditointi + `mobile-learning-safety.test.mjs` + `structure-learning.test.mjs`:
  **35 PASS / 0 FAIL** (11 uutta, 17 P0-testiä, 7 oppijan testiä).
- Relevantti aito Chromium/OCR: **7 PASS / 0 FAIL**: uusi vastatesti, neljä
  `portfolio-visual-ledger.spec.mjs`-koetta ja kaksi
  `portfolio-inline-ledger.spec.mjs`-koetta. Molemmat PR #44:n testitiedostot säilyvät
  ennallaan. Pohjacommitilla uusi todellisen OCR:n vastatesti on **FAIL**.
- Koko Chromium-sarjaa ei ajettu tässä rajatussa auditissa. GitHub CI:tä täsmälliselle
  lopulliselle HEADille ei ole vahvistettu. Paikallista ajoa ei kutsuta CI-hyväksynnäksi.

Seitsemän lisä-FAILia verrattuna kiinnitettyyn lähtöön ovat seuraavat vanhat
korttivertailun myönteiset oletukset, eivät PR #44:n visual-testit:

1. `en: independent third import improves without learning names or values`
2. `fi: independent third import improves without learning names or values`
3. `learned positions transfer to entirely unseen names and listing codes`
4. `correction teaches structural roles, never values; same-document replay and conflicting teaching stay blocked`
5. `active teaching plus three independent cards: repeated banner is not a name`
6. `one or two cards do not establish cross-card semantics, even after learning` (sen ensimmäinen 3 kortin onnistumisoletus)
7. `one low-confidence ticker may help identify layout but its own row remains blocked`

Kattavuustappio vanhassa otsikoimattomien korttien automatiikassa on todellinen.
Sitä ei korjata palauttamalla todistettua väärää nimipäättelyä. Vanhat turvallisuus-
ja läpimenotestit ovat osin samassa testifunktiossa; siksi uusi kontrollisarja
tarkastaa turvallisuusväitteitä myös silloin, kun alkuperäinen testi pysähtyy aikaisin.

**Poistoehdotus, ei poistopäätös:** jos vanha korttiadapteri poistetaan käytöstä,
irrota hyväksynnän jälkeen B-luokan indeksisidos-/otsikoimattoman nimen
läpimeno-odotukset sen sopimuksesta. Säilytä A-vaatimukset uuden polun omilla
lähdeoraclen ja instrumenttivahvistuksen testeillä. Tässä ei ole näyttöä, jolla
kaikki 17 testiä voisi luokitella C:ksi tai poistaa yhtenä joukkona.

## Toistettavuus ja toimitus

Node 22.23.3, Playwright 1.57.0, paikallinen Chromium 154 ja same-origin OCR-mallit.
Komennot:

```sh
node --test tests/*.test.mjs
node --test tests/issue45-legacy-audit.test.mjs tests/mobile-learning-safety.test.mjs tests/structure-learning.test.mjs
REAL_OCR_QA=1 npx playwright test issue45-legacy-audit.spec.mjs portfolio-visual-ledger.spec.mjs portfolio-inline-ledger.spec.mjs
```

Pilvessä selain käyttää `/workspace/scratch/engine-issue38-playwright.config.mjs`-
asetusta; se käynnistää tarvittaessa paikallisen palvelimen porttiin 4175.
Pohjavastakoe käyttää samaa testikoodia ja portissa 4176 palveltua
`631a47d`-lähdearkistoa. Historialliset lokit:
`/workspace/scratch/issue45-history/<SHA>.tap`; pohja `/tmp/issue45-base-node.log`;
RED `/tmp/issue45-red.log` ja `/tmp/issue45-browser-red.log`.
Lopullisen commitin SHA ja testiajot kirjataan `/tmp/issue45-final-*`-tiedostoihin
ja loppuraporttiin. Näitä työympäristön lokeja ei väitetä GitHub-artifacteiksi.

Muuttuneet tiedostot: yksi vanhan adapterin moduuli, kaksi uutta testitiedostoa,
tämä raportti ja historiallisten testitulosten JSON. Ei uusia riippuvuuksia.
`canPersist:false` säilyy; mitään taloustietoa ei tallenneta. Profiileihin ei lisätä
nimiä, alkuperäistä OCR-tekstiä tai kuvia. Palkkaa, Osakevahtia, mainia, PR #44:n
työhaaraa tai LAB-julkaisua ei muuteta. Ei ulkoisia markkina-/AI-kutsuja.

Tuntemattomat riskit: koko visual-parserin kaikkia geometria-, sivu-, tili- ja
duplikaattitapauksia ei auditoitu tässä tehtävässä; oikeita kuvia tai Androidia
ei testattu; lähdeotsikko ja käyttäjän oma korjauskaan eivät todista C-tason
instrumentti-identiteettiä. Tästä seuraa **NO-GO integraatioon/julkaisuun**.

Draft PR valmistellaan kohteeseen `feature/holdings-inline-values-20261018`, jotta
diff sisältää vain tämän auditin, mutta kohdehaaraan ei kirjoiteta. Ympäristön
voimassa oleva verkkopolitiikka ei salli `api.github.com`-osoitetta eikä käytössä
ole GitHub-kirjoitusliitintä. Git-push ei yksin luo Draft PR:ää; PR:n luonti voi
siksi jäädä ulkoiseksi toimitusrajoitteeksi. Tunnuksia ei pyydetä eikä estoa kierretä.

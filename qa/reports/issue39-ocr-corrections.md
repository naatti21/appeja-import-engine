# Issue #38 / PR #39: OCR ja tilapäinen korjauspolku

17.10.2026. **NO-GO julkaisuun.** Paikalliset kehittäjätestit, ei riippumaton QA.
Pohja: `7eb404bb34f5085c9404686e2b23f2b4b5c276ea`, haara
`feature/issue38-mobile-structure-learning`. Arvioitava muutos on tämän raportin
sisältävä commit (`git rev-parse HEAD`); aiempi tulosraportti säilyy muuttumattomana.

## Juurisyyt

Todellinen canvas-PNG → paikallinen Tesseract 5.1.0 → TSV/koordinaatit →
korttirakenne → lähde-ehdotus. Alkuperäistä 12 omistuksen vertailua ei muutettu.
Seitsemän puuttuvan omistuksen syyt erotettiin sanakohtaisista havainnoista:

| Tapaukset | Todiste / katoamisvaihe | Korjaus ja jäljelle jäävä raja |
| --- | --- | --- |
| EN ticker, ensimmäinen omistus (1) | Ticker oikein, mutta confidence 80,949081 ja MIC 77,632767; alle ennallaan olevan 85:n portin | Vaatii kyseisen lähdetunnisteen käyttäjävahvistuksen |
| FI ticker (3) | fin+eng lukee Q-alkuiset tunnisteet O-alkuisiksi; eng lukee Q:n. Myös väärän lukeman confidence voi olla korkea | Ristiriita estää ehdotuksen. Korjataan vain kyseisen tuonnin lähdetieto, ei Q/O-korvaussääntöä |
| FI ISIN (3) | Tunniste, nimi ja määrä oikein; OCR tuottaa `Paivan muutos` sekä osassa `Maara`. Kenttäroolit jäivät tuntemattomiksi | Suljetun kenttäotsikkosanaston aksenttinormalisointi palauttaa roolit. Nimiä ja tunnisteita ei normalisoida tällä säännöllä |

Alkuperäisten korttien geometria ja rivijärjestys eivät selitä seitsemää puutosta.
Kuvan esikäsittelyssä ei ollut erillistä suodatusta: samat pikselit tuottavat eri
kielimalleilla eri tunnisteita. Kielimalliriippuvainen OCR-ero on siis todistettu.
Q:n hännän vähäinen pikselitieto tai kielimallin painot ovat mahdollisia selityksiä,
mutta mallin sisäistä virhesyytä ei todistettu. Englanti ei ole yleisesti parempi:
ruotsin lisäkokeessa ruotsin malli paransi tulosta selvästi.

Instrumentin todellisuus on erillinen ongelma: synteettinen ticker tai
tarkisteellinen ISIN ei todista markkinapaikkaa, valuuttaa eikä oikeaa instrumenttia.
Markkinavarmennettuja C-tason instrumentteja on tässä kokeessa **0**.

## Toteutus ja rajat

Muuttuneet tiedostot:
`src/mobile-card-holdings.mjs`, `src/mobile-review-session.mjs`,
`demo/structure-learning.html`, `demo/structure-learning.mjs`,
`scripts/prepare-local-ocr.mjs`, `tests/mobile-review-session.test.mjs`,
`tests/e2e/mobile-corrections.spec.mjs`,
`.github/workflows/structure-learning-qa.yml` ja tämä raportti.

- Yksittäisen nimen, kokonaisen tunnisteen tai määrän korjaus näyttää alkuperäisen
  OCR-rivin ja kuvarajauksen. Alkuperäinen havainto, alkuperäinen ehdotus ja korjaus
  säilyvät erillisinä vain tuonnin muistissa. Korjauksen voi poistaa; tyhjennys
  hävittää myös kenttäarvot, lähdevalinnat ja kuvan.
- Korjaus tarvitsee nimenomaisen vahvistuksen. Hintaa, saldoa, muutosta tai
  valikkotekstiä ei voi roolittaa määräksi. Epäselviä rinnakkaissarakkeita ei voi
  korjata yhdeksi lähderiviksi. Määrän tiukka positiivisen luvun validointi säilyy.
- Vahvistus välitetään erillisenä tilapäisenä metatietona; syötteen itse lisäämä
  `reviewCorrection`-väite ei ohita confidence-porttia.
- Roolien opetus on eri toiminto kuin arvon korjaus. Kaksi eri aineistoa tarvitaan;
  saman lähteen muokkaus ei kasvata aineistojen määrää. Ristiriitainen opetus
  eristetään. Rakenneoppimisen ydintä ei muutettu.
- A = havainto, B = lähteeseen sidottu ehdokas, C = markkinavarmennus tekemättä.
  Käyttäjäkorjaus ei nosta ehdokasta C-tasolle eikä mahdollista tallennusta.
- `swe+eng` on valinnainen kieli. `prepare-local-ocr.mjs --swedish` lisää saman
  version ruotsin mallin; oletusvalmistelu ja oletuskieli säilyvät ennallaan.
  Kaikki mallit tulevat samasta aiemmin käytetystä, lukitusta tessdata-versiosta.

## Ennen–jälkeen

Vertailu koskee kolmatta, opetuksesta erillistä tuontia. Tunnistus tarkoittaa
täsmälleen oikeaa nimeä, tunnistetta ja määrää B-tasolla, ei automaattihyväksyntää.

| Alkuperäinen 12 omistuksen koesarja | Oikein | Väärin | Estetty |
| --- | ---: | ---: | ---: |
| Pohjacommit (aiempi mitattu tulos) | 5/12 (41,7 %) | 0 | 7 |
| Tämä muutos, ilman arvokorjauksia | 8/12 (66,7 %) | 0 | 4 |

Osatulokset ovat EN ticker 2/3, FI ticker 0/3, EN ISIN 3/3 ja FI ISIN 3/3.
Neljä estettyä riviä vaativat yhden tunnistekentän vahvistuksen/korjauksen kukin.
Erillisissä todellisten pikselien korjaustesteissä EN- ja FI-tickerit ovat tämän
jälkeen kumpikin 3/3, väärät 0. Tämä ei muuta alkuperäisen automaattisen kokeen
tulosta 12/12:ksi eikä todista oikean pankkikuvan toimivuutta.

| Mitattu työ / tuonti | Ensimmäinen | Toinen | Kolmas |
| --- | ---: | ---: | ---: |
| EN ticker: vahvistettavat tunnistekentät | 1 | 1 | 1 |
| FI ticker: korjattavat tunnistekentät | 3 | 3 | 3 |
| Rakenneopetuksen kenttävalinnat, kumpikin sarja | 3 | 3 | 0 |

Kolmannella tuonnilla säästyy kolme rakennekentän valintaa. OCR-arvokorjaukset
eivät vähene; näin sama virhelukema ei muutu pysyväksi yhtiökohtaiseksi säännöksi.
Ensimmäisen tuonnin yhden opetuksen jälkeen ehdokkaita jää edelleen 0/3:
yksittäinen opetus ei aktivoi rakennetta. Mittari laskee kenttävalintoja ja
vahvistettavia tietoja, ei kaikkia käyttöliittymän napsautuksia.
Ihmisen ajansäästö: **NOT MEASURED**.

Riippumaton ruotsinkielinen kuvasarja käyttää eri tiliä, SEK-valuuttaa,
rahastonimiä ja seuraavassa tuonnissa uusia nimiä. Englannin mallilla 0/6 oikein,
0 väärää, 6 estettyä: `Förändring` luetaan heikosti (confidence noin 33,8).
Ruotsi+englanti-mallilla 5/6 oikein, 0 väärää, 1 estetty: ensimmäinen tuonti 3/3,
toinen 2/3. Jälkimmäisen ISINin englanninkielisen vertailuluennan confidence
83,122482 estää ristivarmistuksen. Tämä on epävarma lukema, ei todistettu väärä
ISIN. Molempien mallien tiukat 3/3-vaatimukset säilyvät FAIL-tilassa.

## Testit ja toisto

Node 22.23.3, Playwright 1.57.0, järjestelmän Chromium 154. Paikallinen
selainkonfiguraatio käyttää porttia 4175 ja kahta workeria; GitHubin Chromium
voi poiketa tästä. CI-tulosta ei johdeta paikallisesta ajosta.

- `node --test tests/*.test.mjs`: **176 PASS, 0 FAIL, 0 SKIP**, mukaan lukien
  10 uutta korjaus-, lähde-, ristiriita-, väärä opetus- ja tietosuojatestiä.
- `REAL_OCR_QA=1 playwright test`: **93 PASS, 4 FAIL, 3 SKIP**.
  FAIL: alkuperäiset EN/FI-tickerkokeet sekä uudet ruotsin kaksi kielimallikoetta.
  Odotuksia ei muutettu, epäonnistumisia ei merkitty odotetuiksi.
- Kolme korpustestiä olivat aluksi pois ajosta, koska generoitu korpus puuttui.
  Alkuperäisellä `python3 scripts/qa-corpus/generate.py` -generaattorilla valmistelun
  jälkeen `QA_CORPUS_READY=1 playwright test qa-v13-native-corpus.spec.mjs`:
  **3 PASS**. 60 PDF:ää, 1 530/1 530 tunnettua kenttää oikein, 50/50 negatiivista
  tapausta estetty. Yhteensä kaikki 100 selaintestiä suoritettiin: **96 PASS,
  4 FAIL**, ei lopullisesti ajamatta jääneitä testejä.
- Palkan muuttamattomat `learning.test.mjs` ja `model.test.mjs`: **20 PASS**.
  Palkan ja Osakevahdin työpuissa ei seurattujen tiedostojen muutoksia.
- Alkuperäiset `tests/fixtures/mobile-cards.mjs` ja
  `tests/e2e/structure-learning.spec.mjs` ovat bittitasolla muuttumattomat.
  Ensimmäisen SHA-256: `f0fa1ad37e1a720bd24eb68aea42a689aba02c4d888d7b1b01ec14c9b31f3f4a`;
  jälkimmäisen: `3f9ffa30410b008297ee807df61a74d6f2a83924b48117c8b78b927308b7b078`.

Paikalliset lokit: `/tmp/issue39-node-final.log`,
`/tmp/issue39-browser-final.log`, `/tmp/issue39-corpus-browser.log` ja
`/tmp/issue39-palkka-final.log`. Playwrightin JSON:
`/tmp/issue38-browser-results.json` (tämän kierroksen 100 testin ajo, nimestä
huolimatta). Kuusi synteettistä kuvakaappausta:
`/workspace/scratch/issue39-evidence/`. Nämä ovat työympäristön aineistoja,
eivät repositorioon tallennettuja kuvia tai GitHub CI -todisteita.
Päivitetty erillinen QA-workflow ajaa molemmat OCR-testit ja säilyttää epäonnistuneen
ajon lokin sekä testitulokset artifactissa. Uuden commitin Actions-tulos on
tarkistettava erikseen PR #39:stä.

## Osakevahdin resolverin myöhempi käyttö

Lukevassa auditissa tarkastettiin nykyinen Alpha
`957e0f648c2c787b731c9f80b3b86da303590ae7`, ei vain aiempaa korjaushaaraa.
Sen `/resolve` (`instrument-resolver-v1`) tarjoaa Yahoo-haun ja chart-metatiedot:
symboli, nimi, instrumenttilaji, pörssitietoja ja valuutta. Haku sisältää myös
ETF:t ja rahastot. Metatiedon epäonnistuessa arvoja puuttuu; ISIN ei yleensä tule
vastauksessa. Nykyisen käyttöliittymän automaattinen pistepäätös ei sellaisenaan
kelpaa Enginen C-tason todisteeksi.

Myöhempi rajattu sovitin voisi käyttää tätä olemassa olevaa palvelua käyttäjän
luvalla. Vain haettava nimi/tunniste lähtisi palveluun, ei kuva, raakateksti,
määrä, hankintahinta tai tili. Vastauksen pitäisi täsmätä kyseiseen kyselyyn,
listaukseen, normalisoituun MICiin, valuuttaan ja instrumenttilajiin; epäselvät
rinnakkaislistaukset ja puuttuvat tunnisteet jäävät tarkistukseen. ISINin
varmentamista ei saa väittää, jos palvelu ei palauta sitä. C-tason varmennus ja
sovelluksen käyttäjähyväksyntä/tallennusportti ovat edelleen erillisiä.
Tässä muutoksessa ei lisätä palvelukutsua eikä uutta markkinadatapalvelua.

## Tietosuoja, puutteet ja päätös

`canPersist:false` säilyy kaikissa tuloksissa. Hankintahintaa ei keksitä.
Korjausluonnosta tai havaintoja ei viedä rakenneprofiiliin. Testit tarkastavat
localStoragen ja profiilivarmuuskopion sekä korjausten peruutuksen. Todelliset
EN/FI-korjaustestit ja alkuperäinen kuvakoe estävät ulkoiset pyynnöt ja havaitsivat
niitä 0. Mallien valmistelu lataa ohjelmistoa, ei lähetä käyttäjän dokumentteja.
Palkkaa, Osakevahtia, main-haaraa tai julkaistua LABia ei muuteta.

Rakenneoppiminen kattaa edelleen rajatun korttiasettelun. Kaksi johdonmukaista
mutta väärää käyttäjäopetusta voi opettaa väärän roolin; se ei tee instrumentista
varmennettua. Saman OCR-perheen kaksi lukua ei ole riippumaton instrumenttitodiste.
Epävarma apurivi voi yhä estää muuten oikean omistuksen. Korjauspolku ei lupaa
korjata kaikkea epäselvää geometriaa tai kaikkia rikki luettuja kenttäotsikoita.

Fyysinen Android, alkuperäinen pankkikuva, matala resoluutio ja eri välittäjien
aidot asettelut: **NOT RUN**. Tarkistettava kuvarajauksen luettavuus ja valinta,
näppäimistön kanssa korjaaminen, oikea määrä/nimi-sidos, peruutus OCR:n aikana,
toistuvien tuontien työmäärä sekä rinnakkaislistauksen/valuutan varmennus erillisessä
resolverikokeessa. Henkilökohtaisia kuvia ei pidä liittää julkiseen PR:ään.

**Suositus: jatka tutkimusta, NO-GO yhdistämiselle tai julkaisulle.**
Seuraava toimi: riippumaton katselmointi tämän commitin korjauspolulle ja neljälle
avoimelle selaintestille ennen seuraavan korjauskokeen rajaamista.

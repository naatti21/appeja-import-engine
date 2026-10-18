# P0: väärän rakenneoppimisen esto — rajattu turvaportti, ei valmis ratkaisu

18.10.2026. Pohja `1938f3baabea81fb15c1e846a1cef77539587bb2`,
`feature/issue38-mobile-structure-learning`, Draft PR #39 / issue #38.
**NO-GO yhdistämiselle, integraatiolle ja julkaisulle.**
Turvallisuusvastatestit läpäisevät, mutta automaattisen tunnistuksen kattavuus
regressoi merkittävästi. Kokonaistehtävää ei merkitä hyväksytyksi.

## 1. Toistettu virhe ja juurisyy

Riippumattomat Node-lähteet eivät käytä vanhaa fixtureä tai yritysnimilistaa.
Ensimmäisistä 12 vastatestistä pohja läpäisi 4 ja epäonnistui 8:ssa. Kaksi
keskeistä turvaehtoa epäonnistuivat: nimi/väliotsikko-vaihto sekä kaksi väärää
opetusta. Myöhempi vastatesti osoitti myös, että yksittäinen vapaa tekstirivi voi
olla väliotsikko, jos varsinainen nimi puuttuu. Pelkkä tekstirivien lukumäärä ei riitä.

Todellinen pikselit → Tesseract → TSV → kortti → ehdotus -vastakoe ajettiin myös
pohjacommitin arkistoidulla lähdekoodilla eri localhost-portissa, ilman työhaaran
palauttamista tai jäädytetyn koesarjan muuttamista:

| Todellinen OCR-vastakoe | Pohja: väärät väliotsikkonimet | Korjaus: väärät | Korjaus: estetyt |
| --- | ---: | ---: | ---: |
| Nimi ja väliotsikko vaihtavat paikkaa | 3/3 | 0 | 3/3 |
| Kaksi johdonmukaisesti väärää opetusta | 3/3 | 0 | 3/3 |

`resolveMobileCards` valitsi aktiivisen profiilin `binding.entity`-indeksin
riippumatta siitä, pystyikö nykyinen lähde erottamaan tekstirivien merkitykset.
Jälkitarkistus varmisti vain roolin `text`. `createStructureLearner.confirm`
laski kaksi eri dokumenttiavainta, mutta sillä ei ole semanttista todistetta siitä,
että käyttäjän valitsema `text` olisi instrumentin nimi. Vaihdossa roolijono säilyy
identtisenä. Kyse ei ollut OCR:n tai merkkien normalisoinnin virheestä.

## 2. Korjaus ja sen tekninen raja

Nykyinen lähde ratkaistaan ennen opitun kenttäkartan käyttöä. Nimikentälle tarvitaan
yksi eksplisiittinen lähdeotsikko (`Instrument name`, `Security name`,
`Arvopaperin nimi`, `Instrumentets namn`) tai tämän dokumentin nimen korjaus/
vahvistus. Otsikkosanasto nimeää kenttiä, ei yrityksiä tai kiellettyjä väliotsikoita.
Myös yksi otsikoimaton tekstirivi jää epävarmaksi; muuten sama virhe palaisi
puuttuvan nimen kautta. Useat nimikentät, ristiriitaiset vahvistukset tai heikko
OCR eivät muutu varmoiksi aiempien opetusten avulla.

`assessSourceBinding` tarkistaa lähteestä johdetun sidoksen suhteessa profiiliin.
Se ei käytä profiilia puuttuvan semantiikan täyttämiseen. Eri nimipaikka aiheuttaa
`LEARNED_NAME_CONFLICT`-eston; erottelemattomat tekstirivit `AMBIGUOUS_NAME`-eston.
Estossa ilmoitetaan `field: name` ja nykyisen lähteen tekstirivien viitteet.
Käyttöliittymä ohjaa vain nimen korjaukseen alkuperäisen kuvarajauksen avulla.

Dokumenttikohtainen korjaus voi ratkaista vanhan nimipaikan ristiriidan, mutta
ei päivitä, vahvista eikä aktivoi profiilia. Profiilin opetusten välinen
`conflict`-tila säilyy estona; peruutus tai nollaus ei ohita nykyisen lähteen porttia.
Alkuperäisen otsikon semantiikka säilytetään myös korjausprojektiossa, jotta
toisen nimen vahvistaminen ei hävitä lähteen nimikenttäristiriitaa.

Tallennusmuotoa ei muutettu: `active` tarkoittaa edelleen kahta toistettua
rakennevalintaa, **ei semanttisesti varmennettua profiilia**. Kaksi väärää opetusta
voi yhä tuottaa tämän historian tilan, mutta se ei anna oikeutta muodostaa
automaattista nimeä. Kaikki oppijan tuotantokoodin käyttökohdat tarkistettiin;
korttiadapteri on ainoa profiilin perusteella omistusehdotuksia muodostava kuluttaja.
Käyttöliittymän vahvistusteksti kertoo tämän rajan.

A = havainto, B = lähteeseen sidottu ehdokas, C = ulkoisesti varmennettu instrumentti.
Otsikko tai käyttäjäkorjaus voi tukea B:tä; ne eivät tuota C:tä. Tickerin syntaksi
ja ISIN-tarkiste eivät todista todellista instrumenttia. `canPersist:false` säilyy.

## 3. Kattavuus ja käyttäjätyö — regressiota ei piiloteta

Alkuperäiset kuvat, oraclet ja testien odotukset ovat muuttumattomat.

| Alkuperäinen 12 omistuksen held-out-koe | Oikein automaattisesti | Väärin | Estetty |
| --- | ---: | ---: | ---: |
| Ensimmäinen OCR-kierros | 5/12 | 0 | 7 |
| Edellinen korjaus, pohjacommit | 8/12 | 0 | 4 |
| P0-portti ilman tämän tuonnin arvovahvistuksia | **0/12** | 0 | 12 |
| P0-portti nimen ja tarvittavan tunnisteen käyttäjävahvistuksilla | 12/12 B-ehdokasta | 0 | 0 |

Viimeinen rivi ei ole automaattista tunnistusta. Tarvittiin **12 nimen vahvistusta
ja 4 tunnisteen vahvistusta/korjausta**: EN ticker 1, FI ticker 3. Pelkkien nimien
vahvistuksen jälkeen osatulokset olivat EN ticker 2/3, FI ticker 0/3 ja molemmat
ISIN-sarjat 3/3, eli aiemmat OCR-portit säilyivät. Ilman vahvistuksia ensimmäinen
estoperuste oli kahdeksalla rivillä epäselvä nimi ja neljällä aiempi OCR-esto;
OCR-esteen poistaminen paljastaa myös niiden nimisemantiikan puuttumisen.

Kokonaisregressio on **−8 automaattista oikeaa ehdotusta / 12** ja **+12
nimen vahvistusta** edelliseen kierrokseen nähden. Tämä ei täytä alkuperäistä
vähemmän korjaustyötä vaativan oppimisen tavoitetta. Samassa kuvassa uudelleen
tuodut kolme nimeä tarvitsevat taas vahvistuksen; arvoja ei muisteta profiilissa.
Ihmisen ajansäästöä ei mitattu.

Portti ei estä kaikkia lähteitä: erillisessä aidon OCR:n onnistumiskokeessa
nimikenttäotsikoilla varustetut kortit tuottavat **3/3 oikein, 0 väärää** ilman
opetusta tai korjausta. FI/SV/EN-kenttäotsikot, uudet kansainväliset nimet sekä
sama instrumentti eri tileillä ja listauksilla testataan myös Node-vastatesteissä.
Tämä rajattu onnistuminen ei korvaa alkuperäisen mobiilinäkymän kattavuutta.

## 4. Testit ja jäljitettävyys

Lopullinen testikohde on tämän raportin sisältävä commit; tarkka SHA kirjataan
ajon alussa `/tmp/issue39-p0-tested-sha.txt` ja toimitetaan loppuraportissa.
Node 22.23.3, Playwright 1.57.0, järjestelmän Chromium 154, paikalliset OCR-mallit.

- Uudet Node-vastatestit: **17 PASS**. Ensimmäiset kaksi P0-virhettä ja yksittäisen
  väliotsikon tapaus toistettiin RED-tilassa ennen niiden korjausta.
- Uusi todellisen OCR:n selainvastakoe: pohjalla **FAIL**, korjattuna **PASS**.
  Uudet kolme selaintestiä: **3 PASS** (hyökkäykset, onnistuminen/korjaus, 12 rivin
  kenttäkorjaus). Ei mockattua OCR:ää näissä testeissä.
- Koko Node-sarja: **172 PASS, 21 FAIL, 0 SKIP (193 testiä)**.
- Koko Chromium-sarja, `REAL_OCR_QA=1 QA_CORPUS_READY=1`:
  **92 PASS, 11 FAIL, 0 SKIP (103 testiä)**. Myös alkuperäinen 60 PDF:n korpus
  ajetaan. Portin aiheuttamia vanhojen testien epäonnistumisia ei poistettu,
  ohitettu tai muutettu odotetuiksi epäonnistumisiksi.

Node-epäonnistumiset ovat vanhoissa `mobile-card-holdings.test.mjs`- ja
`mobile-review-session.test.mjs`-testeissä: niiden otsikoimaton nimi tai pelkkä
opittu indeksisidos ei enää riitä automaattiseen ehdotukseen. Osa tästä estää
myös myöhempien väitteiden suorittamisen näissä testeissä. Uudet positiiviset
kontrollit tarkastavat erikseen tilit/listaukset, lähdeviitteet, OCR-korjauksen ja
sen peruutuksen, C-tason puuttumisen sekä normaalin onnistumisen.

Selain-FAIL: neljä alkuperäistä OCR-rakennekoetta; kolme vanhaa
320/360/393 px:n opitun sidoksen käyttökoetta; kaksi vanhaa tickerkorjauskoetta;
kaksi aiempaa ruotsin kielimallikoetta. Jälkimmäiset olivat jo aiemmin punaiset.
Niiden nykyinen kattavuus on 0/6 kummallakin mallilla myös nimisemantiikan vuoksi.

Toisto: `node --test tests/*.test.mjs` ja
`REAL_OCR_QA=1 QA_CORPUS_READY=1 playwright test`.
Pilvessä selainkonfiguraatio on `/workspace/scratch/engine-issue38-playwright.config.mjs`.
Lopulliset lokit `/tmp/issue39-p0-node-final.log`,
`/tmp/issue39-p0-browser-final.log`; JSON `/tmp/issue39-p0-browser-final.json`.
RED-lokit `/tmp/issue39-p0-red.log`, `/tmp/issue39-p0-single-heading-red.log`,
`/tmp/issue39-p0-browser-red.log`. Paikalliset lokit eivät ole GitHub CI -tuloksia.
QA-workflow suorittaa selainkokeet myös Node-testien epäonnistuttua ja säilyttää
molemmat lokit; epäonnistunut job ei muutu vihreäksi.

## 5. Tietosuoja, muuttuneet tiedostot ja avoin päätös

Profiiliin tallennetaan edelleen vain sallittu roolijono, indeksisidos ja tila.
Ei OCR-tekstejä, kuvia, nimiä, tunnisteita, lähde-ID:itä, koordinaatteja tai
taloudellisia arvoja. Väärennetyt lähteen `nameConfirmed`/`nameLabel`-kentät eivät
kelpaa vahvistukseksi. Duplikaatit lähde-ID:t ja blocking-ristiriidat estävät.
Korjauksesta säilyvät alkuperäiset lähdeviitteet; muistiluonnos ei muuta alkuperäistä
lähdettä. Uusissa selaintesteissä ulkoiset pyynnöt estettiin ja niitä havaittiin 0.
Uusia ulkoisia palveluja, riippuvuuksia tai tallennusportteja ei lisätty.

Muutokset: `src/structure-learning.mjs`, `src/mobile-card-holdings.mjs`,
`src/mobile-review-session.mjs`, `demo/structure-learning.mjs`,
`tests/mobile-learning-safety.test.mjs`, `tests/e2e/mobile-learning-safety.spec.mjs`,
`.github/workflows/structure-learning-qa.yml` ja tämä raportti. Vanhat testit ja
fixturet säilyvät bittitasolla ennallaan. Palkka, Osakevahti, main ja LAB-julkaisu
eivät muutu. Ei mergeä tai julkaisua.

**Perusteltu vaihtoehto jatkoon:** nykyinen pelkän roolijonon ja rivipaikan muisti
ei sisällä tietoa, joka erottaisi kaksi mielivaltaista tekstiriviä. Saman
epävarman valinnan lisätoistot eivät ratkaise tiedon puutetta. Säilytä rakenne
tarkistuksen apuna, mutta tee nimisidoksesta erillinen dokumenttikohtainen
todisteportti: eksplisiittinen lähdesemantiikka tai myöhemmin sovelluksen nykyisen
instrumenttiresolverin nimen–tunnisteen–listauksen tarkistus käyttäjän erikseen
hyväksymässä, tietosuojaltaan arvioidussa integraatiossa. Sen tulos ei saa ohittaa
määrän lähdesidosta, OCR-ristiriitaa eikä erillistä tallennushyväksyntää.
Tässä muutoksessa resolveria ei kutsuta eikä sen toimivuutta väitetä testatuksi.

Väärä käyttäjän *tämän dokumentin* arvokorjaus voi edelleen tuottaa väärän
käyttäjäkorjatun B-ehdokkaan: ilman riippumatonta identiteettitietoa sitä ei voida
todistaa oikeaksi. Se ei synnytä automaattista tulevien dokumenttien nimisääntöä
eikä C-varmennusta. Alkuperäinen pankkikuva, fyysinen Android ja riippumaton QA
ovat **NOT RUN**. Neljän aiemman punaisen selaintestin sijaan nyt punaisia on 11.
Siksi turvallisuusporttia ei pidä tulkita julkaisuvalmiiksi rakenneoppimiseksi.

**Seuraava toimi:** riippumaton katselmointi P0-portista ja päätös edellä kuvatusta
semanttisen todistamisen arkkitehtuurista ennen kattavuuden palauttamista.

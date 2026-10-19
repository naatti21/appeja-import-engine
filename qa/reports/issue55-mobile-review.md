# P0 #55 — paikallinen mobiilin instrumenttitarkistus

Työmääritys: PR #58, kommentti 6259977953.
Lähtöcommit: `9673aab9f40dd7a704bcdd7993b3f718601aaaec`.
Kohdehaara: `fix/issue55-lookup-requires-reviewed-name-20261019`.
Uusi haara: `fix/issue55-mobile-identity-review`.
**NO-GO. Issue #55 pysyy avoinna riippumattomaan Work-auditointiin ja sovellusintegraation tarkistukseen asti.**

## Toteutettu polku

Erillinen `demo/portfolio-identity-review.html` on paikallinen tutkimussivu. Se ei ole
LAB-paketin HTML-allowlistalla eikä sitä linkitetä julkaistuun käyttöliittymään.
`mobile-source-review` ja `structure-learning` sekä niiden palkkapolut säilyvät muuttumattomina.
Sivu tarvitsee repositorion paikalliset Tesseract-resurssit ja HTTP-palvelimen.

Kuvasta luetaan `fin+eng` ja `eng`, muodostetaan alkuperäiset TSV-lähdehavainnot ja
ajetaan nykyinen visuaalinen extractor. Raw-tulosta ei näytetä instrumenttilistana:
`preparePortfolioIdentityReview` tuottaa varmentamattomia tekstihavaintoja. Näkyviin
jää havaittu teksti, määrä, arvo ja nimen ympäristön kuvapala; koko kuva on myös avattavissa.
Jokaisella rivillä on erilliset vahvistus-, nimenkorjaus- ja poissulkuvalinnat.
Korjauslomake alkaa tyhjänä. Ei esivalintaa, bulk-hyväksyntää tai muita muokattavia talouskenttiä.

Yhden rivin valinta onnistuu ilman muiden rivien käsittelyä. Käsitellyt rivit ovat omassa
osiossaan; valinnan voi kumota. Lomakkeesta voi palata, ja peruutus tai uusi tiedosto
poistaa vanhan istunnon, kuvan sekä hakutulokset. Myöhäiset OCR- ja hakuvastaukset hylätään.
Kohteet ovat vähintään 44 px; näppäimistöaktivointi ja fokus testataan 360 px näkymässä.

Oletuksena hakupalvelua ei ole. Testissä injektoidun paikallisen adapterin saa käynnistää
vasta rivin valinnan jälkeen erillisellä hakupainikkeella. Uusi sivu ei toteuta ulkoista
hakua eikä anna sille suostumusta. Aiemman kirjasto-API:n ulkoinen tila vaatii edelleen
sekä aidon nykyisen tarkistuksen että `approvedExternalLookup:true`-ehdon; sen sovelluskohtainen
suostumuskäyttöliittymä ei kuulu tähän paikalliseen kokeeseen.

## Ohitusreittien auditointi ja korjaus

Lähtökoodi tarkisti tarkistusolion rakenteen mutta ei alkuperää. JSON-kopio tai muokattu
valintatietue pystyi esiintymään käyttäjän valintana. Lisäksi vanha tarkistusversio oli
käyttökelpoinen ja väärennetty listaustulos voitiin valita.

- Tarkistusoliot rekisteröidään prosessin yksityiseen WeakMapiin. JSON, kopiot ja
  käsin valmistetut oliot eivät saa hyväksyntää. Jokaisessa tuonnissa on uudet rivitunnukset.
- Uusi valinta tai kumoaminen mitätöi edellisen version; peruutus mitätöi istunnon.
- Muuttumattomuustarkistus ei kutsu gettereitä tai `toJSON`-metodeita. Näillekin tehtiin
  vastatestit: pelkkä JSON-merkkijonon vertailu ei olisi riittänyt.
- Haku tarkistaa nykyisen version ennen adapterikutsua ja vastauksen jälkeen. Saman
  version samat kaksoiskutsut yhdistetään. UI estää myös kaksoispainallukset.
- Rivikohtainen haku käyttää täsmällistä rivitunnusta, ei yhteen liitettyjä lähdetunnuksia.
  Pilkkuja sisältävien lähdetunnusten törmäykselle tehtiin RED→GREEN-vastatesti.
- Listaustuloksen valinta hyväksyy vain nykyisen haun tuottaman muuttumattoman olion.
- Puuttuvat lähdetunnukset sekä virheellinen tai eri sivuille hajautuva geometria eivät
  kelpaa tarkistusriviksi. Alkuperäisiä OCR-tekstejä tai koordinaatteja ei korjata salaa.

`src/` ja `demo/` -kuluttajien haku löysi visuaalisen extractor→listing-polun vain
uudesta eristetystä sivusta. Aiemmat suorat käyttökohdat ovat testejä. Listing-rajalla
raaka OCR, myös ulkoisen haun boolean-luvalla, pysyy estettynä. Muut CSV-/palkkaparserit
eivät käytä tätä visuaalista listing-polkua eikä niitä muutettu.

Uhkamalli: tämä estää datan, kopioitujen hyväksyntöjen ja vanhojen tapahtumien ohituksia
luotetussa sovelluskoodissa. Se ei ole eristys haitallista saman originin JavaScriptiä
vastaan: samaan sovellukseen injektoitu ohjelma voi kutsua julkista valinta-API:a.
Käyttöliittymä kuuntelee oikeita käyttäjätapahtumia, mutta `isTrusted` ei yksin ole
sovelluksen turvallisuusraja. Tuleva integraatio on auditoitava erikseen.

## Testit ja rehelliset regressiot

Uudet Node-vastatestit ovat `tests/issue55-session-boundary.test.mjs`. Alkuperäiset
kahdeksan testiä epäonnistuivat lähtökoodilla. Kehityksen aikana lisättiin toistetut
vastatestit mukautetulle serialisoinnille, gettereille, väärälle riville ja vanhan
kuvan rivitunnukselle sekä oikean valintapolun onnistumistestejä.

`tests/e2e/issue55-mobile-identity.spec.mjs` muodostaa alkuperäisestä jäädytetystä
fiktiivisestä koeaineistosta oikeat PNG:t. Se käyttää oikeaa paikallista Tesseractia,
tiedostokenttää, painikkeita ja lomakkeen lähetystä — ei suoria valintafunktion kutsuja.
Erillinen viivehyökkäys käyttää ohjattua OCR-vastausta peruutuksen testaamiseen.

| Kuva | Oikeat havainnot | Väärät raw-ehdotukset | Automaattisesti hyväksytyt | Rivikohtaiset valinnat ennen hakua |
|---|---:|---:|---:|---:|
| Haalea nimi | 2 | 1 | 0 | 1 |
| Puuttuva nimi | 2 | 1 | 0 | 1 |
| Puhdas vertailu | 3 | 0 | 0 | 1 |

Jokaisessa kuvassa on kolme OCR-havaintoa, ei estettyjä raw-rivejä. Kahdessa hyökkäyksessä
`Growth bucket` pysyy vääränä raakahavaintona ja raw-aritmetiikka antaa edelleen PASS.
Turvallisen tarkistuksen reconciliation on `not-evaluable`, ehdokkaita 0 ja kaikki
`canPersist:false`. Käyttäjän yhden nimikorjauksen ja yhden erillisen hakupainalluksen
jälkeen vain `{name:'Amber Circuit'}` menee paikalliselle fake-adapterille; kaksi muuta
riviä jää tarkistamatta. Ulkoisia HTTP-pyyntöjä 0. Käyttäjäajan säästö: NOT MEASURED.

Alkuperäisiä PR #56/#57/#58-, #49/#50- tai issue45-testejä ei muutettu. Raakatulkinnan
kaksi Node-RED-testiä ja kaksi PNG-RED-testiä jäävät epäonnistuviksi.
Täsmällisen lähtöcommitin koko Node-sarja toistettiin: 256 PASS / 26 FAIL / 0 SKIP.

Kolme aiemmin läpäissyttä listing-testiä ei enää läpäise uutta rajaa:

1. `mismatched OCR spelling is not silently replaced by a nearby ticker/name` tekee
   `structuredClone`-kopion hyväksynnästä ja muuttaa nimeä.
2. `duplicate instrument name reuses per-call lookups but retains separate source rows`
   muuttaa valittua nimeä suoraan ilman uutta käyttäjävalintaa.
3. `no automatic proposal from invalid source candidate or invalid market listing`
   muuttaa tarkistusoliota mutta odottaa muiden rivien hakuja; uusi raja hylkää koko
   väärennetyn version ennen ensimmäistäkään kutsua.

Nämä eivät ole piilotettuja vihreitä tuloksia: testit säilyvät FAIL-tilassa. Uusi erillinen
onnistumistesti varmistaa samannimisten rivien hakujen yhdistämisen ja väärän kirjoitusasun
suodatuksen aidosti valinta-API:n kautta. Riippumattoman auditoinnin on arvioitava
rajapintasopimuksen muutos ja vanhojen testien myöhempi hallittu migraatio.

## QA-toimitus

`.github/workflows/issue55-mobile-review-qa.yml` käynnistyy vain omasta kehityshaaran
pushista tai tähän lähtöhaaraan kohdistuvasta PR:stä. Checkout käyttää täsmällistä head-SHA:ta.
Se ajaa uuden UI-ketjun ja erillisessä työssä koko Node-sarjan, vanhat kohdennetut
sopimukset sekä jäädytetyn aidon OCR-RED-oraclen ja aiemmat turvallisuuskokeet.
Tunnetut FAIL-tulokset palauttavat lopulta aidon epäonnistuvan CI-tilan.
Vain `contents:read`; ei Pages-, deploy-, merge- tai hyväksyntätoimintoja.
Artefakteissa ovat checkout-SHA, lokit sekä vain fiktiiviset PNG:t ja OCR-havainnot.

Toistaminen ympäristön valmistelun jälkeen:

```
node --test tests/issue55-session-boundary.test.mjs tests/issue55-identity-review.test.mjs
npm test
REAL_OCR_QA=1 npx playwright test issue55-mobile-identity.spec.mjs
REAL_OCR_QA=1 npx playwright test
```

Tarkat lopullisen commitin tulokset ja GitHub-ajolinkit toimitetaan luovutusraportissa.
Tämä dokumentti ei väitä CI:tä tai riippumatonta QA:ta vihreäksi.

## Jäljellä

Raaka extractor ei osaa erottaa puuttunutta nimeä väliotsikosta. Käyttäjä voi myös
vahvistaa väärän havaitun tekstin tarkoituksellisesti; oma valinta ei ole markkinavarmennus.
Puuttuvaa nimeä ei voi palauttaa kuvasta arvaamatta. On käytettävä käyttäjän tietoa tai
jätettävä rivi pois. Ei markkinadatapalvelua, tunnistearvausta, tilien yhdistämistä,
salkun tallennusta tai oppimisprofiiliin talletettua talousdataa.

Fyysisen Android-laitteen käytettävyys, avustavat tekniikat, todellinen sovellusintegraatio
ja ulkoisen haun suostumuspolku jäävät erilliseen hyväksyntään. Tutkimussivua ei julkaista
LABiin. Palkkaa, Osakevahtia, mainia ja PR #54:n P1-haaraa ei muutettu.

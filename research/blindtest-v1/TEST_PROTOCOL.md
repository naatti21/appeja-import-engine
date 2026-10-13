# Testausmenettely V1

## Lukitse koe ennen tuloksia

Baseline on `8f28544651a27225c1212228753fbc6c6a265c38`. Älä nimeä mainin README:tä baseline-runtimeksi. Käytä myöhemmässä vertailussa samaa PDF.js 6.4.299 -versiota ja samoja tiedostobittejä kaikille kandidaateille. Alkuperäisen paketin validointi tehtiin runtimeen valmiiksi sisältyneellä PDF.js 5.6.205:llä; versioero on avoin uusintatarkistus, ei poistettu rajoitus.

Kirjaa testattava SHA, PDF.js/runtime/browser-versiot, ajopaikka, manifest-hash ja DEV/HOLDOUT. Älä muokkaa parseria tai odotuksia kesken saman ajon. Tuloksesta tulee erillinen tiedosto, ei muutos tähän masteriin. Varoitusten puuttuminen ei osoita kattavuutta.

## Testivaiheet

1. **Tiedosto-/lukuvaihe:** `getDocument → getTextContent`, kaikki sivut. Säilytä jokainen raw-item, lähde-ID, sivu, matriisi/koordinaattikehys, itemin raw-span ja lukemisongelma. Ei palkka-adapteria tässä vaiheessa.
2. **Rakennevaihe:** arvioi alueet, palstat, rivit, solut, otsikot ja jatkotaulukot. Jos kandidaatti ei tarjoa rakenneoutputia, merkitse mittari NOT AVAILABLE; älä päättele rakennetta onnistuneesta palkkasummasta.
3. **Semantiikkavaihe:** palkkadokumenteille nykyinen palkka-adapteri; muille raakaluenta + rakenne ja tuntemattoman tyypin reititys. Holdings-adapteri voidaan testata erikseen sen sovitulla schemalla. Invoice/inventory/time/dispatch/expenses eivät ole palkka-adapterin semanttisia tehtäviä.
4. **Portti:** kirjaa `candidate-ready/review-required`, oikeat estoperusteet sekä `canPersist`. Vakio-false ei todista 0 väärää hyväksyntää; vaarallinen `candidate-ready` on erillinen virhe.
5. **Arvioija:** sitoo outputin ground truthiin sijainnin, raw-spanin, roolin ja recordin mukaan, ei pelkän saman numeron perusteella. Poiminnan ulkopuolinen annotaatio toimii recallin nimittäjänä.

## Output-sopimus vertailuadapterille

Jokaiselle dokumentille kirjataan `document_id`, `reader_items`, `regions`, `tables`, `field_candidates`, `issues`, `decision` ja `resource_metrics`. Kenttäehdokkaalla on ainakin `key/role/record/unit/value/status/source_ids`. Lähde-ID viittaa saman dokumentin itemiin ja tarvittaessa sen raw-spaniin. Kaikki kandidaatit palautetaan, ei vain voittaja. Kirjaa myös käsittelemättömät havainnot.

Ground truth -ID ei saa päätyä parserin ennakko-odotukseksi. Arvioija tekee bijektiivisen, lähdesidokseen perustuvan matchingin: yhtä output-havaintoa ei lasketa kahdeksi onnistumiseksi eikä samaa arvoa eri rooleissa yhdistetä. Saman recordin konfliktin kaksi arvoa ovat kaksi lähdehavaintoa ja yksi konfliktitapahtuma.

## Kymmenen erillistä mittaria

| Mittari | Menetelmä |
|---|---|
| 1. Teksti | Raw-spanin exact-match tai normalisoitu whitespace-match; erillinen CER edit distance / truth-merkkimäärä. Desimaalimerkkejä, miinusmerkkejä ja etunollia ei normalisoida pois. |
| 2. Sijainti | Oikea sivu; lukuhavaintojen bbox/polygonin keskipiste truth-alueessa sekä sisältöä vastaava peitto. Solurakenteessa erillinen IoU, ehdotettu raja 0.5. Truth-bbox on solualue, ei glyph-laatikko: glyph-IoU:ta ei pisteytetä samoin. |
| 3. Otsikko-arvo | Oikea header-alue/solu ja siihen sidottu value-span. Numeron oikea arvo väärästä sarakkeesta on väärä sidos. |
| 4. Konteksti | `record/role/unit` kaikki oikein; palkkakausi, vuosikertymä, verokorttipohja ja aikaisempi maksu ovat eri rooleja. |
| 5. Olennaisten löytyminen | Exact oikeat ehdokkaat / annotoidut ratkaistavissa olevat olennaiset kentät. Raportoi neljä palkkaytimen kenttää erillään kaikista muista havainnoista. |
| 6. Huomaamatta jäänyt | Truth-kenttä ilman ehdokasta **ja** kohdistettua puuttuvuus-/epävarmuusilmoitusta. Erota näkyvä missing sekä väärällä arvolla täytetty missing. |
| 7. Väärä tulkinta | Arvo, sidos, rooli, record tai yksikkö väärin; luokittele erikseen. Precision = exact oikeat / kaikki tulkinnat. |
| 8. Konfliktit | Truth-konfliktien recall, output-konfliktien precision; molemmat lähdearvot täytyy säilyttää. Eri recordien laillinen toisto ei ole konflikti. |
| 9. Turha pysäytys | Ilman tahallista semanttista ongelmaa oleva dokumentti pysähtyy, vaikka kandidaatin tuettu rakenne/lukutapa riittää. Raportoi baseline-coverage-refusal erikseen, älä kutsu turvallista tuntemattoman layoutin kieltäytymistä datavirheeksi. |
| 10. Hiljainen hyväksyntä | Missing/conflict/ambiguous truth tai väärä kriittinen arvo/sidos → `candidate-ready` ilman estoa. Vieras tyyppi palkkana valmiiksi on route-safety-virhe. |

Raportoi raakaluvut per dokumentti ja per formaatti; kuuden holdoutin prosentit eivät ole markkinan tarkkuusarvio. Täydellinen pysäyttäminen voi olla turvallista mutta hyödytöntä: kerro myös oikein valmiiden dokumenttien määrä. Yhden `verified`-kentän lähde-ID:n olemassaolo ei yksin ole semanttinen onnistuminen.

## Käyttäjän korjaustyö myöhemmässä UI-kokeessa

Mittaa aktiivinen aika, lähdealueen avausten määrä, korjatut kentät, napautukset, hyväksyntä/hylkäys ja keskeytykset. Aloitus: ensimmäinen esikatselu valmiina; loppu: käyttäjä hyväksyy tai hylkää. Lukemis-/odotusaika kirjataan erikseen. Alkuperäinen ja käyttäjän korjaus säilytetään erillisinä; korjaus ei muutu parserin onnistumiseksi. Tulosta ei ole tässä paketissa mitattu.

## HOLDOUTin lukitus ja palautteen raja

Toteutusagentti käyttää vain DEV-handoffia. Arvioija säilyttää masterin ja HOLDOUT-annotaatiot. Ennen holdout-ajoa lukitaan kandidaatti-SHA, kriteerit ja tulossopimus. Holdout-inputit avataan vain arviointityötilaan, vastaukset eivät samaan toteuttajan prosessiin. Baseline ja kandidaatti saavat samat inputit; arvioija vertaa tuloksia vasta ajojen päätyttyä.

Kehittäjälle voidaan palauttaa aggregoidut mittarit ja virheluokat; älä anna holdoutin täsmällisiä arvoja/sijainteja sen jälkeen samaa holdoutia vasten tehtävään korjaukseen. Jos case paljastetaan korjaukseen, se on siitä lähtien DEV ja V2 tarvitsee uuden asetteluperheen holdoutiin. Hash-lukitus osoittaa muuttumattomat bitit, ei riippumatonta ihmistarkistusta.

## Julkaisuraja

Tämä aineisto ei anna GO:ta tuotantointegraatioon. Uuden parserin parannus vaatii tämän kokeen lisäksi laajemman luvallisen real-world-aineiston, fyysisen Androidin sekä varsinaisen tarkistus/tallennuspolun testit. Nykyinen paketti on valmis **seuraavan baseline-vertailun aloittamiseen**, ei todiste baseline-PASSista.

## Julkisen arkiston raja

Tämä GitHub-kansio sisältää vain DEV-aineiston. HOLDOUT-vastaukset ja luontiaineisto sijaitsevat erillisessä arvioijan ZIPissä, eivät repoissa. Julkisen manifestin hash lukitsee sen paketoinnin. Toteuttajalle ei luovuteta tätä ZIPiä.

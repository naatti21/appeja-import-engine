# YÖAJO 14 — uusien synteettisten dokumenttiperheiden arviointi

**Rajattu mittaus, ei toteutusmuutos eikä julkaisu-GO.** Lukittu lähtöcommit YÖAJO 13 `99ee1dcfa8540620e6853a18adf42b6236d6774d`; protokolla ennen koeajoa `89d20bd49bbdab27c7d8f79d61ed279c33050f56`.

## Miksi tämä tehdään

YÖAJO 09:n kattavuusportti saavutti aikaisemmalla synteettisellä EVAL-aineistolla 85/85 essential-varoituskattavuuden, mutta 5/20 eli 25 % harmittomista dokumenteista pysähtyi turhaan; laatuportti oli <=10 %. YÖAJO 13 on pelkkä rakenteellisen sarakkeen/kontekstin *aputodiste*, joka ei muuta jäädytettyä tarkistuspäätöstä. Siksi sen 179 Node- ja 72 Chromium-regressiota eivät sellaisinaan todista väärien estojen vähentyneen.

Tässä arvioidaan **jäähdytettyjä** `coverage-gate-v1` (numerokeskeinen lähtötaso) ja `coverage-gate-v2` (tekstilähteiden varoitusportti) uusissa dokumenttiperheissä, samalla YÖAJO 13:n hyväksyntävaltuus tarkistetaan rajaksi nolla. Porttien koodia ei muuteta.

## Menetelmä

`PROTOCOL.md` lukitsi denominattorit ja laatuportit ennen datan pisteyttämistä. `cases.mjs` muodostaa 12 käsin kirjoitettua erilaista synteettistä perhettä, kolme geometriavariaatiota kustakin (36 havaintokuorta, ei oikeita PDF/kuvatiedostoja). Kuusi perhettä on hallinnollisia benign-only-kuoria ja kuusi sisältää sitomattomia taloudellisesti merkityksellisiä tietoja. Kaikissa on erillinen parseria simuloiva, lähde-ID:llä varmennettu yksittäinen arvo, jotta testataan *kattavuusportin* käyttäytymistä eikä parserin onnistumista.

Jokaiselle tokenille asetetaan testin luonnin yhteydessä eksplisiittinen `linked`, `essential` tai `nuisance` -annotaatio. Numerolliset hallinnolliset tunnisteet, juridiset viitteet, kansilehdet, vanhenemiskuvaukset ja rahalliset huomautukset eivät automaattisesti ole sama asia. Huomautusten merkitys on **testin tekijän laatima oraakkeli**, ei toiselta asiantuntijalta saatu riippumaton totuus.

Raportoidaan molemmille portille essential-varoitusten tarkka recall (täsmälliset lähde-ID:t), nuisance-varoitusten FPR ja benign-only dokumenttien väärä pysäytysaste. Perhekohtaiset mittarit erikseen. Kaikki lähteet on voitava yksilöidä; fake source IDs, mutaatiot tai persistoituminen ovat mittausvirheitä. Kaikki tavoiterajat pidetään lukittuina: essential=100 %, nuisance <=10 %, benign-document <=10 %.

## Toisto ja todennettavuus

```sh
npm ci
node --test tests/new-family-eval-research.test.mjs
node research/new-family-eval-v1/evaluate.mjs qa-yoajo14-results.json
npm test
```

Uusi GitHub workflow `yoajo14.yml` ajaa kohdennetun testin tarkalla PR:n koodilla ja tallentaa täydet `results.json`, tiivistetyn tuloslokin sekä SHA-256- ja HEAD-manifestit **14 päiväksi**. Laatuporttien laskennallinen epäonnistuminen on tarkoituksella merkitty **advisory FAIL** (workflow voi jäädä vihreäksi). Sen tilaa ei tulkita GO:ksi.

## Tulkintarajat

Tämä uusi rakenneperhejoukko on kehittäjän kirjoittama ja sisältää synteettisiä *lähdehavaintokuoria*, ei oikeaa PDF.js/PDF- tai kuva-OCR-lukua eikä erillistä annotointiryhmää. Kolme versiota per perhe eivät ole kolme riippumatonta rakennetta. Benign-only-stubissa lähdekenttä on jo määritelty; oikean Palkan ja Osakevahdin vaadittujen ydinkenttien oikeellisuutta tai dokumenttityyppiä ei mitata. Tuloksia ei saa yleistää luonnollisiin asiakirjoihin tai tuotannon hyväksymistodennäköisyyteen.

YÖAJO 13:n `scopeSupported` ei ole benign-luokittelija eikä suorita automaattisia roolipäätöksiä. Sitä ei saa raportoida väärän pysäytysasteen parannuksena. Ihmiskorjausaikaa, Androidia, offlinea, paikallista PDF/kuva-OCR-uusajoa ja ulkoista riippumatonta QA:ta **ei ajeta tässä kokeessa**.

Ei `src/`- eikä demo-muutoksia; ei muutoksia Palkkaan, Osakevahtiin, aiempaan HOLDOUTiin, aiempaan YÖAJO 09 EVALiin tai niiden kirjattuihin tuloksiin. Ei mergeriä, tuotantointegraatiota eikä tallennusoikeutta.

**Päätös riippuu mittauksesta**, ei testien lukumäärästä. Jos kriittinen benign-document-laatuportti jää FAILiksi, seuraava rajattu toteutus kannattaa kohdistaa todistettuun, tarkkarajaiseen metadata-/asiayhteysluokitteluun ja myöhemmin oikeasti riippumattomaan arvioijaan uudella aineistolla.

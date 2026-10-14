# YÖAJO 07 — lukittu HOLDOUT-vertailu

**GO jatkotutkimukseen E:n rakenteelliselle varovaisuudelle. Kummankaan kandidaatin palkkatulkinta ei ole käyttökelpoinen ilman merkittävää jatkotyötä. Ei tuotantohyväksyntää.**

|Mittari|D|E|
|---|---:|---:|
|Oikea verified-palkkaydin lähde- ja otsikkoalueineen|1/10|1/10|
|Verified-palkkaytimen precision|1/1|1/1|
|Väärät verified-ydinkentät|0/1|0/1|
|Oikeat arvioitavat varmat solusidokset|24/32|24/24|
|Väärät varmat solusidokset|8/32|0/24|
|Varmojen sidosten recall|24/75|24/75|
|GT:llä arvioimattomat varmat ehdotukset|1|0|
|Puhtaat kokonaiset rivitietueet|6/12|8/12|
|Toisiin tietueisiin sekoittuneet recordit|0/12|0/12|
|Säilyneet alkuperäiset havainnot|177/177|177/177|
|Raakateksti tunnetuilla essential-GT-alueilla|75/75|75/75|
|Olennaiset kentät joilla verified/payline-lähdeviite|1/75|1/75|
|Tunnistamatta mutta kohdistetusti varoitetut|33/75|33/75|
|Ilman tunnistusta tai kohdistettua varoitusta|41/75|41/75|
|Vaaralliset candidate-ready-päätökset|0/6|0/6|
|Review-required|6/6|6/6|
|GT:n mukaan turhat tarkistuspyynnöt|1/3 palkkadokumenttia|1/3 palkkadokumenttia|
|Vieraat domainit estetty|3/3|3/3|

Palkkasemantiikan 10 tunnetun kentän lisäksi on yksi annotoitu ristiriita ja yksi monitulkintainen ydinkenttä. Molemmat kandidaatit jättävät nämä missing-tilaan: väärää varmaa valintaa ei synny, mutta ristiriitaa ja monitulkintaisuutta ei tunnisteta niiden omilla tiloilla (0/1 kumpikin). Yhdeksän kymmenestä tunnetusta ydinkentästä jää missing-tilaan. Aidosti puuttuvaksi annotoituja ydinkenttiä ei ole: missing→0-koe NOT AVAILABLE, ei väitetä läpäisyä.

E:n primary-epävarmoja ehdotuksia on 14, joista 12 GT:llä arvioitavaa ja 0/12 oikeaa tarkkana label/value-sidoksena; loput 2 eivät ole tällä sidossopimuksella arvioitavissa. D:llä yksi epävarma moniriviehdotus, ei arvioitavaa arvosidosta. E:n 45 sarakehypoteesista 44 arvioitavaa: 43/44 oikein, 1/44 väärin; yksi arvioimaton. Kaikki 45 pysyvät uncertain-tilassa. Näitä ei lasketa varmiksi onnistumisiksi. E:n 59 epävarmaa primary/sarake-ehdotusta voi kuormittaa tarkistusmallia; käyttäjän työaikaa ei mitattu.

## Tulkinta

D yleistyi osittain rakenteeseen, mutta tuotti kahdeksan väärää varmaa sidosta. E:n suurin onnistuminen oli tämän väärän varmuuden poistuminen ilman varman recallin menetystä; record-eheys parani kahdella. Kaikki kahdeksan D:n virhesidosta säilyvät E:ssä epävarmoina samoine lähteineen. E:stä ei löytynyt uusia vääriä varmoja sidoksia tai vaarallista hyväksyntää. Uusi väärä epävarma sarakehypoteesi osoittaa, ettei taulukkorajojen tulkinta ole valmis.

E:n vaarallisin jäljelle jäävä riski on yhteisen kattavuusportin katve: huomattava osa olennaisista tiedoista jää ilman paikallista ilmoitusta. Tämä on latentti hyväksyntäriski, ei tässä ajossa havaittu väärä hyväksyntä. Kaikki kuusi pysähtyvät, joten turvallinen kieltäytyminen ei tee sovelluksesta käyttökelpoista. CanPersist=false ei ole turvallisuustodiste.

Oikeita varmoja sidoksia ei muuttunut epävarmaksi nettomittarissa: molemmilla samat 24 oikein sidottua GT-kenttää. E:n kahdeksan korjausta kohdistuvat D:n virheisiin; tuntemattomassa aineistossa varman recallin heikkenemistä ei tässä nähty. Molemmilta puuttuu silti 51/75 varmaa olennaista sidosta. Rinnakkais-/monirivi-/jatkotaulukkotapaukset ja kenttäkohtaiset todisteet ovat yksityisessä raportissa. Record-mittari vaatii yhden rivin eikä mittaa täydellistä record-graafia; sivujatkosgraafi NOT SUPPORTED.

## Luotettavuus ja päätös

Ennakkoon lukitut GO-portit täyttyvät E:n jatkotutkimukselle: ei uusia verified/certain-virheitä, ei recallin tai record-eheyden heikkenemistä, kaikki lähteet säilyvät, epävarma ei muutu varmaksi, HOLDOUT-hyöty on mitattu. Tämä ei tee kokonaismoottorista valmista. Palkkaydin 10/11 DEV:ssä vs 1/10 HOLDOUTissa on voimakas vastanäyttö laajalle semanttiselle yleistymiselle; ei todista yksin, että E:n rakenne olisi ylisovitettu. Sanasto/domainreititys on molemmilla sama.

Seuraavan rajatun tutkimuksen perustelluin kohde on **kattavuusportti**, rinnalla käyttäjän tarkistusmallin suunnittelu. Pelkän rakenneprecisionin parantaminen ei korjaa 41/75 ilmoittamatta jäävää havaintoa. Rakennekerroksen jatkotyö kannattaa rajata taulukon rajaan ja monirivisiin recordeihin. Tätä vaihetta ei aloitettu.

Kuusi synteettistä dokumenttia riittää havaitun virheluokan ja seuraavan rajatun kokeen valintaan, ei tuotantolaadun, virheettömyyden tai luonnollisten asiakirjojen kattavuuden todistamiseen.

## Menettely ja ympäristö

HOLDOUT-ZIPin SHA-256 täsmäsi ennen purkua. Harness ja kriteerit SHA-256-lukittiin ennen PDF:ien/annotaatioiden avaamista. Parseriprosessi sai vain PDF-hakemiston. Kaikki 12 outputia jäädytettiin tarkisteineen ennen annotaatioiden purkua. Erillinen arviointiprosessi varmisti tarkisteet. Lukittua arviointikoodia tai kandidaatteja ei muutettu tulosten perusteella.

D:n ja E:n alkuperäiset DEV-outputit toistuivat: D täsmälleen 6/6; molemmat 10/11, D 26/33, E 26/26. Vanha regressio-ohjelma 32/32. Nämä eivät lisää HOLDOUT-denominaattoreita.

Node 24.19.0 / PDF.js 6.4.299; alkuperäinen standard build ja readPdfWithPdfJs. Lukijassa standardFontDataUrl-varoituksia; sama ketju molemmilla, teksti 75/75 GT-alueilla. Yhden ajon rakenneaika D noin 2.40 ms, E 4.06 ms; semantiikka D 4.69 ms, E 2.51 ms. Järjestys aina D→E, JIT/GC-vaikutukset erottamatta. Prosessin RSS-näytteet noin 67.8–75.0 MiB; ei peak eikä variantin oma lisämuisti. Luvuista ei päätellä Android-nopeutta.

Chromiumia ei ollut saatavilla system-PATHissa tai tunnetussa Playwright-cache:ssa. Aiemmat lataukset epäonnistuivat, uutta latauskierrettä ei aloitettu. Selain/Android NOT RUN. Suuren dokumentin skaala ja käyttäjän korjausaika NOT MEASURED.

Aineiston loi aikaisempi ChatGPT Work-agenttityö YÖAJO 03:ssa; se on synteettinen eikä riippumattoman kolmannen osapuolen aineisto. Kehitysraportit sanovat HOLDOUTin jääneen käyttämättä, mutta täydellistä altistushistoriaa ei voida todistaa. Nykyinen arvioija on ChatGPT/Codex samassa työtilassa, jossa on aiemman luontityön jäänteitä. Niitä ei luettu. Menettelyllinen parseri/GT-erotus toteutui; mahdollista aiempaa ennakkotietoa ei voi sulkea absoluuttisesti pois. Tulosta ei kutsuta täysin riippumattomaksi QA:ksi.

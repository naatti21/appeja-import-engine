# LAB v1.3 — PDF/OCR-sijaintitiedon omistusriviehdokkaat

## Mitä oikeasti rakennetaan?

`src/positioned-holdings.mjs` lukee yhdenmukaistetut sijaintihavainnot (PDF.js tai jo tehty OCR) ja palauttaa **ainoastaan esitäytettäviä ja tarkistettavia kenttäehdokkaita**. Samoja kenttiä voi kokeilla `demo/review.html`-näkymässä. Sovellus ei lähetä tiedostoja palvelimelle eikä tallenna taloudellisia tietoja; `canPersist:false` aina.

- Otsakkeet: `row_id, account, name, currency, quantity, current_price, current_value, purchase_price`, suomeksi, englanniksi ja ruotsiksi.
- Tunnistaa sarakkeet header-tekstin ja todellisen x-sijainnin perusteella; riveissä käytetään samalla sivulla sijaitsevia y-koordinaatteja.
- Jokainen kenttä säilyttää `raw`, `value`, `status` ja yksittäisten havaintojen `sourceIds`-viitteet. Tuntemattomia osakekoodeja tai ostohintoja ei täytetä keksimällä.
- Esteitä: puuttuvat kentät tai otsakkeet, tuntemattomat otsakkeet, duplikaattiotsakkeet, tuntemattomat rahahavainnot, numeron lukemisen epäselvyys, määrän 0/negatiivisuus, määrä × nykykurssi ≠ nykyarvo, saman niminen omistus samalla tilillä kahdesti, väärä geometria ja rikkinäinen lähdeviite.
- Eri tilit pidetään erillisinä; saman instrumentin ja tilin mahdollinen toisto jää kahdeksi näkyväksi riviksi ja vaatii tarkistuksen.
- Headerin `Hankintahinta` kertoo sarakkeen tehtävän; nykyarvoa tai nykykurssia ei koskaan kopioida hankintahinnaksi.

## Todellinen QA-portti

`tests/positioned-holdings.test.mjs` tarkistaa lähdeviitteitä, eri sarakejärjestyksiä, ääriarvoja, kaksitili- ja toistorivejä sekä suomen/ruotsin otsakkeita.

`tests/e2e/qa-v13-native-corpus.spec.mjs` käyttää QA-agentin alkuperäistä itsenäistä oraakkelia ja 60 tuoreeltaan generoitua **aitoa natiivia PDF-tiedostoa**. PDF.js tekee tekstihavainnot, sitten sijaintirivin yhdistämisen on läpäistävä kenttäkohtainen vertailu. Kaikilla riveillä ja kaikissa tilanteissa tarkistetaan `canPersist=false` ja oikeat lähde-ID:t. 12 variaatioperheessä virhetilanteiden pitää näkyä estokoodeina. Testi käynnistetään `QA_CORPUS_READY=1` -portin kautta generointityönkulussa, ei tavallisissa selaintesteissä, kun korpusta ei ole saatavilla.

**Rajaus**: OCR-havainnoista syntyvien rivien sovitin ja käyttöliittymä on toteutettu, mutta tässä QA-vaiheessa 60 tiedoston todellinen lukukoe koskee **PDF:ää**, ei vielä kaikkia 60 PNG/JPG-kuvaa. Aiempi LAB v1.2 todisti 16 oikean kuvan OCR-tekstin luennan, ei rivisidontaa. Kaikissa LAB v1.3 -ehdokkaissa vaaditaan ihmisen tarkistus; vihreä testi ei ole itsenäinen tuotantohyväksyntä.

## Yksityisyys ja jakelu

- Alkuperäistä palkka- ja pankkiaineistoa EI ladata julkiseen GitHubiin.
- Kokonaan keksitty QA-korpus generoituna Actions-artefakti-ZIPiin, ei Git-historiaan.
- Oma OCR-build Tesseract.js/WASM/fi+en on v1.2:ssa toteutettu ja toimii CI:ssä saman palvelimen kautta. Mobiilijakelu ja riippumaton tietoturvakatselmointi eivät ole valmiit.
- LAB v1.3 Draft, ei mergeä, deployta eikä muutoksia Palkan tai Osakevahdin tuotantosovelluksiin.

**Tuotanto NO-GO**, kunnes täydet todelliset kuva→OCR→sijainti→salkku-testit on erikseen läpäisty ja virheet korjattu.

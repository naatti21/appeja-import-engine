# Import Engine LAB v0.8 — moni­muotoinen havaintokerros

## Tavoite ja rajaus

Palkkalaskelmat ovat **yksi käyttötilanne**, eivät yhteisen moottorin malli. Uusi rajapinta `src/import-observations.mjs` erottaa syötetiedoston lukemisen kenttien tulkinnasta. Tuontia ei voi tässä vaiheessa tallentaa automaattisesti (`canPersist: false`).

| Syöte | Lukutapa | Mitä testi todella osoittaa? | Mitä ei osoita? |
|---|---|---|---|
| CSV / TSV / TXT | LAB `parseDelimited` | aidot solut, rivit ja sarakkeet; sama salkku kuin XLSX:ssä | jokaista välittäjän omaa vientimuotoa |
| Excel XLSX | oma varovainen OOXML ZIP/DEFLATE -lukija | oikeat pakatut .xlsx-tavut, monivälilehdet, yhteiset merkkijonot, numeeriset solut, osoitteet; kenttäpariteetti CSV:hen | kaikkia Excel-toimintoja, kaavojen laskentaa, päivätyylejä, yhdistettyjä soluja |
| PDF | olemassa oleva oikea PDF.js Chromiumissa | native-PDF:n tekstihavaintojen järjestys ja geometria säilyvät | kaikista PDF:istä luotettava osakesalkkutaulukko; skannattu PDF |
| Kuvakaappauksen OCR | Tesseract-tyylinen TSV-sanarakenne | jo tunnistetut sanat, sijainti ja confidence säilyvät | itse pikseli-OCR:n oikeellisuus, kuvan kuvaaminen/osakesalkun varma tulkinta |
| Google Sheets | ei suoraa integraatiota vielä | CSV-vienti tai kopiointi voidaan jo käsitellä | käyttäjän Drive-lupaa, live-synkronointia |

### Turvarajat

1. **Jokainen havainto säilyy erillisenä**: `id`, `raw`, `source.format`, rivit ja sarakkeet, PDF-sivu ja laatikko tai OCR-koordinaatit.
2. **Yhtään määrää, hintaa tai valuuttaa ei keksitä.** OCR-confidence ei vastaa semanttista varmuutta.
3. **XLSX:n pakkausrajat**: enintään 300 osaa, 5 MiB per osa, 15 MiB yhteensä, CRC32-tarkistus, ei salattuja ZIP-osia, makroja tai ulkoisia linkkejä. Tuntemattomat rakenteet estävät tai vaativat tarkistuksen.
4. **Kaavat, päivä/tyylimuotoilut ja yhdistetyt solut** merkitään tarkistusta vaativiksi. Näytetyt kaavan välimuistiarvot eivät ole vahvistettua dataa.
5. **Excelin tyhjät solut** säilyvät kohdistettavina puuttuvina paikkoina, eivät nollina. XLSX-numeroiden raaka arvo on merkkijono, joten desimaalilukua ei pyöristetä taustalla käyttäjän huomaamatta.
6. **Sovelluskohtainen tulkinta jää erilleen.** LABin `parseHoldingsCsv()` voidaan ajaa Excelistä luodulla taulukolla, mutta se ei automaattisesti todista kaikkia Osakevahdin kenttiä. Palkan parseria ei muuteta.
7. **Ei tuotantointegraatiota, ei käyttäjän tiedostoja, ei maksullisia AI-API-kutsuja.** Erityisesti kuvia ei lähetetä ulkopuoliselle OCR-palvelulle.

### Laadullinen hyväksyntä

- Kompressoitu oikea XLSX käsitellään sekä Nodessa että Chromiumissa ja kaksi osakeriviä täsmäävät CSV:stä luettuihin riveihin.
- Kaavallinen solu ja rikkinäinen ZIP eivät saa hiljaista hyväksyntää.
- Native PDF luetaan oikean PDF.js:n kautta, ja alkuperäinen sivu sekä sijainti löytyvät havainnoista.
- OCR-TSV on **vain jo tehdyn kuvantunnistuksen jälkikäsittelyn testi**, ei todiste pikseleistä tapahtuvasta OCR-luennasta.
- Nykyinen Palkan 83/83 ja Chromiumin 60/60 regression suite pitää säilyä vihreänä.

### Seuraava näyttöportti

1. Todellinen offline-**kuvasta-OCR**-koe mobiilin kokoisella synteettisellä kuvakaappauksella.
2. Taulukon rakenteen palautus myös PDF:n ja OCR:n soluhavainnoista sekä tuntemattoman sarakkeen estot.
3. Käyttäjälle tarkistusnäkymä: lähde näkyvillä jokaiselle kentälle, korjaus tehdään vasta ehdotusvaiheessa.
4. Myöhemmin Sheets-lupa rajatusti, ei Drive-sisältöjen yleistä käyttöoikeutta.

**Tuotanto NO-GO; riippumaton QA ja fyysinen Android tekemättä.**

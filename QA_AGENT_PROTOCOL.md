# LAB QA - automaattinen variaatiogeneraattori (v1.1)

## Mitä agentti oikeasti tekee?

Tämä on **GitHub Actions -pohjainen automaattinen QA-ajuri**, ei itsenäinen tekoälymalli eikä riippumaton ihmistestaaja. Se generoi determinististä kokonaan keksittyä testidataa, ajaa tunnetun totuusarvon vertailut ja pysäyttää buildin virheeseen.

**Älä kutsu testivihreää tuotantohyväksynnäksi.** Ei muutoksia Palkan tai Osakevahdin tuotantorepoihin, ei mergeä, ei deployta, ei alkuperäisiä pankki- tai palkkatietoja CI:hin.

## Testitasot

1. **CSV/TSV**: satunnaistetut mutta vakioidut sarakejärjestykset, tunnetut otsikkosynonyymit, pilkut/puolipisteet/tabit, lainatut nimet, skandinaaviset merkit, rivinvaihdot, BOM, 1–3 fiktiivistä omistusta. Odotettu instrumentti, kappalemäärä, hankintahinta, valuutta ja tilin lähde ovat generaattorin **itsenäinen oracle**; ei toisen parserin palauttama tulos.
2. **Vastatestit**: puuttuva/epäselvä hankintahinta, nolla-/negatiivinen määrä, puuttuva/vääränmuotoinen valuutta, tuplaotsikko, täytetty tuntematon sarake, väärä CSV-leveys ja rikkoutunut lainaus. Nämä **eivät saa** muuttua hyväksytyiksi ehdokkaiksi.
3. **Oikeat pakatut XLSX-tavut**: samalla oracle-aineistolla vaihtelevat solut, sarakejärjestykset, pakkaamaton/pakattu ZIP ja tarkoituksellinen tiedostokorruptio. Tarkistetaan solun sijainti sekä kaikki kentät ennalta tiedettyä totuutta vasten, ei pelkästään CSV-parserien keskinäistä yhdenmukaisuutta.
4. **OCR:n jälkikäsittely**: generoidut Tesseract-tyyliset TSV-sanat, sijainnit ja väärä geometria; kurssin desimaalipilkun häviäminen testataan määrä × nykykurssi ≠ markkina-arvo -ristiriidalla. Ei väitettä, että valokuvien pikseleistä olisi saatu nämä luvut.
5. **Aito PDF.js**: generoidaan selaintestin aikana oikeita PDF-tavuja vaihtelevalla palkkapäivällä, brutolla, netolla, YTD:llä, otsikoilla ja etumerkillä. Testejä on puuttuville ja ristiriitaisille vuosikertymille, ylisuurelle netolle, tuntemattomalle rahariville ja puuttuvalle maksupäivälle. Oikeat kentät tulevat generaattorin oraclesta, jokaisen lähdeviitteen pitää löytyä PDF.js-havainnoista.
6. **Mobiilinäkymä**: CSV-esitarkistus 320, 360, 412 ja 768 pikselin leveyksillä; ei vaakasuuntaista koko sivun ylivuotoa eikä tallennuspainiketta.

**Testin laatukriteeri:** tunnettu positiivinen syöte palauttaa täsmälleen tunnetut arvot ja alkuperät; tahallisesti rikottu syöte tuottaa **odotetun estokoodin**; mikään reitti ei anna tietojen tallennuslupaa. Oikean syötteen hylkääminen ja vaarallisen syötteen hyväksyminen raportoidaan erikseen.

## Käynnistys ja toisto

- Aina PR:n asiaankuuluvien tiedostomuutosten jälkeen: `.github/workflows/qa-variations.yml` ja olemassa oleva testityönkulku.
- Vakio: **4 siementä × 120 puhdasta CSV-tapausta ja 10 rikkovaa muunnosta tapausta kohti**, 2 XLSX-pakkaustapaa noin joka neljännelle tapaukselle, OCR:n itsenäiset numeeriset poikkeamat, sekä 3 × 8 × 6 natiivia PDF-skenaariota. Tarkat määrät näkyvät `QA_ORACLE_*` / `QA_NATIVE_PDF` -riveillä.
- Tarkan virheen toistaminen: `QA_SEEDS=43 QA_CASES=81 node --test tests/qa-variants.test.mjs` palauttaa seedin 43 tapaukselle 80 (nollaindeksi). `QA_CASES` rajoittuu 1–1000:een. Testidata ei sisällä oikeita nimiä, arvoja tai tilitietoja.
- `workflow_dispatch` on määritelty, mutta GitHubin manuaalikäynnistys ja mahdollinen tuleva yöajo edellyttävät, että workflow on saatavilla oletushaarassa. Tätä ei yhdistetä oletushaaraan ilman lupaa. **PR-ajot toimivat suoraan Draft-PR:ssä.**
- Virheet ovat fail-closed: PR pidetään Draftina, talletetaan siemen ja estokoodi, toistetaan regressio, korjataan lähdekoodi eikä testin hyväksymisrajaa huijata.
- Puhelintestaus vasta, kun CI, privacy review ja itsenäinen testattava preview ovat kunnossa.

## Tärkeät rajoitukset

Generoidut variaatiot ovat **saman rajatun kieliopin muunnelmia**, eivät tuhansia erilaisten pankkien, palkanlaskentajärjestelmien tai tosielämän asiakirjojen edustavia näytteitä. Vihreä testimatriisi ei todista todellista OCR-tarkkuutta, uuden työnantajan PDF-luettavuutta tai kattavaa mobiilisaavutettavuutta.

Riippumaton QA, oikeiden yksityisten aineistojen hyväksyntätestaus paikallisesti, oikea Tesseract.js-pikselintunnistus ja fyysisen puhelimen testaus: **NOT RUN**. Tuotantointegraatio: **NO-GO**.

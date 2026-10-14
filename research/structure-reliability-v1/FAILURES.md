# Tunnetut virheet ja rajat

## 1. Seitsemän vanhaa sidosta eivät ole ratkaistuja soluja

P02:n kaksi, P03:n kaksi, T01:n kaksi ja T02:n yksi vanha moninumeroisen rivin virhesidos säilyy uncertain-tilassa. Todisteet RESULTS.json failure_dispositions sekä raw/E/*.json structure.cells. Rivi ja lähteet säilyvät, väärä varmuus poistuu. Oikean sarakkeen/gridin tulkinta ei tämän vuoksi ole valmis. Vakavuus: käyttäjän korjaustyö ja kattavuus; ei havaittua verified-virhettä.

## 2. Uusi väärä mutta epävarma sarakehypoteesi P03:ssa

`structure-e.mjs` enrich-osion header-haku löytää lähimmän aiemman monitekstisen rivin x-ankkurin, mutta ei tunnista taulukon loppua luotettavasti. P03 column-13: header `pdf-p2-t17` (EUR) → `pdf-p2-t29` (Ansiot yhteensä -summa). GT:n oikea label on eri yhteenveto-otsikko. Ehdotus on uncertain eikä muuta semantiikkaa tai acceptancea. Todiste raw/E/P03.json ja bindings.column_evaluations. Tämä on yksi väärä 57 arvioitavasta sarakehypoteesista. Vakavuus: ehdotusten laatu/korjaustyö. Myöhempi koe: taulukon päättymisraja ja headerin elinkaari, ei uusi palkkasynonyymi.

## 3. Moniriviset recordit jäävät hajalle

P01 r4, P03 r3 ja T02 i2: kaikki osat säilyvät, mutta eivät yhdessä varmennetussa recordissa. P03:n sarakealueen y-rivitys voi erottaa tuotekuvauksen, summan ja jatkotekstin eri riveiksi. E ei yhdistä ilman riittävää näyttöä. Rivitietue-probe 13/16, ei 16/16. Sivujatkoksia ja yhdistettyjä solugridejä ei toteutettu.

## 4. Tuhaterotusfragmentti voi silti olla kaksi arvoa

Syntaksista ja läheisyydestä ei voi todistaa yleisesti, että `3` ja `456,78` ovat yksi summa eivätkä kaksi eri kenttää. E sallii tämän rajatun rakennesäännön säilyttääkseen jaetun numeron. S12 ja P02 osoittavat valitun tulkinnan toimivan niissä; kaikkien tuntemattomien asettelujen ratkaisevuutta ei väitetä. Tätä tulee käsitellä myöhemmässä HOLDOUT-analyysissä mahdollisena vääränä varmana sidoksena, jos todellinen lähde osoittaa kaksi kenttää.

## 5. Korttien ja sarakkeiden ero on heuristinen

Vähintään kahden monisanaisen otsikon lisäraja estää osan yksisanaisten sarakeheaderien sekoittumisesta kortteihin. Se voi jättää aidon yksisanaisen korttilayoutin tunnistamatta. Toisaalta monisanaiset sarakeotsikot voivat edelleen näyttää korteilta. T03:n toistuva header-sekvenssi on erillinen sääntö ja säilyy.

## 6. Semanttiset rajat säilyvät

P03:n maksupäivä ei ratkea: Maksu kirjataan ei yksin todista paymentDatea. Nettopalkka puuttuu aidosti ja pysyy missing/null. Palkkalajit ovat edelleen 0/9 GT-riviä, koska sanastoa/koodeja ei muutettu. Material-suodattimen tuntemattoman olennaisen datan katve säilyy. Kaikki kuusi dokumenttia review-required; coverage-refusal estää arvioimasta loppukäyttäjän hyväksyntäpolun hyötyä.

## 7. Epävarmuuden käyttöliittymä ja suoritusskaala

16 ensisijaista epävarmaa ehdotusta ja 63 sarakehypoteesia voivat lisätä käyttäjän työtä, jos kaikki näytetään sellaisinaan. Niiden määrä ei ole mitattu korjausaika eikä jokainen hypoteesi tarvitse omaa kysymystä. Hakujen pahimman tapauksen neliöllisyys, sivujen pitäminen muistissa ja ylimääräiset source-ID-listat ovat avoimia suuren dokumentin riskejä.

## 8. Puuttuva ympäristövarmennus ja riippumattomuus

Chromium-asennus exit1: katkennut ZIP / HTTP400 GatewayExceptionResponse; odotettu executable puuttuu. Selainta, Androidia, akkua, todellista peak-muistia tai käyttäjäkorjaustyötä ei mitattu. Benchmark on Node-rakenteen/saman semantiikan suoritusmittaus reader-snapshotista. Sama agentti on aineiston aiempi tekijä; ei riippumatonta yleistymisnäyttöä tai ihmisvalidointia. HOLDOUTia ei avattu.

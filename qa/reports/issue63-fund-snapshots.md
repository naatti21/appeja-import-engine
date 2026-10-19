# Issue #63 — paikalliset rahastosnapshot-havainnot

Tila: kehittäjän rajattu tutkimustoteutus; riippumaton Work-auditointi ja fyysinen Android-testi tekemättä. Ei julkaisu- tai integraatiolupaa. #55 pysyy avoimena.

Lähtö: PR #60, `98f5b569fd2f95c191248ea5134d91090d24f4f3`. Haara: `feature/issue63-fund-snapshots`. Tarkka testattu toimitus-SHA kirjataan CI-artifaktin `tested-sha.txt`-tiedostoon ja ulkoiseen QA-handoffiin; raportti ei väitä omaa myöhemmin syntyvää commit-tunnustaan etukäteen.

## Toteutuksen rajaus

- Kaksi täysin keksittyä, selkeästi merkittyä rakenneanalogiaa: tiivis yhden rahaston lista (kaksirivinen nimi, nykyarvo, sen alla kokonaisosuudet yhden desimaalin tarkkuudella, GAV puuttuu) ja viiden rahaston korttinäkymä (kahden desimaalin osuudet, erilliset NAV/GAV-sarakkeet, päivämäärät ja prosentit). Ei pankkien oikeita kuvia, ulkoasujen kopioita, todellisia rahastoja tai käyttäjätietoja.
- `CURRENT_HOLDINGS_SNAPSHOT` edellyttää näkyvää nykyisten omistusten otsikkoa kahdessa geometrisesti yhtäpitävässä OCR-luvussa. Ostokuitti ja tuntematon otsikko jäävät `UNKNOWN_DOCUMENT_ROLE`-tilaan. Erillinen rahastotietokuva saa vain `FUND_DETAILS`-roolin.
- Kenttälabelit, korttialueet ja kahden OCR-luvun geometria sitovat nimen, kokonaisosuudet, nykyarvon, valuutan, NAV:n ja keskihankintahinnan. Kentät ovat `observed`, `missing` tai `ambiguous`. Alkuperäiset tekstit, lähde-ID:t, laatikot, labelien evidenssi ja toinen OCR-havainto säilyvät tilapäisesti. Tiliympäristö säilyy dokumentin lähde-evidenssissä; tilejä ei tunnisteta tai yhdistetä.
- Desimaalimerkkijono ja `displayPrecision` säilyttävät näkyvän tarkkuuden. Ei muunnosta senteiksi, kahdeksan desimaalin näennäistarkkuudeksi tai liukulukuiseen kirjanpitoarvoon. Välilyönti on tuettu tuhaterotin; piste/pilkku ovat tässä rajatussa sopimuksessa desimaalierottimia. Ilman lokaalitodistetta monitulkintaiset `1.234` / `1,234` hylätään; niiden kolmea loppunumeroa ei arvata desimaaleiksi tai tuhansiksi. Muiden erotintraditioiden yleispätevää tunnistusta ei väitetä.
- Nimi on **varmentamaton havainto**, ei instrumentti. `candidates:[]`, `marketIdentityVerified:false`, `requiresReview:true`, `canPersist:false`. Uusi sopimus ei kelpaa vanhan listing-portin vahvistetuksi tarkistussessioksi. Ei resolveria, verkkohakua, profiilioppimista tai tallennuspolkua.
- Puuttuvaa GAV:ta ei lasketa määrästä, arvosta tai NAV:sta. Vain rakenteellisesti ehjälle havainnolle tarjotaan **Täydennä / Myöhemmin**. Erillinen tietokuva luetaan paikallisesti; käyttäjä kohdistaa sen itse ja vahvistaa erillisen havainnon. Eri valuutan hintaa ei kopioida. Alkuperäinen puuttuva GAV ei muutu OCR-havainnoksi. Myöhemmin ei vahvista mitään. Peruutus/uusi tiedosto tyhjentää luonnoksen ja estää myöhäiset OCR-tulokset.
- Dokumentit pysyvät erillisinä. Sama objekti voidaan jättää toistamatta, mutta samannimisiä rahastoja tai identtisen näköisiä eri kuvia ei yhdistetä automaattisesti. Ei määrädeltaa, lisäystä, korvausta eikä poistamista; `actions:[]`, `coverage:PARTIAL_OR_UNKNOWN`.
- Uusi paikallinen tutkimussivu `demo/fund-snapshot-review.html` ei ole nykyisen LAB-julkaisun HTML-allowlistalla. Ei muutoksia julkaisu-workflow'hun, Palkkaan tai Osakevahtiin.

## RED ja korjauksen peruste

Alkuperäinen testisopimus epäonnistui puuttuvaan moduuliin. Ensimmäinen aito kahden kuvan PNG/OCR-vertailu osoitti vanhan yleisen kuvatulkitsimen tuottavan 0 ehdokasta näistä kuudesta fiktiivisestä rahastosta. Tämä ei tarkoita vanhan parserin yleistä 0 % tarkkuutta.

Lisäksi siirrettyä korttihintaa koskeva vastatesti todisti ensimmäisen uuden toteutuksen vaaran: samassa kenttäalueessa kahdesta luvusta valittiin ensimmäinen. Kontrolloidusti tarkistusta edeltävällä toteutuksella testi FAIL; kilpailevien lukujen tarkistuksella PASS. Nyt tällainen kenttä on `ambiguous / MULTIPLE_VALUES_IN_FIELD_REGION`. Puuttuvan kortin hintaa ei lainata naapurista. NAV/GAV-sarakkeiden järjestys voi vaihtua, koska tulkinta seuraa lähteen labeleita, ei kovakoodattua vasen/oikea-asemaa.

Jäädytettyjä #55:n orakkeleita ja vanhoja testejä ei muutettu. `Growth bucket` voi edelleen esiintyä raakana tekstihavaintona; uusi polku ei nosta sitä automaattisesti instrumentiksi. Tämä ei korjaa eikä piilota vanhan raakapoiminnan #55-virhettä.

## Mittaus ja rajat

Kaksi peruskuvaa kulkee aidosti PNG → paikallinen Tesseract 5.1.0 (`fin+eng`, sitten `eng`) → moduuli → paikallinen UI. Molemmat kuvat luetaan myös UI:n tiedostovalinnasta kaikilla leveyksillä 320/360/393. Erillinen GAV-tietokuva kulkee saman OCR-ketjun kautta ennen käyttäjän valintaa.

Ensimmäiset fokusajot: 6/6 nimiriviä ja 22/22 näkyvää numeerista kenttää täsmälleen oikein, 0 väärää numeerista kohdistusta, 0 tunnistamatta jätettyä perusriviä. Puuttuva GAV 1/1 pysyi puuttuvana; sitä koskeva kysymys 1 per tiivis kuva, korttikuvassa 0. Näkyvät määrät säilyivät 1/2 desimaalilla, hinnat 4 desimaalilla. **Ulkoisesti varmennettuja instrumentteja 0/6.** Nämä ovat kuuden fiktiivisen rivin tuloksia, eivät pankkien kuvien tunnistustarkkuusarvio.

Peruskuvien näkyvät kentät vaativat testeissä 0 korjausta. Puuttuvan GAV:n täydentäminen on 1 erillinen käyttäjähavainto (tai 0, jos valitaan Myöhemmin). Yhden luonnoksen sisällä samaa täydennystä ei kysytä uudelleen. Kuukausien välisen toiston vähenemistä **ei ole mitattu tai toteutettu**: turvallinen tili-/instrumenttiyhdistäminen ja aiempien kustannustietojen käyttö kuuluvat myöhempään sovellusadapteriin. Aikasäästö: **NOT MEASURED**. Tuottoa ei lasketa puutteellisilla kustannustiedoilla.

Työpuun koko sarjan ajo: Node **286 PASS / 26 FAIL / 0 SKIP**, Chromium **121 PASS / 16 FAIL / 0 SKIP**. Uudet 16 Node- ja 7 Chromium-testiä läpäisivät. Kohdennettu Node + muuttumattomat turvallisuusportit: **47 PASS**. Toimituscommitin uusinta-ajo ja virhenimien vertailu kirjataan toimitushandoffiin. Lähtöcommitin todellinen laajennettu baseline oli Node 270 PASS / 26 FAIL ja Chromium `REAL_OCR_QA=1 QA_CORPUS_READY=1` 114 PASS / 16 FAIL / 0 SKIP. Issuessa mainittu 3 Chromium-virheen otos ei kata tätä laajennettua OCR-ajoa. Uusi CI pitää jäädytettyjen virheiden jobin aidosti punaisena eikä muunna niitä odotetuiksi onnistumisiksi.

## Jäljellä olevat riskit ja Workin tarkistus

- Molemmat OCR-lukijat käyttävät samaa Tesseract-perhettä. Yhtäpitävä väärä teksti on mahdollinen. Niiden yhtäpitävyys ei ole semanttinen instrumenttivarmennus.
- Tulkinta on tarkoituksella rajattu eksplisiittisesti labeloituihin kortteihin. Aitojen Nordean/Nordnetin kuvien labelit, muut koot, huonot kontrastit, leikkautuneet kuvat ja useamman palstan korttiverkot eivät ole osoitettuja yhteensopivuuksia. Tuntematon rakenne jää tarkistettavaksi.
- Lähteeseen itsessään väärin kirjattua hintaa tai käyttäjän väärään rahastoon kohdistamaa erillistä tietokuvaa ei voida todistaa oikeaksi tästä evidenssistä. Käyttäjän vahvistus ei tee instrumentista varmennettua.
- Ei tilien/instrumenttien markkinavarmennusta, olemassa olevan salkun yhdistämistä, monen kuvan automaattista deduplikointia tai kuukausittaista muistamista. Dokumentteja ei litistetä tallennettavaksi omistuslistaksi.
- Fyysinen Android, alkuperäiset yksityiset pankkikuvat ja riippumaton Work-auditointi: **NOT RUN**. Oikeita kuvia ei saa lisätä julkisiin fixtureihin/artifakteihin.
- **NO-GO julkaisuun, integraatioon ja automaattiseen tallennukseen.** Seuraava portti on Workin riippumaton auditointi täsmälliselle toimitus-SHA:lle; käyttäjän hyväksyntä tarvitaan myöhemmälle kokeilulle/julkaisulle.

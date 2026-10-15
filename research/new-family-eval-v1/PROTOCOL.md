# YÖAJO 14 — uuden dokumenttiperhejoukon arviointiprotokolla

**Ennakkolukitus ennen tapausten suorittamista.** Päivä 2026-10-15. Lähtö: YÖAJO 13 täysi commit `99ee1dcfa8540620e6853a18adf42b6236d6774d`. Ei tuotanto- eikä yhdistämislupaa.

## Täsmällinen kysymys

Kuinka paljon jäädytetty kattavuusportti (YÖAJO 09 v2, `research/coverage-gate-v2/gate.mjs`) aiheuttaa turhia *lähdekohtaisia* hälytyksiä ja turhia *kokonaisten asiakirjojen* tarkistuspyyntöjä uusissa, aiemmasta testiperheestä poikkeavissa dokumenttirakenteissa? Löytyykö olennaisia aineistolähteitä, joita ei varoiteta? Osoittaako YÖAJO 13:n rakenteellinen apukerros hyväksynnän parantumista? **Ei**: se pitää tarkoituksella kaiken review-required-tilassa. Tämä tutkimus ei muuta kandidaattia.

## Lukittu koeasetelma ja nimittäjät

- **12 käsin nimettyä erillistä synteettistä perhettä × 3 determinististä geometriaversiota = 36 aineistoyksikköä.** Niistä 6 perhettä / 18 dokumenttia ovat *benign-only* (kaikki sitomattomat havainnot hallinnollista ei-taloudellista sisältöä) ja 6 perhettä / 18 dokumenttia sisältävät vähintään yhden *essential*-havainnon (taloudellisesti merkittävä vielä sitomaton arvo tai konteksti). Perheistä raportoidaan erikseen, jotta 36 versioita ei väitetä riippumattomiksi dokumenttiperheiksi.
- Jokaiseen testiasetelmaan kuuluu yksi erikseen merkitty ja lähteeseen sidottu **stub-arvo**, jonka tekstisisältö vastaa parserin oletettua arvoa. Tämä on kattavuusportin eristämiseen tehty vertailutilanne, **ei** aidon palkka-/salkkuparserin oikeellisuustodiste. Portille syötetty alkuperäinen tila on `candidate-ready` vain kokeellisessa stubissa; tuotannon hyväksyntä on muu mekanismi.
- Jokainen muu lähdehavainto luokitellaan **ennalta** `essential` tai `nuisance`, tarkalla sourceId:llä. Kokonainen dokumentti on `benign-only` jos yhtään essentialia ei ole. Tapausten valinta/annotointi ei perustu portin jälkikäteen antamiin tuloksiin.
- Ensisijaiset mittarit: `essentialRecall = essentialWarned / essentialCount`; `nuisanceFPR = nuisanceWarned / nuisanceCount`; `benignDocumentFalseBlock = benignDocsWithGateReview / benignDocs`. Lähdevaroitukseksi hyväksytään vain täsmällinen ID `newWarnings` tai `existingWarnings`, ei yleinen `review-required`. Duplicated raw arvot eivät yhdisty.
- Lisäksi näytetään family-tasolla virheet, varoitusten kokonaismäärä, 95-prosenttisten väittämien välttäminen pienellä otannalla ja `canPersist`/muuttumattomuus.
- **Ennalta määritelty tutkimuskriteeri**, sama perusvaatimus kuin edellisellä kierroksella: essential-recall 100 %, nuisance-FPR <=10 % ja benign-document false-block <=10 %. Yhtään epäonnistunutta kriteeriä ei saa merkitä hyväksytyksi vihreän CI-statuksen vuoksi.

## Dokumenttiperheet — rakenteeltaan uusia, eivät vanhojen EVAL/HOLDOUT-versioita

Benign-only: (1) työsuhdetodistuksen viiteosa; (2) lakisääteisen ilmoituksen alatunniste; (3) asianhallinnan arkistoseloste; (4) salkkuraportin kansilehti; (5) varaston lähete; (6) tilin saatekirje.

Essential-sisältöä: (7) palkkaoikaisun liite; (8) arvopaperikaupan veloitushuomautus; (9) kulukorvausten asiakirja; (10) monikielinen tiliote; (11) salkun arvostusliite; (12) verotuksen muutosilmoitus. Rakenteissa vaihdellaan otsikon paikkaa, kappalemuotoista tekstiä, transaktiorivejä, numerollista metadataa ja dokumentinlaajuisia viitteitä. Keksityt nimet/luvut, ei käyttäjätietoa.

## Rajatut turvallisuustarkastukset

1. Jäädytetyt YÖAJO 09 v2 ja YÖAJO 13 koodit eivät muutu. Testattava YÖAJO 13 on rakenteellinen hypoteesikerros, jonka `canAutoAccept=false` ja `canPersist=false`. Älä kutsu rakenteellista `scopeSupported`-tulosta taloudelliseksi semantiikaksi tai benign-luokitukseksi.
2. Rakennetaan **eri** jälkikoe vain dokumentinlaajuista kontekstia ja etäotsikkoa koskeville annotoiduille lähde-ID:ille; arvioi havainnon näkyvyys, ei taloudellista hyväksyntää. Ei käyttäjän manuaalista työtä tai sovellukseen tallennusta.
3. Kaikkien 36 inputin ja annotaation on säilyttävä muuttumattomana. Kaikki puuttuvat sourceId:t tai laskentakokonaisuuden ristiriidat epäonnistuttavat testin. Kokonaisia dokumentteja ei merkitä virheettömiksi, jos lähteitä jää huomaamatta.
4. Ei uusia whitelist-poikkeuksia, tunnistusheuristiikkojen säätöä tai vanhan Y09 EVAL / Y07 HOLDOUT aineiston avaamista. Jos uudet tulokset epäonnistuvat, päätös on REVISE / uusi tutkimus, ei takautuva kynnysmuutos.

## Riippumattomuus, ympäristö ja stop

**Tämän kierroksen data ja mittari ovat saman kehittäjäagentin suunnittelemia**, vaikka dokumenttiperheet poikkeavat aiemmista. Tämä ei ole riippumattoman arvioijan sokea HOLDOUT, oikea PDF/OCR-aineisto, käyttäjätesti eikä luonnollisten asiakirjojen edustava otos. Tulokset ovat validointia tämän kapean joukon sisällä; ulkoinen arviointi merkitään **NOT RUN**.

Lukitse tämä protokolla omalla commitilla ennen koeajon tietojen tai pisteytystulosten tuottamista. Uusi testikoodi ja data lisätään vasta sen jälkeen. Aja erillinen mittaus ja koko Node-regressio GitHub Actionsissa; selain vain, jos uutta selainintegraatiota tehdään (ei tehdä). Tarkasta käytetyt SHA:t ja lokit. PR vain Draft. **Ei mergeä, julkaisua, app-adapterimuutoksia tai automaattista tallennusta.** Pysähdy tulosraporttiin ja nimeä toteutussuositus sen perusteella.

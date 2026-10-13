# Tulokset ja johdon arvio

**Teksti luettiin, mutta palkkasemantiikka yleistyi heikosti.** Oikeilla PDF-tavuilla saatiin 7 sivua ja 201 tekstihavaintoa. Kaikki 87 annotoitua raakatekstiä löytyivät oikean sivun tunnetulta lähdealueelta. Neljän ydinkentän läsnä olevista tapauksista oikein arvon, arvoviitteen ja otsikkoviitteen kanssa tunnistui vain P01:n netPay: **1/11 (9,1 %)**. Tämä on näiden kolmen synteettisen palkkalaskelman tulos, ei yleinen tarkkuusarvio.

|Dokumentti|Raakateksti lähdealueella|Ydinkentät, läsnä|Palkkarivit|Päätös|
|---|---:|---:|---:|---|
|P01|26/26|1/4|0|review-required|
|P02|13/13|0/4|0|review-required|
|P03|14/14|0/3|0|review-required|
|T01|13/13|ei sovellu|ei sovellu|review-required|
|T02|14/14|ei sovellu|ei sovellu|review-required|
|T03|7/7|ei sovellu|ei sovellu|review-required|

P03:n aidosti puuttuva netPay säilyi missing/null: **1/1** oikein. Edellisen tilisiirron summaa ei arvattu netoksi. Ainoa verified-kenttä oli oikea: väärät verified-ydinarvot **0/1**, oikea arvo-, otsikko- ja tietueviite **1/1**. Yhden löydetyn kentän perusteella ei voi yleistää precisionia tai lähdeviitteiden turvallisuutta.

## Mittarit ja mittaamatta jääneet asiat

1. **Raw-teksti:** 87/87 (100 %) annotoitua kenttätekstiä löytyi. Vertailu normalisoi whitespacea mutta säilyttää numerot, välimerkit, miinukset ja etunollat. Tämä ei ole koko sivun OCR/CER-arvio: annotoimattomia tekstejä ei pisteytetä.
2. **Lähdesijainti:** 87/87 tunnettuun GT-alueeseen paikannettua tekstiä. Harness käyttää alueen sisällä olevien tokenien keskipisteitä (2 pt x-/3 pt y-toleranssi). Tämä on region-conditioned tekstin löydettävyys, ei itsenäinen solujen tunnistustulos. Väärälle alueelle sijoittumista ei havaittu tässä mittauksessa.
3. **Otsikko–arvo:** vain verified-palkkakentälle 1/1 oikein; kaikkien läsnä olevien ydinkenttien onnistunut arvo+sidonta 1/11. Yleinen solu-/otsikkograafi NOT IMPLEMENTED.
4. **Tietue, merkitys, ajanjakso:** P01 netPay oikein 1/1 löytynyttä. Muiden domainien semantiikka NOT IMPLEMENTED; holdings-adapteri tukee CSV:tä, ei PDF-omistuserittelyä.
5. **Ydinkenttien recall:** 1/11; puuttuvaksi tarkoitetun P03-neton tapaus ei kuulu nimittäjään. Kymmenen läsnä olevaa ydinkenttää jäi missing-tilaan.
6. **Tunnistamattomat havainnot:** alla erillinen lähde-ID-kattavuusauditointi. Ei koko dokumentin semanttinen recall.
7. **Väärät tulkinnat:** 0/1 verified-ydinkenttää väärin; tunnistamattomat arvot ovat recall-ongelmia, eivät vääriksi hyväksyttyjä arvoja.
8. **Ristiriidat:** NOT AVAILABLE — DEV-ground truthissa ei ole yksiselitteisiä ristiriitatapahtumia, joille konfliktirecall voitaisiin laskea. T03:n määrän moniselitteisyys on vieraan adapterittoman domainin tapaus. P01:n toistuvat palkkakoodit eivät tunnistuneet riveiksi; niiden oikeaa käsittelyä ei osoitettu.
9. **Turhat pysäytykset:** P01 ja P02 eivät anna käyttökelpoista hyväksymisehdotusta (0/2 candidate-ready). Niiden pysäytys on kuitenkin nykyiselle puutteelliselle outputille turvallinen, eikä automaattisesti hyväksyntälogiikan virhe. P03:n ja kolmen vieraan dokumentin pysäytys on odotettu.
10. **Vaarallinen hiljainen hyväksyntä:** 0/6 candidate-ready. Vieras dokumenttityyppi estettiin UNKNOWN_DOCUMENT_TYPE-ongelmalla 3/3. canPersist=false on LAB-vakio eikä turvallisuuden todiste. Puutteiden näkyvyys ei ole kattava, vaikka hyväksyntä oli tällä aineistolla varovainen.

|Dokumentti|Verified-kentän/rivin viitteisiin kuulumattomat GT-havainnot|Näistä UNACCOUNTED_MATERIAL-viitteellä näkyvät|Ilman paikallista material-varoitusta|
|---|---:|---:|---:|
|P01|25|15|10|
|P02|13|1|12|
|P03|14|10|4|
|T01|13|3|10|
|T02|14|7|7|
|T03|7|1|6|

RESULTS.json:n `essential_without_candidate_or_specific_unaccounted_notice` tarkoittaa vain viimeistä saraketta. **Se ei tarkoita hiljaisesti hyväksyttyjä tietoja**: esimerkiksi missing-ydinkenttä voi saada erillisen MISSING_FIELD-varoituksen. Auditointi sisältää myös koodeja, kuvauksia ja määriä, joita nykyinen adapteri ei tue. P02:n material-denominaattori on vain yksi observation: coverage-prosentti tästä denominatorista ei kuvaa olennaisten tietojen todellista kattavuutta.

## Rakenne ja juurisyiden jakauma

Reader ei hukannut yhtään näistä 87 tekstistä. P01:n maksupäivän epäonnistumiselle on konkreettinen rakennemittaus: samalla korkeudella oleva Jakso liittyy date-rivin perään. Muissa yhdeksässä epäonnistuneessa ydinkentässä näkyy vähintään tukematon otsikkosanasto/päivämäärämuoto; rakenteen mahdollinen samanaikainen vaikutus ei erotu tällä yhdellä ajolla. Ei siis perusteltua laskea virheille yksikäsitteisiä rakenne-/semantiikkaprosentteja.

T03:n kaksi rinnakkaista taulukkoa liittyvät yhteisiksi y-riveiksi. P01:n monirivinen kuvaus jakautuu eri riveiksi. P03:n sivut ja lähde-ID:t säilyvät, mutta jatkotaulukon solujen/tietueiden yhdistämisgraafia ei tuoteta. Näiden ominaisuuksien automaattista onnistumista ei voi päätellä oikeista numeroista.

## Suositus

A+-alue-/solutulkinnan **rajattu tutkiminen on edelleen perusteltua** P01:n ja T03:n mitatun palstojen sekoittumisen vuoksi. Tulos ei kuitenkaan perustele täyden A+-järjestelmän toteuttamista: useimmat ydinkentät jäävät nykyisen adapterin otsikkosanaston ulkopuolelle myös silloin, kun teksti on oikein.

Yksi seuraava koe: pidä parseri vertailubaselinenä ja kokeile erillisessä kandidaattiharnessissa paikallista otsikko–arvo-paritusta P01:n maksupäivälle. Menestyskriteeri: payDate löytyy oikealla lähdeparilla, Jakso pysyy erillisenä, P03 netPay pysyy missing ja vieraat dokumentit eivät tule candidate-ready. Mittaa lisäksi kaikki neljä ydinkenttää, jotta nähdään, kuinka paljon pelkkä rakenne oikeasti auttaa. Laajempi semantiikkasanaston koe on erillinen vaihe; sitä ei toteutettu tässä.

## Suorituskyky ja ympäristö

RESULTS.json sisältää jokaisen reader-/adapterivaiheen ajan ja prosessin muistinäytteen. Yksi Node-pass, ensimmäinen tiedosto kylmäkäynnistyksellä: ei Android-/selainbenchmark, ei muistihuippu eikä akun mittaus. Paikallinen ajo ei käyttänyt maksullista API:a; dokumenttikohtaista pilvikustannusta ei syntynyt. Käyttäjän korjaustyö NOT RUN: myöhemmin mitataan aktiivinen aika, korjatut kentät ja lähdealueen uudelleenvalinnat samalla tarkistus-UI:lla.

Chromium 143.0.7499.4 / Playwright build 1200 -lataus epäonnistui (truncated ZIP / GatewayExceptionResponse). Playwright 1.57.0 oli asennettu mutta ei ajettu selaimella. Node v24.19.0 / PDF.js 6.4.299:n ensimmäinen ajo kaatui Uint8Array.toHex-puutteeseen kaikilla kuudella tiedostolla. Erillinen standardin toHex-apu ratkaisi tämän ilman parseri-/kirjastomuutosta. PDF.js varoitti Node-standard-buildista ja standardFontDataUrl-asetuksesta; lukupolkua ei muutettu. Selaimen fonttigeometria ja runtime on varmistettava erikseen.

Aineisto on synteettinen ja sama agentti sen aiempi tekijä. Tämä on rajattu toistettava DEV-baseline, ei riippumaton todellisten asiakirjojen validointi.

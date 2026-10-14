# YÖAJO 06 — tulosraportti

**E täytti rajatut DEV-tavoitteet. Väärä varmuus poistui seitsemästä tunnetusta soluehdotuksesta; niiden sisältöä ei kadotettu eikä kaikkia sidoksia ratkaistu.** D toistui kokonaisella layout- ja adapterioutputilla 6/6 täsmälleen YÖAJO 05:n mukaan.

|Mittari|D|E|
|---|---:|---:|
|Oikeat läsnä olevat palkkaydinkentät arvo-/otsikkolähteineen|10/11|10/11|
|GT:llä arvioitavat yksiselitteiset solusidokset oikein|26/33 (78,8 %)|26/26 (100 % tässä joukossa)|
|Väärät yksiselitteiset sidokset|7/33|0/26|
|Varmojen sidosten recall, kaikki olennaiset GT-label–value-sidokset|26/87 (29,9 %)|26/87 (29,9 %)|
|Sidoksen löytyminen myös epävarmoista vaihtoehdoista|26/87|82/87 (94,3 %)|
|Ensisijaiset epävarmat soluehdotukset|0/34|16/42|
|Erilliset sarakehypoteesit|0|63, kaikki epävarmoja|
|T01 kokonaiset, muiden tietueista puhtaat recordit|0/2|2/2|
|T03 rinnakkaiset puhtaat recordit|2/2|2/2|
|P03 nettopalkan puuttuminen oikein|1/1|1/1|
|Alkuperäiset raakahavainnot säilyvät|201/201|201/201|
|Väärät verified-ydinkentät|0/10|0/10|
|Vaaralliset candidate-ready-päätökset|0/6|0/6|

**100 % ei ole koko moottorin tarkkuus.** Denominaattori 26 sisältää vain varmat, annotoiduilla lähteillä arvioitavat sidokset. Recall pysyi ennallaan: 61/87 GT-sidosta jäi yhä ilman varmaa sidosta. E:n 82/87 sisältää 56 epävarmaa uutta vaihtoehtoa; ne eivät ole varmennettuja löydöksiä. D:llä on lisäksi yksi viiva-arvon soluehdotus, jolle GT ei anna sidosta: se on unscored, ei laskettu vääräksi tai oikeaksi. E säilyttää sen epävarmana.

|Dokumentti|Palkkaydin D → E|Varmojen sidosten precision D → E|E epävarmat ensisijaiset|E varma recall|E recall myös hypoteeseista|
|---|---:|---:|---:|---:|---:|
|P01|4/4 → 4/4|8/8 → 8/8|4|8/26|23/26|
|P02|4/4 → 4/4|7/9 → 7/7|2|7/13|13/13|
|P03|2/3 → 2/3|4/6 → 4/4|3|4/14|13/14|
|T01|ei sovellu|1/3 → 1/1|2|1/13|13/13|
|T02|ei sovellu|5/6 → 5/5|3|5/14|13/14|
|T03|ei sovellu|1/1 → 1/1|2|1/7|7/7|

## Seitsemän vanhan virheen kohtalo

P02:n kaksi, P03:n kaksi, T01:n kaksi ja T02:n yksi aiempi väärä solu säilyvät E:ssä eksplisiittisesti uncertain-ehdotuksina: **7/7**. Kaikki niiden alkuperäiset source-ID:t säilyvät. RESULTS.json:n failure_dispositions näyttää D-cell-ID:n, alkuperäiset lähteet ja vastaavan E-ehdotuksen. Tämä on väärän varmuuden korjaus, ei väite, että kaikkien seitsemän oikea solu olisi löydetty.

E:ssä on myös **yksi väärä epävarma sarakehypoteesi 57:stä GT:llä arvioitavasta sarakehypoteesista**: P03:n column-13 liittää Ansiot yhteensä -arvon aiemman taulukon EUR-sarakeotsikkoon. Oikeita epävarmoja sarakehypoteeseja 56/57; 6/63 sarakehypoteesia jää ilman vertailukelpoista GT-sidosta. Väärää ehdotusta ei piilotettu tai nostettu varmaksi. Kaikkien 63 sarakehypoteesin sekä 16 ensisijaisen epävarman ehdotuksen määrä on ylläpitokustannus — käyttäjän korjausaikaa ei mitattu.

## Tietueet ja monirivisyys

T01:n valuutta pysyy kummankin recordin samassa rivissä: 2/2. Sama instrumenttitunnus eri tileillä ei yhdistä recordeja. T03 säilyy 2/2. Kaikkien 16 annotoidun rivitietueen single-row/purity-probe paranee 11/16 → 13/16.

P01:n r4, P03:n r3 ja T02:n i2 jäävät hajalle useaan riviin. Osat säilyvät, mutta täydellinen monirivinen solutulkinta ei toteudu. Sivujatkoksen record-graafia ei ole. P03:n kaksi sivua ja kaikki 40 havaintoa säilyvät; puuttuva netPay ei muutu nollaksi tai edelliseksi tilisiirroksi.

## Turvallisuus ja sovellusraja

D:n ja E:n acceptance-päätökset ongelmalistoineen ovat samat 6/6. Kaikki kuusi dokumenttia pysähtyvät review-required-tilaan; vieraat tyypit estetään 3/3. CanPersist=false pysyy samana eikä sitä lasketa turvallisuustodisteeksi. P01/P02:n hyödyllinen candidate-ready-valmius on edelleen 0/2 kummallakin: ydinkentät eivät riitä, kun olennaiset palkkarivit ovat tuntemattomia. Tämä on turvallinen coverage-refusal, ei automaattisesti väärä hyväksyntäsääntö.

Tuntemattomia palkkarivejä ja material-suodattimen kattavuusaukkoja ei korjattu. Lasku-, varasto- tai PDF-omistussemantiikkaa ei pisteytetä palkkasemantiikan virheiksi. Neljä ydinkenttää arvioidaan vain P01–P03:ssa; foreign-domain-rajaus säilyy.

## Testijoukot erillään

- Alkuperäinen YÖAJO 05:n regressio-ohjelma: 32/32 tarkistusta täyttyy. Vanhaa ohjelmaa tai sen tuloksia ei muutettu; uusi output tallennettiin tähän kansioon.
- Samat kahdeksan vanhaa predikaattia E:lle: 8/8. Ei uusi kahdeksan tapauksen aineisto, vaan vanhan sopimuksen sovellus E:hen.
- Uudet ennen E:tä lukitut rakennetapaukset: D 6/12 ja E 12/12 tapausta täyttää odotukset. In-memory-havaintoja, ei uusia PDF:iä eikä riippumatonta yleistymisnäyttöä. Tapauksen kaikki osatarkistukset näkyvät ADVERSARIAL_RESULTS.json:ssa.

## Runtime ja muisti

Erilliset Node-prosessit D:lle ja E:lle; 20 lämmityskierrosta ja 80 mitattua kierrosta, kullakin kaikki kuusi oikean reader-ajon layoutia. Mitataan clone+rakenne+sama semantiikka, ei PDF-dekoodausta, I/O:ta tai renderöintiä.

|Variantti|Kuuden layoutin erän mediaani, ms|P95, ms|Näytteistetty RSS-maksimi, MiB|GC:n jälkeinen heapUsed, MiB|
|---|---:|---:|---:|---:|
|D|1.755|2.574|56.10|7.32|
|E|2.006|2.611|56.51|7.45|

E:n mediaani on tässä ajossa noin 14.3 % D:tä suurempi. Lisärikastus kasvattaa myös outputia. Muistinäytteet eivät ole todellisia muistihuippuja; yksi prosessipari ei osoita luotettavaa absoluuttista lisämuistibudjettia. Kellon, JIT:n ja GC:n vaihtelua ei eroteltu. JSON:t sisältävät kaikki 80 aikahavaintoa ja muistinäytteiden yhteenvedot. Ei Android-/akkukestoarviota.

## Ympäristö ja puuttuvat mittaukset

Node 24.19.0, PDF.js 6.4.299, Playwright 1.57.0. Sama toHex-apu kuin D:ssä, alkuperäiset riippuvuudet. Chromium 143.0.7499.4 build1200 ei latautunut (katkennut ZIP / HTTP400 GatewayExceptionResponse); odotettu executable puuttui eikä system-browseria löytynyt PATHista. Selain/Android NOT RUN.

Raw-reader vertaili whitespace-normalisoidut tekstit GT:n tunnetuilla alueilla 87/87 (sivu ja token-keskipiste toleranssilla ±2/3 pt). Ei koko dokumentin CER tai itsenäinen solutunnistuksen mittaus. Yksikköjen semanttista oikeellisuutta, käyttäjän korjausaikaa, suurten tiedostojen skaalaa, yleistä rakennekonfliktirecallia ja sivujatkoksien onnistumista ei mitattu. Rakennekonfliktin conflicting-tila on varattu, ei toteutettu yleinen luokitin.

Tulokset ovat saman aineiston aiemman tekijän DEV-kehitystyötä. HOLDOUTia ei käytetty. Riippumaton validointi on seuraava erillinen arviointivaihe, ei tämän raportin johtopäätös.

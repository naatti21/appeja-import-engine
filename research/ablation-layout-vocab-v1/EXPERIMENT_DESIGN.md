# Koeasetelma ja muuttujien hallinta

## 2×2

|Variantti|Rakenne|Semantiikka|Adapteri|
|---|---|---|---|
|A|v0.7 alkuperäiset y-rivit|v0.7|src/payroll-sections.mjs|
|B|structure.mjs alue-/paririvit|v0.7|sama alkuperäinen adapteri|
|C|v0.7 alkuperäiset y-rivit|vocabulary.mjs|semantic-parser.mjs|
|D|täsmälleen B:n rakenne|täsmälleen C:n sanasto|sama C:n adapteri|

Oikea readPdfWithPdfJs + standard PDF.js 6.4.299 lukee jokaisen tiedoston kerran. Sama immutable raakahavaintoaineisto syötetään kaikille vaihtoehdoille omana deep-clonena. Tämä eristää readerin vaikutuksen; neljää riippumatonta PDF-latausta ei väitetä. Kaikki sivut luetaan. 201 havaintoa säilyvät jokaisessa vaihtoehdossa samoilla raakateksteillä, laatikoilla ja ID:illä; myös row-tokenien multiset säilyy. Yksikään GT-arvo, bbox tai dokumenttitunnus ei ole kandidaattimoduulien runtime-syötteenä. GT on vain jälkiarvioinnissa.

## B:n säännöt

Domainriippumattomat heuristiikat: toistuva tekstimuotoinen taulukko-otsikkosekvenssi ehdottaa rinnakkaisia alueita; pitkät erilliset samalla korkeudella olevat tekstirunsit ehdottavat korttialueita. Rajat johdetaan glyfien väleistä/keskipisteistä, ei dokumentin koordinaateista. Alue päättyy isoon pystysuuntaiseen väliin. Sama y-rivi jaetaan alueittain ja tekstin/numeroiden vuorottelun mukaan paikallisiin otsikko–arvo-pareihin. Numeroksi luokitellaan vain syntaktinen numero-/päivämäärä-/prosenttirun; sille ei anneta domainmerkitystä.

Yksittäinen tekstilabel voidaan liittää läheiseen saman alueen numeroriviin. Jos ennen seuraavaa tekstilabelia on useita kelvollisia numerorivejä, linkkiä ei tehdä. Tämä varovaisuus lisättiin rajatun kilpailevien arvojen regressioproben vuoksi. Usean tekstielementin lukuruni säilyttää kaikki lähde-ID:t; numeron tulkinta on edelleen v0.7 parseNumber.

Moniriviset osat eivät katoa, mutta niiden linkit ovat unverified-ehdotuksia eikä täydellinen taulukkorivi rekonstruoidu. Sivujatkoksia tai yhdistettyjen solujen gridiä ei toteutettu. Alueiden palstajärjestys on edelleen perusrivin järjestys; osiotilan oikeellisuutta täysin erillisissä rinnakkaisissa osioissa ei osoitettu.

## C:n sanasto ja lähde

Lähde: tämän toimeksiannon käsitteet ja esimerkit (maksupäivä/palkkapäivä, brutto/ansiot yhteensä, veronalainen palkkakertymä/YTD taxable income, nettopalkka/maksettava palkka), v0.7:n olemassa olevat kenttäroolit sekä julkisten DEV-PDF:ien näkyvät otsikkotekstit. Mitään ulkopuolista auktoriteettia tai yleiskielistä kattavuutta ei väitetä. DEV:n otsikoista lisättiin `Brutto / gross`, `Taxable YTD`, `Veronalainen / YTD`, `Vuoden veronalaiset` ja `Net`. Ei annotaatioarvoihin perustuvia poimintasääntöjä, palkkalajikoodeja tai dokumenttikohtaisia ehtoja.

|Rooli|Lisäilmaukset|Raja|
|---|---|---|
|payDate|palkkapäivä, payment date, pay date|ISO-päivän semanttinen normalisointi; päivä validoidaan alkuperäisellä isoDate-funktiolla|
|grossPay|bruttopalkka, ansiot yhteensä, gross pay, brutto / gross|palkkadokumentin konteksti; vuoden osiossa alias ei muutu kauden brutoksi|
|netPay|maksettava palkka, net pay, net|palkkadokumentin konteksti, ei yleinen netto-sana muissa domaineissa|
|ytdTaxableIncome|veronalainen / YTD, veronalainen palkkakertymä, YTD taxable income, taxable YTD, vuoden veronalaiset|veronalaisuus ja vuosimerkitys, ei verokortti-/edellisvuosi-/tilisiirtokonteksti|

Sama otsikkotyyppitodiste kuin v0.7:ssä vaaditaan. Verokortti- ja previous-year-otsikko asettaa poissulkevan semanttisen osiotilan; eksplisiittinen current-period/year-headline voi nollata sen. Tämä rajattu kontekstisuoja lisättiin regressioproben vuoksi. Se ei ole täysi dokumentin tarkoituksen tulkitsija. `Maksu kirjataan` jätetään pois: kirjaaminen ei yksin todista maksupäivää.

Semantiikka toimii vain nykyisen rivin tekstissä. Se ei etsi arvoa toiselta riviltä eikä pilko alkuperäistä rakennetta. Säilyttää alkuperäiset observation.raw:t; normalisoi erillisen tulkintatekstin. Candidate.raw voi olla normalisoitu merkkijono; se ei ole alkuperäisen PDF:n suora sitaatti. Molemmat tekstit ja source-ID:t näkyvät raw-outputin transformedRows-listassa DEV:lle.

## Eristämisen rajoite ja tarkistus

v0.7 ei tarjoa sanaston injektointia. C:n testiadapteri on siksi v0.7-sections-moduulin tutkimuskopio, jossa muutetaan vain import-polut, funktion nimi ja otsikkotekstin hook + kontekstisuoja. check-isolation.mjs rekonstruoi tämän rajatun diff-asetelman ja assertataa tavut. Numerosäännöt, resolver, palkkalajit ja acceptance pysyvät samoina. B käyttää alkuperäistä adapteria, joten semanttinen sanasto ei laajene. D:ssä ei ole muita muutoksia.

Semanttiset otsikot voivat vaikuttaa alkuperäisen adapterin käsitteen valintaan ja semanttinen osiotila on osa C-akselia; tämä ei ole kaksi kokonaan eri parseritoteutusta. Tutkimuskopio ei ole suositus ylläpitää tuotannossa kahta parseria.

## Kehitysvaiheet

Ensimmäinen DEV-ajo paljasti 2/11, 5/11, 10/11 tulokset. Kokeelliseen koodiin lisättiin kilpailevien pystyarvojen torjunta ja verokortti-/vuosiosion semanttinen suoja erillisten regressioiden perusteella. Lopullinen DEV-ajo tehtiin tämän jälkeen uudelleen; tallennetut raw-outputit ovat lopullisesta koodista. Suojat eivät muuta lopullista DEV-ydinkenttätulosta. GT ja baseline eivät muuttuneet. Seitsemää virheellistä taulukkosoluehdotusta ei korjattu pistemäärän nostamiseksi.

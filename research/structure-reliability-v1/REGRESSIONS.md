# Regressiot ja odotusten alkuperä

## Alkuperäinen regressiosarja

YÖAJO 05:n muuttumaton `regressions.mjs` suoritettiin uudella output-polulla: **32/32** täyttyy. Kahdeksan tapausta × A/B/C/D. Output ja loki: ORIGINAL_REGRESSION_RESULTS.json / ORIGINAL_REGRESSION_LOG.txt.

`e-regressions.mjs` on näiden samojen kahdeksan tapauksen johdos: vain import-polku, varianttivalinta E ja output-polku muuttuvat. Odotuspredikaatteja ei muutettu. **8/8** täyttyy. Output E_REGRESSION_RESULTS.json. Validaattori rekonstruoi tämän sallitun lähdediffin vanhasta tiedostosta.

## Uudet 12 rakennetapausta

ADVERSARIAL_CASES.json:n odotukset luotiin ennen E-koodia/ajoa, SHA-256 `45804195628afe1fcba7806de68cdadced699bce7bd3d79c7ae92ac5a75fa55a`. PREREGISTRATION.json tallentaa ajan. Odotuksia ei muutettu. E täytti kaikki 12 ensimmäisellä ajolla sekä lopullisella uusinnalla. Tapaukset ovat **tunnetuista ongelmaluokista laadittuja ennakoivia kehitysvastatestejä**, eivät uusia ulkopuolisia asiakirjoja tai riippumatonta testiotosjoukkoa. E:n myöhempi paljaan viivan suoja syntyi DEV-havainnosta; sille ei lisätty 13. vastatapausta.

|ID|Tarkoitus|D|E|
|---|---|---|---|
|S01|Luku + yksikkösuffiksi pysyvät recordissa|ei täyty|täyttyy|
|S02|Account + symboli + useat luvut + valuutta|ei täyty|täyttyy|
|S03|Kolme lukua eivät ole yksi skalaari|ei täyty|täyttyy|
|S04|Sarakeheaderit erillään rivilabelista|ei täyty|täyttyy|
|S05|Kaksi selvää vaakaparia säilyy|täyttyy|täyttyy|
|S06|Toistuvat headerit erottavat rinnakkaisrecordit|täyttyy|täyttyy|
|S07|Kilpailevat pystyarvot jäävät eksplisiittisesti epävarmoiksi|ei täyty|täyttyy|
|S08|Moniriviset osat säilyvät erillisinä + epävarma linkki|täyttyy|täyttyy|
|S09|Samat arvot eri riveillä säilyttävät omat lähteet|täyttyy|täyttyy|
|S10|Väliin tuleva label estää hyppysidoksen|täyttyy|täyttyy|
|S11|Lähekkäiset itsenäiset kokonaisluvut eivät yhdisty tuhansiksi|ei täyty|täyttyy|
|S12|Oikea jaettu tuhaterotusluku säilyttää molemmat lähteet|täyttyy|täyttyy|

D 6/12; E 12/12. D:n fail voi tarkoittaa esimerkiksi puuttuvaa unit-candidate-outputia tai epävarmuuden eksplisiittistä esitystä, ei aina väärää semanttista arvoa. Joka tapauksessa kaikki havainnot säilyivät myös D:ssä. Kaikki osatarkistukset sekä D/E-layoutit ADVERSARIAL_RESULTS.json:ssa. Koordinaatit ovat uusien in-memory-tapausten fixturedataa, eivät tuotantologiikkaa. Ground truth/expect-objektia ei anneta rakennefunktioille.

Tätä sarjaa ei lasketa DEV-PDF-sidosten precision-/recall-nimittäjään. Rakennekehittäjän itse suunnittelemien vastatestien täydellinen läpäisy ei anna yleistä turvallisuustakuuta.

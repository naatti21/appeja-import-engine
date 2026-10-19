# P1-65-01 — päivämäärällisen hinnan taloudellinen rooli

Tämä on kehittäjän korjaus- ja testiraportti, **ei riippumaton hyväksyntä**. Lähtö: PR #65 `f12adda31fb49232a92f0ed54a0e17658932c451`, haara `fix/issue63-exclusive-field-binding`. Uusi erillinen haara: `fix/pr65-dated-price-role`. #55 jää avoimeksi. Ei mergeä, LAB-julkaisua, puhelinkokeilun hyväksyntää tai sovellusintegraatiota.

## Todistettu virhe

Work-kommentti `issuecomment-6274612886` luettiin kokonaan. Sen tarkka fiktiivinen 1100×1000 Arial-kuva on `economicRoleFixture('dated-nav')`: Rahastot (40,110), Cedar Valley Index (40,220), NAV 16.10.2026 (680,225), 52,1846 EUR (680,265), 37,6 kpl (680,315). Tämä kuva ei sisällä nykyarvoa eikä keskihankintahintaa.

Aito PNG → Tesseract fin+eng / eng → nykyinen parseri → renderöity UI toisti lähtö-SHA:lla virheen: nykyarvo `observed / 52.1846`, NAV `missing`, määrä `37.6`. Ensimmäisen testikierroksen yhdeksästä kuvasta kuusi FAIL, kolme PASS. Pelkkää valmista OCR-tekstiä ei käytetty RED-näyttönä. Lopullinen laajennettu 12 kuvan testitiedosto ajetaan myös muuttumattoman lähtö-SHA:n arkistokopiota vasten; sen loki jää erilliseksi RED-evidenssiksi.

Juurisyy oli kahden ehdon yhdistelmä: `keyFor` tunnisti vain täsmälleen labelin sisältävät rivit, ja `brokerRead` nosti yksikäsitteisen EUR-luvun määrän yläpuolelta nykyarvoksi tarkistamatta lähellä olevaa taloudellista roolia. Yksilöllinen sourceId-omistajuus ei todista numeron taloudellista merkitystä. Tämä on uusi parserivirhe, ei OCR:n kirjoitusvirhe eikä vanhan P0-orakkelin selitys.

## Rajattu korjaus

1. Taloudelliset labelit tunnistetaan myös päivämäärän ja muun rivitekstin yhteydessä. NAV, keskihinta, yksikköhinta ja kauden muutos ovat erillisiä rooleja; muutos/hinta ei ole nykyarvon synonyymi. Sisäkkäinen `price` ei tee `average acquisition price` -labelista kahta roolia. Useampi kilpaileva rooli jää epäselväksi.
2. Otsikoimattoman nykyarvon varapolku tarkistaa saman numeerisen sarakkeen lähikontekstin. Tunnettu kilpaileva taloudellinen label tai läheinen luokittelematon teksti estää varapolun. Myös hieman nimen yläpuolella oleva label huomioidaan. Vasemman sarakkeen erillinen tuottoprosentti ei omista oikean sarakkeen nykyarvoa.
3. Estetty nykyarvo on `ambiguous / COMPETING_ECONOMIC_ROLE`, säilyttäen numeron ja roolilabelin lähde-evidenssin sekä toisen OCR-luvun evidenssin. Täsmällisessä Work-kuvassa NAV säilyy havaittuna 52.1846, mutta nykyarvo ei ole havaittu eikä rivi ole rakenteellisesti valmis. Erillisen päivämäärärivin aiheuttama epäselvä NAV saa jäädä ratkaisematta.
4. Vanha geometrinen sarakerajaus ja finanssikenttien yksilöllinen lähdeomistajuus säilyvät. P1-64-01:n fixture ja molemmat vanhat RED/GREEN-orakkelit säilyvät tavutasolla muuttumattomina. UI-, manuaalisen tietokuvan-, listing- ja tallennuskoodeihin ei tehdä muutoksia.

Ei yksittäisen `NAV 16.10.2026` -merkkijonon poikkeussääntöä, yritys-/välittäjälistaa, markkinapalvelua, oppimisprofiilia tai taloustietojen tallennusta. `canPersist:false`, `candidates:[]`, `actions:[]` säilyvät.

## Testimatriisi ja tulkinta

Uudet 14 Node-vastatestiä kattavat päivämäärällisen/pelkän NAV:n, erillisen päivämäärän, päivämäärällisen Keskikurssin, kauden muutoksen, yleisen yksikköhinnan, kilpailevat roolit, tuntemattoman lähitekstin, nimen yläpuolisen labelin, aidon otsikoimattoman nykyarvon, viereisen tuottoprosentin, viiden kortin vaihdetut päivämäärälliset hintasarakkeet, kahden OCR-luvun rooliristiriidan ja sisäkkäisen englanninkielisen labelin.

Uusi Chromium-sarja käyttää 12 oikeaa PNG-kuvaa ja paikallista OCR:ää sekä UI:n tiedostovalintaa. Yhdeksässä yhden rivin hyökkäyskuvassa nykyarvoa ei saa havaita; kahdessa yhden rivin kontrollissa se pitää havaita. Viiden kortin sarakevaihto säilyttää oikean nykyarvon, NAV:n ja keskihinnan. Kaikki kuvapikselit, OCR-evidenssi, sourceId:t, ruutukuvat ja mittarit tallennetaan synteettisinä testiartefakteina.

Kehitysvaiheessa uusi 12 kuvan sarja PASS; kohdennettu Node + vanhat turvallisuusportit 71 PASS. Lopulliset koko sarjan tulokset lukitulle toimituscommitille kirjataan toimitushandoffiin ja CI:n exact-SHA-yhteenvetoon, ei ennakoida tässä.

Lähtö-SHA ajettiin uudelleen muuttumattomasta Git-arkistosta: Node 296 PASS / 26 FAIL / 0 SKIP; tavallinen Chromium 89 PASS / 3 FAIL / 53 SKIP. Laajennetussa OCR-ajossa ohitettavat OCR-testit suoritetaan oikeasti ja virheet raportoidaan erikseen. Vanhojen virheiden nimiä verrataan tiedoston ja testin nimen mukaan, ei Playwrightin vaihtelevien sourcemap-rivinumeroiden perusteella.

Yksi väliaikainen selainajo keskeytettiin, kun rinnakkaisen ajon hallitsema uudelleenkäytetty paikallinen HTTP-palvelin sulkeutui. Keskeytettyä ajoa ei lasketa PASS-tulokseksi. Tarkistukset uusitaan erillisessä portissa; tuotetestejä ei ohiteta tai löysennetä sen takia. Ensimmäisen erillispäivämäärävariantin Node-geometria jätti nimen täsmälleen tunnistusikkunan ulkopuolelle; variantin määrärivi siirrettiin 10 px ylöspäin säilyttäen hyökkäyksen ja samat tiukat odotukset. Lopullinen variantti toistetaan myös lähtöparserilla. Workin tarkka alkuperäinen NAV-kuva ja P1-64-01-fixture eivät muuttuneet.

## Jäljellä olevat rajat ja arvioijan tehtävä

- Lisävarovaisuus voi jättää aidon nykyarvon epäselväksi, jos sen yhteydessä on tuntematon teksti. Positiivisten fiktiivisten kontrollien kattavuus mitataan erikseen; tuloksesta ei päätellä yleistä pankkikuvien herkkyyttä.
- Molemmat OCR-luvut voivat olla samalla tavalla väärässä. Tunnistettu taloudellinen label ei varmenna instrumenttia. Oikeat pankkikuvat, kuukausittainen päivitys, kustannustietojen täsmäytys ja Android-laite eivät ole osoitettuja.
- Kehittäjä ei anna riippumatonta GO-hyväksyntää. Uuden arvioijan on tarkistettava uusi SHA ja CI-artifaktit sekä käytettävä omia, uusia fiktiivisiä vastakuvia. PR #65:n aiempaa auditointia ei esitetä riippumattomana hyväksyntänä.
- **NO-GO julkaisuun, synthetic-phone-hyväksyntäkokeeseen, integraatioon ja tallennukseen**, kunnes erillinen arvioija ja käyttäjä hyväksyvät seuraavan portin. Ei muutoksia Palkkaan, Osakevahtiin tai julkaistuun LABiin.

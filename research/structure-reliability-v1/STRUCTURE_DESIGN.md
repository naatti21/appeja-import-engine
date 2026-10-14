# Rakennemalli ja muutosten eristäminen

## Mikä muuttuu

D suoritetaan alkuperäisellä `../ablation-layout-vocab-v1/structure.mjs`-moduulilla. E käyttää uutta `structure-e.mjs`-moduulia. Molemmat käyttävät **samaa alkuperäistä** `../ablation-layout-vocab-v1/semantic-parser.mjs`-adapteria sekä sen sanastoa, numero- ja palkkalajisääntöjä ja acceptance-funktiota. E ei sisällä palkkakäsitteitä, aliaslistoja, tilisymboleja, fixturetunnuksia tai GT-koordinaatteja. Säännöt käyttävät havaintojen tekstiä syntaktisena muotona ja geometriaa.

Lukija suorittaa aidon PDF.js 6.4.299 getDocument/getTextContent-ketjun ja alkuperäisen readPdfWithPdfJs-funktion. Jokaisen tiedoston sama reader-layout syötetään D:lle ja E:lle erillisenä kloonina. GT päätyy vain arviointiin jälkikäteen. Jokaisen observationin ja row-tokenien multisettien muuttumattomuus assertataan. D:n koko layout ja parsed-output assertataan samoiksi kuin lukitussa YÖAJO 05:n raw/D-outputissa, kuusi dokumenttia.

## Yleiset säännöt

1. **Rinnakkaisalueet:** toistuvat otsikkosekvenssit säilyttävät D:n taulukkorajat. Korttialueen synty vaatii lisäksi vähintään kaksi monisanaista otsikkorunia. Tämä vähentää yksittäisistä sarakesanoista tehtävää korttipäätelmää; ei todista kaikkia kortteja oikeiksi.
2. **Rivin pilkkominen:** vain kokonainen vuorotteleva yhden tekstilabelin ja yhden numerorunin sarja voidaan pilkkoa paikallisiksi pareiksi. Epätäydellinen sarja, useita alkuosan tekstikenttiä tai tekstisuffiksi palauttaa koko rivin. Näin valuuttasuffiksi ei jää omaksi uudeksi otsikkorivikseen.
3. **Numeroruni:** yksi numeroita sisältävä teksti tai lähekkäiset tuhaterotusfragmentit. Monifragmentin ensimmäinen pala on 1–3 numeron etuosa, jatkopala kolmen numeron ryhmä ja mahdollinen 1–2 desimaalia; välikynnys suhteutetaan fonttikorkeuteen. Lähellä olevia 12 ja 20 -arvoja ei liitetä. Paljas viiva ei ole yksiselitteinen numero. Tässä ei korvata v0.7:n numerotulkintaa: runi on rakenteellinen ehdotus, alkuperäiset merkit säilyvät.
4. **Pystypari:** D:n läheisen saman alueen yhden labelin ja numerorivin yhdistäminen säilyy, mutta numeroiden pitää muodostaa yksi runi. Useat kilpailevat numerorivit säilyvät riveinä ja erillisenä uncertain-ehdotuksena kaikkine lähteineen.
5. **Moniarvoinen rivi:** ei yksi varma solu. Koko rivi säilyy sekä record-ehdotuksena että uncertain-soluehdotuksena. Rivilabelia ei väitetä kaikkien lukujen sarakeotsikoksi.
6. **Yksikkösuffiksi:** numeron jälkeinen lyhyt kirjain-/yksikkösymboliteksti säilyy recordissa ja saa epävarman unit-candidate-viitteen. Ei valuutta- tai yksikkösanakirjaa; `USD` tai `kg` ei saa semanttista totuusarvoa rakenteessa. Epätavalliset pitkät yksiköt jäävät raakatekstiksi.
7. **Sarakeotsikko erikseen:** lähin saman alueen aiempi monitekstinen header-rivi tuottaa x-linjauksen perusteella vaihtoehtoisia sarakesidoksia. Ne ovat **aina uncertain**, vaikka ehdokkaita olisi vain yksi. Aikaisempi taulukko voi olla jo päättynyt — tämä on tunnettu jäljelle jäänyt virheluokka.
8. **Monirivisyys:** läheiset samalla x-ankkurilla olevat tekstiosat voidaan liittää unverified/uncertain-ehdotuksella, mutta alkuperäiset rivit säilyvät. Ei automaattista sivujen välistä yhdistämistä eikä keksittyjä soluja.

## Johdettu output

Alkuperäisiä `observations`-olioita ei korvata. `structure.cells` sisältää ID:n, alkuperäiset source_ids:t, sivun, normalisoidun union-boxin, region/table/record-ehdotustunnisteet sekä label_source_ids-, value_source_ids- ja unit_source_ids-listat. Moniriviseen/epäselvään soluun kuuluvat record_candidate_ids:t voivat osoittaa useaan mahdolliseen riviin. Tila ja tekstimuotoinen reason/method kertovat perusteen. `structure.records` säilyttää jokaisen johdetun rivin source-ID:t, alkuperäisten rivien ID:t, sivun/alueen ja unit-candidatet. `column_header_candidates` erottaa sarakkeen geometrisen vaihtoehdon rivilabelista.

Tilat: unambiguous, uncertain, conflicting, unresolved. Tässä E tuottaa soluille unambiguous/uncertain ja recordeille unresolved; conflicting on varattu eikä sen yleistä rakennetason tunnistusta ole toteutettu. Alkuperäinen semanttinen resolver tunnistaa edelleen ristiriitaiset kenttäehdokkaat. Unambiguous tarkoittaa **heuristiikan yksiselitteistä rakennesidosta**, ei varmennettua semantiikkaa tai kalibroitua todennäköisyyttä. Numeerista confidencea ei ole.

## Kehityshistoria

12 vastatestin odotukset tallennettiin ja SHA-256-lukittiin PREREGISTRATION.json:iin ennen E:n toteutusta tai ajoa. E läpäisi ne ensimmäisellä ajolla. Ensimmäisessä DEV-ajossa ilmeni D:ltä peritty paljaan viivan luokittelu skalaariseksi numeroruniksi T02:ssa; se jätettiin lopullisessa E:ssä epävarmaksi. Kyseiselle viivalle ei ole annotoitua arvo–otsikkosidosta, joten se merkitään D:n mittauksessa unscored eikä keksityksi GT-virheeksi. Muutos ja ensimmäisen passin yhteenveto EXPLORATORY_FINDINGS.json:ssa. Oraclea ja GT:tä ei muutettu. Viimeinen koodimuutos lisäsi vain auditointiviitteitä record- ja sarake-ehdotuksiin; kaikki olennaiset testit uusittiin.

## Monimutkaisuus ja selain

D:n rakennekoodi on 90 riviä, E:n 158: lisäys 68 riviä. Luku ei ole ylläpidettävyyden mitta; E säilyttää D:n alueheuristiikkojen rungon tutkimuskopiona, mikä tuo drift-riskin.

Y-läheisyys- ja seuraajarivihaut sekä rikastuksen header-rivien haut voivat olla pahimmillaan O(R²). Sarake-ehdotusten haku riippuu rivin tokenimäärästä ja headerien määrästä. Cell→record-assosiaatio hakee rivejä ja source-ID-listoja uudelleen. Alkuperäinen adapteri rakentaa lisäksi havaintoindeksin toistuvasti riveille. Normaali output on lineaarinen havaintoihin ja ehdotuksiin nähden, mutta tiheä tai laaja-alainen vaihtoehtojen joukko voi kasvaa selvästi yli O(N):n; rajattua tuotantobudjettia ei ole osoitettu.

Suurten tiedostojen riskit: readerin kaikki sivut muistissa, layout-kloonit, toistuvat source-ID-listat ja ehdotusten määrän kasvu. Node-harnessin raw/GT/tulosobjektit lisäävät muistia enemmän kuin minimaalinen selainydin. Ennen puhelinkäyttöä tarvitaan työlanka, per-page/region-indeksit, ehdotusten rajattu elinkaari ja mitattu keskeytys-/muistibudjetti. Näitä ei toteutettu tässä. Ei Android-nopeusväitettä.

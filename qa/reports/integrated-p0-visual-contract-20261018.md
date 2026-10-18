# Engine yhdistetty P0-korjaus ja visual-OCR — hyväksyntäsopimus

Päiväys: 2026-10-18. Työhaara: `integration/p0-safe-dual-ocr-20261018`.
Pohja: uusimman toimivan OCR-haaran PR #46 SHA `9f6f08af6c2b1f6b751bdf8ec51e5332c57b517f`.
Tuotu rajattu Codex P0 -korjaus: PR #47 SHA `b68548bc08e373933d3f6a10b4bf9d0919ee3ee8`.

## Ratkaisu ristiriitaisiin hyväksymisehtoihin

Vanha `mobile-card-holdings.mjs` ja uusi `portfolio-visual-evidence.mjs` ovat **eri adaptereita eri näyttöön**. Vanha tarvitsee eksplisiittisen lähdenimikentän tai nykykuvan käyttäjävahvistuksen ja validoidun tunnisteen. Uusi visual-adapteri voi tehdä **B-tasoisen, varmentamattoman instrumenttiehdotuksen** ilman tickeriä/ISINiä, kun nimen, määrän, kohdistuksen ja mahdollisen arvon lähdeviitteet ovat kunnossa. Molempien `canPersist:false`.

**Vanhan korttiadapterin seitsemän positiivista oletusta** (kolmen erilaisen kortin vaihtuva tekstirivi todistaa nimen) ovat ristiriidassa toistetun uuden P0-hyökkäyksen kanssa. Vaihteleva teksti voi olla esimerkiksi kolme eri väliotsikkoa ja sama liikkeeseenlaskijan nimi voi toistua eri listauksissa. Tätä alkuperäistä oletusta **ei palauteta eikä testien kynnystä löysennetä**. Testit säilytetään auditointinäyttönä punaisina, kunnes niiden sopimus muutetaan erikseen hyväksytyllä, turvalliset väitteet säilyttävällä testimigraatiolla.

**Codexin luokittelemista 17 vanhasta epäonnistumisesta 15** sisältää edelleen olennaisen turvallisuusväitteen (A) ja **2** sisältää vanhan indeksipohjaisen korttiadapterin erityissopimuksen (B), mutta molemmissakin on säilytettävää turvallisuusnäyttöä. Ne ovat historiallisia P0-portin jälkeen, eivät uuden visual-OCR:n synnyttämiä. Pelkkä vanhojen positiivisten rivien lukumäärä aiheuttaa useissa testeissä varhaisen pysähdyksen ennen varsinaista turvaväitettä; Codexin uudet eksplisiittisesti nimilabeloidut positiiviset kontrollit testaavat nuo väitteet itsenäisesti. Alkuperäisiä testejä ei poisteta eikä muuteta.

## Uusi yhteinen sopimus ja testit

`tests/integration-p0-visual.test.mjs` testaa molemmat adapterit yhteisessä integraatiotestissä:
- Vanhan korttiadapterin kaksi opetusta eivät oikeuta automaattista nimetöntä instrumenttia. Oppimisprofiili ei saa mutatoitua lukemisessa.
- Selvästi lähdeotsikoitu vanha nimi toimii edelleen B-ehdokkaana, ei markkinavarmennuksena.
- Laajan kuvan osakkeet ja monirivinen rahasto onnistuvat ilman tickeriä/ISINiä. Käteinen, väliotsikot, saldot ja arvonmuutokset eivät saa olla instrumentteja.
- Senttitarkka summaero ei muuta instrumentin nimeä eikä tue automaattista hyväksyntää.
- Eriävät OCR-nimilukemat estävät kyseisen instrumentin; identtisiä huonoja lukemia ei ylennetä summan perusteella.
- Instrumenttilistauksen verkkohaku on oletuksena pois ja paikallinen testiresolver ei tee automaattista taloustiedon kirjoitusta; valinta edellyttää symbolia **ja** markkinapaikkaa.

`.github/workflows/integrated-p0-visual-qa.yml` ajaa Node-sopimustestit sekä aidon synteettinen PNG → Tesseract → vanha otsikkohyökkäys + uusi koko kuvan ja kompaktin kuvan tunnistus -testisarjan samalla lukitulla HEADilla. PR #47:n ja PR #46:n alkuperäiset testit jätetään muuttamatta.

## Hyväksymisportit

1. **P0 turvallisuus**: yksikään synteettinen väliotsikko ei saa päätyä vanhan oppijan instrumenttiehdotukseksi. Tämän pitää toimia oikeasta pikselikuvasta.
2. **Visual-B hyöty**: uudessa synteettisessä kompaktissa kuvassa 4/4 oikeaa ja laajassa peruskuvassa vähintään 4/5 oikeaa, **nolla väärää**. Nämä rajatut mittarit eivät todista luotettavuutta uusissa pankkimalleissa.
3. **Valuuttalaskenta**: vain saman sijoitusosion summat, yhtäläisyys ei varmista nimeä; näyttövaluutta ja kaupankäyntivaluutta erotellaan.
4. **Tietosuoja**: ei oikeita käyttäjän sijoituskuvia tai arvoja GitHubiin, ei markkinaverkkopyyntöjä ilman etukäteen tehtyä lupapäätöstä, ei taloustietojen tallentamista.
5. **Täysi testistö**: aiemmat 24 punaisena olevaa vanhaa testitapausta raportoidaan erikseen, eikä niitä poisteta tai peitetä. Koko Enginen integraation **GO edellyttää lisäksi suunniteltua vanhan adapterin testisopimuksen migratoimista tai todellisten virheiden korjaamista**, ja sen riippumatonta arviointia.

## Päätös

**Tutkimus-Draft / NO-GO** yhdistämiseen, LAB-julkaisuun, Palkkaan tai Osakevahdin Alpha-versioon. Seuraava arvioija ChatGPT Work lukee molempien PR:ien diffiä, uuden yhteisen sopimuksen, tarkat GitHub CI -tulokset ja vanhojen epäonnistumisten juurisyyt ennen lopullista hyväksyntää.

Tämä työ ei muuta tuotantokoodia, vanhoja testejä, julkaistua LABia eikä käyttäjän oikeita sijoitustietoja.

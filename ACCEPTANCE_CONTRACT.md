# Import Engine LAB — yhteinen hyväksymissopimus v1

**Tila:** ehdotettu ja automaattisesti testattava tutkimussopimus, ei nykyisten Palkka- tai Osakevahti-sovellusten hyväksymismenettelyn muutos. **Mikään parserin vihreä tulos ei anna lupaa tallentaa.** 

## Yhteinen ketju (molemmat sovellukset)

1. **Raakahavainto:** alkuperäinen arvo `raw`, sijainti (PDF:n sivu ja laatikko / CSV-rivi ja sarake), lukutapa ja yksilöivä `id` säilyvät. Sama arvo kahdesta kohdasta tuottaa kaksi havaintoa, ei yhtä.
2. **Kenttäehdokas:** `value`, `status` (`verified`, `missing`, `ambiguous`, `conflict`, `invalid`, `unverified`) ja `sourceIds` osoittavat olemassa oleviin alkuperäishavaintoihin. `0` on arvo, `null` puuttuva — niitä ei yhdistetä.
3. **Sovelluskohtainen semantiikka:** kohdistus, pakolliset kentät, tyyppi- ja ristiriitatarkastukset ovat erillisiä. OCR-todennäköisyys tai muu confidence-arvo ei yksin ole todiste oikeasta kentästä.
4. **Koko dokumentin eheys:** estävät ilmoitukset, tuntemattomat olennaiset raha-/määrähavainnot, kohdistamattomat solut, toisen sivun ristiriidat ja epäselvä dokumenttityyppi tekevät tilaksi `review-required`.
   - **Lähdehavaintojen kuittaus:** `accountedEvidenceIds` on vain tutkimusadapterin kirjanpito-/kattavuusvihje, ei itsenäinen oikeellisuustodiste. Vain hyväksymiskelpoisen, `verified`-tilaisen kentän olemassa oleva `sourceIds` voi kuitata olennaisen havainnon hyväksymisportissa. Ledgerin tunnisteet voidaan yhä raportoida kattavuusmittarina, mutta ne eivät muuta `UNACCOUNTED_MATERIAL`-estoa. Tämä ei vielä todista, että myös kentän ja raakatiedon semanttinen yhteys olisi täysin varmennettu.
5. **Päätös:** `candidate-ready` on pelkkä koneellinen valmis **ehdotus**. `canPersist` on aina `false` tässä LAB-sopimuksessa. Tallennus edellyttää sovelluksen erillistä käyttäjän tarkastus-, korjaus- ja hyväksymisprosessia (ei toteuteta tässä tutkimushaarassa).
6. **Yksityisyys:** paikallinen käsittely; alkuperäistä PDF:ää, kuvia, palkkoja, salkkuja tai OCR-sisältöä ei siirretä palvelimelle testailua varten. Ei tuotantosovellusten automaattista muutosta.

## Palkka PWA:n kenttäsopimus

Lähteen jäädytetty `app.js` ja `tests/acceptance.test.mjs` (`naatti21/Palkan-laskenta@550c7654…`) nimeävät pakollisiksi `payDate`, `grossPay`, `netPay` ja `ytdTaxableIncome`. Tuotannon kandidaatissa niiltä odotetaan confidence ≥ 0,95 ja brutto/YTD:lle vahvistettua lähde-evidenssiä. LAB v1 vaatii **kaikille** neljälle kentälle lähde-ID:n sekä oikean tyypin; päivämäärä muodossa YYYY-MM-DD, summat äärellisiä ja vähintään 0; netto ei ylitä bruttoa. Ristiriitaiset kertymät, puuttuva erä, todistamaton lähde tai virheellinen kausi estävät. 

`withholdingPeriod`, `withholdingYtd`, `previousYearTaxableIncome`, palkkalajit ja verokortin oma kertymä eivät kuulu tähän neljän pakollisen kentän joukkoon; **jos näistä syntyy ristiriita tai muu blocking-notice, se silti estää**. Täydellisten synteettisten laskelmien vertailussa niiden oikeellisuus raportoidaan erikseen, eikä pelkkää neljää ydinkenttää nimitetä koko laskelman pariteetiksi.

## Osakevahdin tuonnin kenttäsopimus

Tämä on **LAB-ehdotus**, ei väite nykyisen Osakevahdin tallennussääntöjen olevan samat. Jokaisessa rivissä tulee olla vähintään yksi todennettu instrumentin yksilöijä (`isin`, `ticker` tai `name`), `quantity` > 0, `buyPrice` ≥ 0 ja selkeä `currency` (ISO 4217 -kolmikirjaiminen koodi). Puuttuva ostohinta **ei** ole 0; jos ostohintaa ei tunneta, rivi jää käyttäjän tarkistettavaksi eikä kone ehdota keksittyä hintaa. `broker`, `account`, `accountType`, `MIC` ja `ISIN` eivät saa sekoittua eikä tuntemattomia täytettyjä sarakkeita saa hävittää. Validointi ei keksi valuuttaa tai markkinapaikkaa symbolista.

## Estojen ja mittareiden vähimmäistaso

- `MISSING_FIELD`, `INVALID_FIELD`, `UNVERIFIED_FIELD`, `MISSING_SOURCE_EVIDENCE`, `BAD_SOURCE_REFERENCE`, `UNKNOWN_DOCUMENT_TYPE`, `BLOCKING_SOURCE_ISSUE`, `UNACCOUNTED_MATERIAL`, `NET_EXCEEDS_GROSS`, `NO_INSTRUMENT_ID` ja `CONFLICT` pidetään eroteltuina.
- Vertailussa kirjataan kenttäkohtaisesti täsmällinen osuma, todistettavasti puuttuva, ristiriita, väärä arvo, turha esto, havaitsematta jäänyt estoperuste ja lähdehavaintojen kattavuus. **Saman dokumentin** kummankin parserin tulos raportoidaan rinnakkain.
- Päätösportti: ei yhtään hiljaista virhehyväksyntää kontrolloiduissa tapauksissa; tuntematon asettelu pysäytetään; hyväksymissopimuksen testit PASS täsmällisellä SHA:lla; oikeat lähteet ja riippumaton QA myöhemmässä portissa. CI-vihreä ei ole julkaisulupa.
- Nolla virhettä pienessä synteettisessä otoksessa **ei** osoita virheettömyyttä todellisessa käytössä.

## Avoimet asiat ennen integraatiota

Osakevahdin rivitason hyväksyntä, osittainen käsin korjattu tuonti, eri tilityyppien synkronointi, dokumenttien säilytyskäytäntö ja täsmällinen käyttäjän hyväksyntäpolku ratkaistaan vasta erillisissä sovelluskohtaisissa spekseissä. Tässä sopimuksessa ei ole tallentavaa toimintoa.

**Lähdepohja:** nykyisen jäädytetyn Palkka-parserin ja hyväksymistestien kentät; Osakevahdin `main`-CSV-käyttöliittymän ja LABin holdings-adapterin nykyiset rajoitukset; LAB PR #1–#5:n tarkastetut synteettiset regressiot. Päivitetty 13.10.2026.

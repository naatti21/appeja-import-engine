# QA v1.3 — toistettava 300-tiedoston generaattori

**Rooli:** toimii ainoastaan synteettisen QA-korpuksen tuottajana. **Ei** aja LAB v1.3 -tuontimoottoria eikä väitä oikeita syöte→tulos-testejä tehdyksi.

## Lähtökohta ja yhteensopivuus

Käyttäjän toimittaman `Import-Engine-LAB-v1.3-QA-NOT-RUN-2026-10-14.zip`-aineiston generaattorin pohjalta toteutettu:
- 60 determinististä tapausta, siemenet 130000–130059.
- 12 testiperhettä × 5 tapausta: `clean`, `missing_cost`, `missing_currency`, `conflicting_value`, `ambiguous_decimal`, `malformed_number`, `zero_quantity`, `separate_accounts`, `repeated_holding`, `duplicate_column`, `unknown_money`, `missing_quantity`.
- **300 lähdetiedostoa**: kullekin tapaukselle `source.csv`, `source.png`, `source.jpg`, `source.pdf`, `source.xlsx`. Lisäksi `oracle.json` ja `sources.json` sekä globaali `manifest.json`.
- Oraakeli sisältää odotetut kenttäarvot **ennen tiedostojen piirtämistä** sekä rakenteen ja hyväksymisestot. Testattu sovelluskoodi EI osallistu generaattorin oikeiden vastausten määritykseen.

**Alkuperäisen ZIPin SHA-256:** `dfd81ea0eabbbe3785018903909aff42cd6c677e0cdbf01c895f98c393c6b329`. Tämä on alkuperäisen keskusteluliitteen SHA, **ei uudelleen generoidun ZIPin SHA**.

Paikallisessa vertailussa alkuperäisen `generate.py`:n Python/Pillow-kierros tuotti **60/60 identtistä oracle.json-, sources.json-, CSV-, PNG- ja JPG-tiedostoa**. ReportLab-PDF:ien tavuhajautus ei täsmännyt, koska alkuperäinen PDF-sarja sisälsi ajonaikaisia metatietoja. Uusi generaattori käyttää `invariant=1`-asetusta. XLSX:t rakennetaan uudella testirakenteen ZIP/OOXML-serializerilla, koska QA-agentin alkuperäinen versio käytti `@oai/artifact-tool`-kirjastoa. Uuden XLSX:n **solut/tekstit ja lähteet** tarkistetaan, mutta alkuperäisen XLSX-binaarin identtisyyttä ei luvata.

## Ajot

- Workflow: `.github/workflows/qa-corpus-generate.yml`.
- PR:ssä generaattorin muutokset käynnistävät ajon automaattisesti; manuaalinen `workflow_dispatch` tulee käyttöön GitHubin Actions-valikosta, kun workflow on oletushaarassa (ei mergeä ilman käyttäjän lupaa).
- Asennetaan Python 3.11, Pillow 12.3.0, ReportLab 4.4.9, pypdf 5.9.0, Node 22 ja tämän LABin npm-lockin riippuvuudet.
- `scripts/qa-corpus/generate.py` luo dokumentit, `build-xlsx.mjs` luo pakatut OOXML-taulukot, `verify.py` tarkistaa alkuperäiset oracle-matriisit, CSV-arvot, kuva/PDF-rakenteet, lähdeviitteet ja 300/300 SHA-256-tiivisteet. XLSX-tarkistus käyttää nykyistä LABin `src/xlsx.mjs`-lukijaa kenttä kentältä, joten **se on kehittäjätesti eikä täysin riippumaton XLSX-oracle**; oikea matriisi tulee silti erillisestä generaattorista.
- Workflow generoi **toisen korpuksen puhtaaseen kansioon** ja tarkistaa 421 tiedoston tarkisteet keskenään. Jos yksikin tiedosto poikkeaa, CI FAIL.
- GitHub Actionsin `Artifacts`-osio tarjoaa määräaikaisen `qa-v13-synthetic-corpus-<run>-<attempt>` ZIPin (14 pv tai repon lyhyempi säilytysaika). Siinä on 60 tapauskansiota, viisi lähdetiedostoa per tapaus, oracle/sources, `corpus-validation.json`, `manifest.json`, `report.md` ja testiloki.
- ZIP ei jää Git-historiaan. Pysyvä run-linkki, lopputulos ja SHA kirjataan tähän infrastruktuurin PR-keskusteluun `QA_ARCHIVE.md`-käytännön mukaisesti.

## Käynnistys paikallisesti

```bash
npm ci
python3 -m pip install Pillow==12.3.0 reportlab==4.4.9 pypdf==5.9.0
python3 scripts/qa-corpus/generate.py
node scripts/qa-corpus/build-xlsx.mjs qa-output/corpus
python3 scripts/qa-corpus/verify.py qa-output/corpus
```

Tulos generoidaan `qa-output/`-kansioon. Kansio on `.gitignore`-säännöissä.

## Turvarajat ja GO/NO-GO

- Vain nimeltään `Synthetic Asset` olevia fiktiivisiä instrumentteja ja `SYN`-tilejä.
- **Ei** oikeita käyttäjä-PDF:iä, kuvakaappauksia, sähköposteja tai henkilökohtaisia taloustietoja.
- Korpuksen syntyminen ja oikeellisuus eivät todista OCR:n, PDF-parserin, XLSX-tulkinnan, omistusrivien sidonnan tai v1.3-sovelluksen tarkkuutta.
- Edellisen QA-agentin NOT RUN -havainto säilyy, kunnes rakennettu todellinen LAB v1.3 ja tarkka SHA voidaan testata erikseen.
- Tuotantomerget, deployt ja käyttäjän tuotantosovellusten muutokset **NO-GO**.

## Seuraava laadullinen portti

Kun LAB v1.3 -kohde on olemassa, testiadapteri käyttää 300 syntetisoitua syötettä ja kirjoittaa yhden tulostiedoston jokaista aitoa moottoriajoa kohti. Vasta sitten erillisen QA-agentin `compare.py` arvioi kenttäkohtaiset virheet, lähdeviitteet, väärät hyväksynnät ja tarpeettomat hylkäykset. Korpuksen `oracle.json` ei saa mennä sovelluksen syötteeksi.

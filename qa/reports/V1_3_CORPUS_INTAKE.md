# LAB v1.3 — ulkoisen QA-korpuksen vastaanottotarkistus

**Päivä:** 14.10.2026  
**Lähde:** käyttäjän tähän keskusteluun toimittama erillisen QA-agentin ZIP  
**Alkuperäinen nimi:** `Import-Engine-LAB-v1.3-QA-NOT-RUN-2026-10-14.zip`  
**Paketin SHA-256:** `dfd81ea0eabbbe3785018903909aff42cd6c677e0cdbf01c895f98c393c6b329`

## Mitä todella varmennettiin paikallisesti

- 429 ZIP-merkintää, noin 5,49 Mt pakattuna ja 7,23 Mt purettuna.
- 60 erillistä synteettistä tapausta (siemenet 130000–130059), kustakin viisi syötemuotoa: PNG, JPEG, natiivi PDF, CSV ja XLSX. Yhteensä **300 lähdetiedostoa**.
- Paketin `fixture-validation.json`-tiedoston sisältämät **300/300 SHA-256-tarkistetta** laskettiin uudelleen alkuperäisistä ZIP-sisällöistä: **täsmäsivät**.
- `qa_import/corpus/manifest.json` luettelee 60 tapausta, kaikissa `status=NOT_RUN`.
- `qa_import/QA-RAPORTTI.md` ilmoittaa nimenomaisesti, ettei pyydettyä LAB v1.3 -kandidaattia ollut tunnistettu eikä varsinaista tuotemoottoria ollut testattu.
- `python3 -m unittest discover -s qa_import -p test_comparator.py -v` ajettiin **vain QA:n oman vertailijan 11 kontrollitestille** irrotetuilla synteettisillä JSON-testisyötteillä: **11/11 PASS**.
- ZIP-rakenteen CRC tarkistettu eikä tarkistuksessa tullut esiin path traversal -polkuja, symlinkkejä tai salattuja merkintöjä.
- 60 CSV-syötettä tarkistettiin automaattisesti ilmeisten sähköpostiosoitteiden, IBAN-kaltaisten merkkijonojen ja odotetun synteettisen nimeämisen suhteen: ei poikkeamia. Tämä ei ole täydellinen yksityisyysauditointi kaikille binääritiedostoille.

## Mitä EI testattu

- **LAB v1.3 -sovelluksen 0/300 syötettä; varsinainen QA edelleen NOT RUN.**
- Ei pikseli→OCR→omistusrivien sidonta -kokonaistestiä, ei oikeaa PDF-/XLSX-/CSV-parsintaa vastaavan v1.3-kandidaatin kautta.
- Ei riippumatonta tuotantohyväksyntää, fyysistä Androidia tai todellisilla välittäjän asiakirjoilla mitattua osumatarkkuutta.

**Lopputulos:** korpus eheä ja vertailuharnessin kontrollit läpi; **tuotantokäyttö NO-GO**.

## Arkistoinnin todellinen tila

**Tämä raportti on GitHub-repossa, mutta alkuperäistä 5,49 Mt ZIPiä EI ole siirretty GitHubiin eikä ladattu Actions-artefaktiksi.** ZIP on vain käyttäjän keskusteluliitteessä. Sen GitHub-artifaktin URL:ää tai säilytysaikaa ei saa keksiä.

Playbook v1.9.2:n mukaisesti suurta ZIPiä ei commitoida Git-historiaan. Väliaikainen Actions-artifakti vaatii sallittua siirtotapaa tai synteettisen korpuksen uudelleengenerointia QA-workflow'ssa. Jälkimmäinen on **uusi** artefakti, ei sama alkuperäinen SHA eikä sitä saa kutsua alkuperäiseksi ZIPiksi ilman bitti-identtistä vertailua.

**Vaadittu seuraava portti:** yksilöi todellinen LAB v1.3 PR ja SHA, aja alkuperäisen korpuksen tuontireitti riippumattoman vertailijan kanssa ja merkitse PASS/FAIL/PARTIAL/NOT RUN kenttätasolla. QA-korpuksen kontrollitestit eivät ole tuontimoottorin testituloksia.

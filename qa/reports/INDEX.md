# QA-raporttien hakemisto

Pysyvä julkaisu-/QA-päätös kuuluu saman muutoksen PR-keskusteluun. Suuret ZIPit, testikuvat ja lokit GitHub Actions -artefakteihin, eivät Git-historiaan.

| Kohde | Testattu SHA | Varmennettu raportti | Päätös |
|---|---|---|---|
| [LAB v1.2 PR #15](https://github.com/naatti21/appeja-import-engine/pull/15) | 7dc4e6b19f30c0e6e20469fd7fa84b2816832d96 | [QA-kommentti](https://github.com/naatti21/appeja-import-engine/pull/15#issuecomment-6169913073), [real OCR run](https://github.com/naatti21/appeja-import-engine/actions/runs/38574581070) | Automaattinen kehittäjä-QA PASS; riippumaton NOT RUN; NO-GO |
| LAB v1.3 — ulkoisen QA-korpuksen vastaanotto | Ei testattavaa v1.3 SHA:ta | [Varmennettu vastaanottoraportti](./V1_3_CORPUS_INTAKE.md); alkuperäinen ZIP on keskustelussa, **ei GitHubissa** | 60/60 tapausta, 300/300 tiedostotarkistetta, harness 11/11; moottorin QA NOT RUN / NO-GO |

Menettelytapa: [QA_ARCHIVE.md](../../QA_ARCHIVE.md). Agentin lomake: [HANDOFF_TEMPLATE.md](../HANDOFF_TEMPLATE.md).

Uudet vahvistetut QA-tulokset lisätään tähän **vain** jos niiden linkki ja tarkka SHA on tiedossa. Virheitä tai jo vanhentuneita ZIP-linkkejä ei väitetä toimiviksi.

Generoitujen QA-korpusten **vahvistetut ajot** kirjataan tänne vasta, kun Actions on todellisuudessa luonut ladattavan ZIPin ja sen SHA/raportti on tarkistettu. [Generointiohje](../../QA_CORPUS_GENERATOR.md).

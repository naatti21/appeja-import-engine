# QA-raporttien hakemisto

Pysyvä julkaisu-/QA-päätös kuuluu saman muutoksen PR-keskusteluun. Suuret ZIPit, testikuvat ja lokit GitHub Actions -artefakteihin, eivät Git-historiaan.

| Kohde | Testattu SHA | Varmennettu raportti | Päätös |
|---|---|---|---|
| [LAB v1.2 PR #15](https://github.com/naatti21/appeja-import-engine/pull/15) | 7dc4e6b19f30c0e6e20469fd7fa84b2816832d96 | [QA-kommentti](https://github.com/naatti21/appeja-import-engine/pull/15#issuecomment-6169913073), [real OCR run](https://github.com/naatti21/appeja-import-engine/actions/runs/38574581070) | Automaattinen kehittäjä-QA PASS; riippumaton NOT RUN; NO-GO |
| LAB v1.3 (kandidaattia ei vielä lukittu) | Ei SHA:ta | 60 salkkua / 300 tiedostoa ja 11/11 harness mainittu käyttäjän näyttökuvassa; GitHub-ZIP ei varmennettu | varsinainen QA NOT RUN / NO-GO |

Menettelytapa: [QA_ARCHIVE.md](../../QA_ARCHIVE.md). Agentin lomake: [HANDOFF_TEMPLATE.md](../HANDOFF_TEMPLATE.md).

Uudet vahvistetut QA-tulokset lisätään tähän **vain** jos niiden linkki ja tarkka SHA on tiedossa. Virheitä tai jo vanhentuneita ZIP-linkkejä ei väitetä toimiviksi.
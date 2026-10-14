# QA-agentin vakiomuotoinen PR-kommentti

PR / moduuli: <linkki>
Testattu SHA: <40 hex merkin tarkka SHA>
Ympäristö, aika: <UTC ja käytetyt versiot>
QA-taso: developer-automated / erillinen riippumaton / NOT RUN

| Testikerros | Toteutunut näyttö | Tulos |
|---|---|---|
| Node | määrä / oikeat oracle-arvot | PASS/FAIL/NOT RUN |
| Real Chromium / PDF.js | määrä / URL | PASS/FAIL/NOT RUN |
| Pixel OCR ja TSV | erotettava toisistaan | PASS/FAIL/NOT RUN |
| Fyysinen mobiili, offline, tallennus & reload | ympäristö | PASS/FAIL/NOT RUN |
| Riippumaton QA | arvioinnin lähde | PASS/FAIL/NOT RUN |

Actions-ajo: <GitHub URL>
ZIP-artifakti: <Actions artifactin NIMI ja URL>; säilytys <N> päivää
Manifestin SHA ja logien SHA256: <tarkistettu>

Löydökset: vakavuus, seed, toisto, odotettu vs saatu, kenttä ja lähdehavainto. Merkitse erikseen väärät hyväksynnät, hylkäykset ja puuttuva näyttö.
Yksityisyys: ei oikeita tilitietoja, dokumentteja, kuvia tai raakaa OCR-dataa julkisessa GitHubissa.
Lopullinen päätös ja perustelut: GO/NO-GO. Tuotantoon ei siirry mitään ilman käyttäjän nimenomaista hyväksyntää.

Tämän raportin julkaiseminen samaan PR:ään on osa QA-agentin tehtävää, ei käyttäjän manuaalinen tiedostonsiirtotyö.
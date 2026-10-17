# Shared Review Draft v1 — eristetty tutkimusrajapinta

**Tila:** LAB-kandidaatti, ei sovellusintegraatio tai julkaisulupa. Koskee yhteisen Import Enginen tilapäistä esikatselua sekä Osakevahdin ja Palkan sovelluskohtaisia tulkitsijoita.

## Tarkka tavoite

Yksi ratkaisu seuraavaan yhteiseen ongelmaan: tunnistetut kenttäarvot on pystyttävä näyttämään puhelimessa alkuperäisen lähteensä rinnalla, käyttäjän on voitava korjata ehdotus, ja korjaus ei saa muuttaa alkuperäistä havaintoa tai muuttua hiljaiseksi tallennusluvaksi.

`src/review-draft.mjs` tarjoaa neljä puhdasta toimintoa:

1. `createReviewDraft({documentType,source,records,adapterProblems})`: tuottaa aina `review-required`, `canPersist:false`, `ephemeral:true`. Lähteen on oltava Enginen `evidenceFrom*()`-tyyppinen schemaVersion 1 -havaintokuori. Jokaisen kentän `sourceIds` tarkistetaan ja virheet näytetään `problems`-listalla.
2. `reviewFieldSources(draft,recordId,fieldName)`: palauttaa vain valitun kentän alkuperäiset havainnot tarkistusnäkymään; mukana ovat teksti ja mahdolliset koordinaatit.
3. `correctReviewField(draft,{recordId,fieldName,value,confirmed:true})`: vaatii eksplisiittisen käyttäjätoimen, tallentaa alkuperäisen ehdotuksen rinnalle, ei muuta lähdehavaintoja eikä anna tallennusoikeutta.
4. `reviewDiagnostics(draft)`: tuottaa vain lukumääräpohjaisen diagnostiikan. Ei nimiä, summia eikä raakaa OCR/PDF-tekstiä.

**Esityskerros** saa pitää koko draftin vain muistissa. Se sisältää lähdetekstin, joten sitä ei saa sellaisenaan kirjoittaa localStorageen, IndexedDB:hen, pilveen, lokiin, GitHub Actions -artefaktiin tai varmuuskopioon. Vain sovelluskohtaisen turvallisuusportin läpäissyt, nimenomaisesti hyväksytty kanoninen tietue saa mennä pysyvään dataan.

**Ei yritetä tehdä yleisestä Enginestä palkka- tai pörssiasiantuntijaa.** Palkka ratkaisee palkkakauden, bruton, neton, kertymän ja eri palkkalajien semantiikan. Osakevahti ratkaisee instrumentin identiteetin, listauksen, tilin, määrän ja hinnan. Kumpikaan ei saa tulkita `candidate`-tilaa tallennusluvaksi.

## Todentaminen

`node --test tests/review-draft.test.mjs` testaa kahden toimialan välisen neutraalin rajapinnan, aiempien oikeiden LAB `evidenceFromDelimited`, `evidenceFromPdfLayout` ja `parseHoldingsCsv` -funktioiden yhteensopivuuden, puuttuvan/valheellisen lähdeviitteen, käyttäjän korjauksen, duplikaatit sekä diagnostiikan tietosuojan. Kaikki aineisto on keksittyä.

## Jäljelle jäävät työt

- Yhdistetään vain erillisessä testisovelluksessa mobiilin esikatseluun, ei tuotantoon. Testataan tyhjät/ristiriitaiset arvot ja näytetään alkuperäinen havainto ilman raakasisällön pysyvää säilytystä.
- Todennetaan molemmat todelliset sovellusadapterit ja niiden omat tallennusportit erikseen; uusi moduuli **ei korvaa** niiden hyväksyntää.
- Fyysisen Androidin käytettävyys ja alkuperäisen käyttäjälähteen käsittely tehdään yksityisesti, ilman aineiston tallentamista avoimeen GitHubiin.
- Riippumaton QA ja käyttäjän lupa ennen mergeä tai sovellusjulkaisua.

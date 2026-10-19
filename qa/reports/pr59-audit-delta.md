# PR #59 — Work-auditoinnin P2- ja listing-sopimuskorjaus

Työmääritys: https://github.com/naatti21/appeja-import-engine/pull/59#issuecomment-6260513433
Lähtö: `230da387c268b957770bc2d22dd693106727ef86`, varmennettu PR #59:n headista.
Haara: `fix/pr59-lookup-race-contracts`; Draft PR:n kohde `fix/issue55-mobile-identity-review`.
PR #59:n auditoitua committia ei muuteta. **Ei tuotantohyväksyntää eikä P0 #55:n sulkemista.**

## AIE59-P2-01: toisto ja korjaus

Uusi todellinen PNG→paikallinen `fin+eng`/`eng` Tesseract→360 px UI -koe vahvisti:
käyttäjä korjaa rivin 1, käynnistää viivästetyn haun ja sulkee rivin 2 pois.
Vanha vastaus hylätään oikein, mutta uuden revision hakupainike jää lukkoon.
Ennen korjausta kilpailutilanteiden sarja: 1 FAIL / 2 PASS (peruutus ja uusi kuva läpäisivät).

Korjaus poistaa päättyneen haun busy-tilan ja päivittää vain nykyisen rivin hakupainikkeen.
Vanhan revision tulos pysyy hylättynä. Koko käyttöliittymää ei renderöidä uudelleen
vanhalla vastauksella, jolloin toisen rivin päätös, keskeneräinen lomake ja fokus säilyvät.
Eri tiedoston/perutun operaation valmistuminen ei koske nykyiseen käyttöliittymään.
Ei aikakatkaisua eikä revision tarkistuksen poistamista.

Regressiokoe varmistaa painikkeen vapautumisen, uuden toimivan haun, toisen rivin
poissulun säilymisen ja kolmannen rivin keskeneräisen tekstin/fokuksen säilymisen
vanhan vastauksen valmistuessa. Erilliset cancel/new-file-haarat ja kaksoispainallukset
varmistavat, ettei vanha vastaus palauta kuvan valintoja tai tuota ylimääräisiä kutsuja.

## Kolmen nimetyn listing-testin migraatio

Tämä on tarkoituksellinen julkisen API-sopimuksen migraatio, ei muokkausvallan palautus.
Testien nimet säilyvät; kuhunkin sisältyy sekä tiukka negatiivinen että oikean
`chooseInstrumentIdentity`-polun positiivinen tapaus.

1. Väärin kirjoitettu nimi: muokatun JSON-kopion käyttö → 0 adapterikutsua; aito
   käyttäjäkorjaus → täsmälleen korjattu nimi adapterille, läheistä nimeä ei korvata.
2. Sama nimi: suoraan muutettu valinta hylätään kokonaan; kaksi erillistä aitoa valintaa
   samalla nimellä → 1 yhdistetty haku, 2 tulosta ja eri alkuperäiset lähdetunnukset.
3. Virheellinen lähde/listaus: rekisteröidyn hyväksynnän tai lähdeviitteiden muutos →
   0 kutsua. Ennen review-valmistelua vioitettu yksi raw-rivi karanteeniin; 4 riippumatonta
   käyttäjän valitsemaa riviä edelleen haettavissa. Kelvollinen fake-vastaus tuottaa 4
   varmentamatonta ehdotusta, puuttuva markkinapaikka tai väärä skeema ei varmennu.

`src/portfolio-identity-review.mjs`, `src/portfolio-instrument-listings.mjs` ja niiden
rekisteröinti-/fingerprint-rajat pysyvät muuttumattomina. Ei hyväksyntävaatimusten löysennystä.

## QA ja rajat

Kohdennettu Node: 31 testiä (12 listing + 14 session + 5 identity).
Listing-migraatio palauttaa 3 testiä: koko Node 267 PASS / 29 FAIL → 270 PASS / 26 FAIL.
Jäljelle jäävät 24 aiempaa epäonnistumista sekä 2 alkuperäistä raw-P0 #55 RED-orakkelia.
Niitä tai alkuperäisiä PNG-orakkeleita ei muuteta.

Mobiilin kohdesarja sisältää aiemmat 4 koetta ja 3 uutta kilpailutilannetta.
CI:n push/PR-haararajaukseen lisätään vain uusi kehityshaara ja tämän työn oikea kohdehaara.
Työnkulku säilyttää perityn RED-sarjan aidon epäonnistuvan lopputilan.
Lopullisen SHA:n ajot, artefaktit ja mahdolliset ympäristörajoitukset raportoidaan luovutuksessa.

```
node --test tests/portfolio-instrument-listings.test.mjs tests/issue55-session-boundary.test.mjs tests/issue55-identity-review.test.mjs
npm test
REAL_OCR_QA=1 npx playwright test issue55-mobile-identity.spec.mjs
QA_CORPUS_READY=1 REAL_OCR_QA=1 npx playwright test
```

Vain fiktiivisiä kuvia ja injektoitu paikallinen fake-resolver. `canPersist:false` säilyy;
valinta ei varmista instrumenttia eikä anna tallennuslupaa. Ei live-palvelua, oikeita
salkkuja, tuotanto-/LAB-julkaisua, mergeä, Palkka-/Osakevahti- tai PR #54 -muutoksia.
Raaka extractor voi edelleen ehdottaa Growth bucket -otsikkoa puuttuvan nimen sijaan.
Fyysistä Android-käyttäjätestiä ei ole tehty. Muutos annetaan uudelleen riippumattomaan
Work-tarkastukseen ennen mahdollista rajattua yksityistä synteettisten kuvien puhelintestiä.

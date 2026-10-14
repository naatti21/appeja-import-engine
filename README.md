# QA-arkisto ja ZIP-paketit — Import Engine LAB

Äppejä Playbook v1.9.2 (§20) määrää GitHubin yhteiseksi QA-keskukseksi. Tämä on käytössä myös Osakevahdin ja Palkan GitHub Actions -artefakteissa.

## Pysyvät paikat

- **PR-keskustelu** on ensisijainen pysyvä QA-tilannekuva: testattu commit-SHA, CI-linkit, viat, PASS/FAIL/PARTIAL/NOT RUN, GO/NO-GO.
- **qa/reports/INDEX.md** on raporteista ja todellisista Actions-ajoista koostuva hakemisto. Käytä lyhyitä raportteja, älä toistuvia suuria tiedostoja.
- **GitHub Actions > kyseinen run > Artifacts** tarjoaa automaattisesti ladattavan ZIPin. Siinä ovat qa-output/report.md, manifest.json, logit ja mahdolliset virhekuvat / trace. Oletussäilytys 14 päivää; myös repon asetukset voivat rajoittaa säilytystä.
- **tests/** sisältää pienet täysin synteettiset ja koneellisesti ajettavat fixturet. Suuret ZIP-korpukset ja toistuvat lokit eivät kuulu Git-historiaan.
- **Alkuperäiset henkilökohtaiset pankki- tai palkkatiedostot, tunnisteet, kuvakaappaukset ja niiden OCR-raakatulokset eivät kuulu julkiseen GitHub-repoon eivätkä Actions-artefakteihin.**

## QA-agentille / Workille

1. Lue Playbook, tämä tiedosto, qa/HANDOFF_TEMPLATE.md ja tutkittavan PR:n handoff.
2. Lukitse todellinen testattu 40-merkkinen SHA. Jos v1.3-versiota tai sovelluksen kandidaatti-SHA:ta ei ole, merkitse varsinainen testaus NOT RUN eikä tee tekaistua hyväksyntää.
3. Aja oracle-, regressio- ja vastatestit vain täysin synteettisillä syötteillä. Raportoi seed, odotettu vs saatu ja toisto-ohje.
4. Tarkista QA ZIP Actions-ajon Artifacts-osiosta; artefaktin sisällä manifestissa on oikeasti testattu git-SHA, lopputulos ja lokien SHA-256.
5. Tee erillinen lyhyt QA-kommentti samaan PR:ään; lisää ZIP-artifaktin linkki ja säilytysaika, testikerrokset ja todelliset PASS/FAIL/NOT RUN, vakavuus sekä GO/NO-GO.
6. QA ei muuta testattavaa sovelluskoodia eikä hyväksymiskynnyksiä, ei tee mergeä, tuotantodeployta tai väitä omia automaattitestejä riippumattomaksi QA:ksi.
7. Jos suuri 60 salkun / 300 tiedoston ZIP on vain toisen agentin työtilassa, sitä ei saa ilmoittaa GitHubissa arkistoiduksi ennen vahvistettua siirtoa. Käyttäjä ei toimi oletusarvoisesti tiedostokuriirina.

## ZIPin löytäminen

Avaa https://github.com/naatti21/appeja-import-engine/actions → oikean SHA:n Workflow run → Artifacts → lataa QA-alkuinen ZIP. Manifestin tarkistus kertoo, että katsot oikean commitin tuloksia. Artefaktit vanhenevat: pysyvä raportti ja päätös jäävät PR-kommenttiin.

Kun erilliselle pitkäikäiselle suurelle QA-korpukselle tarvitaan säilytyspaikka, päätetään käyttäjän kanssa ensin yksityinen tallennusratkaisu. Julkiseen Git-historiaan niitä ei siirretä.

## Tila 14.10.2026

- LAB v1.2, PR #15, SHA 7dc4e6b19f30c0e6e20469fd7fa84b2816832d96: kehittäjä-CI PASS, riippumaton QA NOT RUN, tuotanto NO-GO.
- LAB v1.3 -QA-agentin ilmoittamat 60 synteettistä salkkua ja 300 tiedostoa: kyseessä oli harness-valmistelu. Varsinainen QA oli NOT RUN, ja kuvassa esitetyn ZIPin GitHub-arkistointia ei ole varmennettu.
- QA-arkiston infrastruktuuri tehdään erillisessä Draft PR:ssä, joka ei muuta v1.2:n testattua sovelluskoodia.

## Ulkoisen QA:n korpuksen uudelleengenerointi

[Ohje ja rajaukset](./QA_CORPUS_GENERATOR.md) · [QA-arkisto](./QA_ARCHIVE.md). Oma Actions-työnkulku luo 60 synteettistä salkkua, 300 oikeaa lähdetiedostoa, oraakkelit ja lähdeviitteet ZIP-artifaktiksi ilman, että alkuperäinen käyttäjän ZIP tai tuotantodata tuodaan repoarkistoon. Korpusgenerointi ei ole LAB v1.3 -tuontimoottorin QA eikä tuotantohyväksyntä.


## LAB v1.3 — omistusrivien sijaintitulkinta

[Lue testiscope](./V1_3_POSITIONAL_HOLDINGS_QA.md). PDF- ja OCR-havaintojen riviyhdistäminen, lähdeviitteet ja ihmisen tarkistus. 60 aidon synteettisen PDF:n riippumaton oracle-testi; kuva-OCR→riveiksi-vaiheen täysi hyväksyntä edelleen erillinen portti. Tuotantointegraatio NO-GO.

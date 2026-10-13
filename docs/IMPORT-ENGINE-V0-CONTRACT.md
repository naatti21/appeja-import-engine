# Äppejä Import Engine — v0 rajapinta- ja laadunvarmistusluonnos

**Tila:** suunnitteluehdotus, ei julkaistu kirjasto tai sovittu tuotepäätös. Lähteenä Osakevahdin synteettiset Android-, OCR-, tunniste-, varmuuskopio-, valuaatio- ja datan eheystestit 13.10.2026. Yleistys muihin sovelluksiin on **ehdotus**, ei jo toteutettu toiminto.

## Erota moottori käyttävästä sovelluksesta

Yleinen core käsittelee epäluotettavia syötteitä, taulukkorivejä, tunnisteiden ehdotuksia, kenttien todistettavaa alkuperää sekä kaksivaiheista hyväksyntää. Core ei tiedä mikä on osake, pankki, markkinahinta, ostohinta, CNC-työ tai yksittäisen sovelluksen localStorage-avain.

- `SourceAdapter`: CSV/TSV, leikepöydän taulukko, sovelluksen backup-JSON. OCR/kamera antaa saman syöterivin `rawCells` ja epävarmuusmerkinnät erillisen adapterin kautta; coreen ei sidota tunnistusmallia.
- `SchemaAdapter<T>`: sovelluskohtainen kenttäkartta, tyypit, valuutta-/mittayksikkörajoitukset, ehdolliset pakolliset kentät, identiteetti- ja yhdistämissäännöt. Osakevahdin ISIN/MIC/listausvaluutta, tilityyppi, broker ja rahasto/kaupankäyntipaikka kuuluvat tänne.
- `ImportPlan<T>`: täysin sarjoitettavissa oleva muutosesitys, jossa jokaiselle riville `create/update/skip/review/reject`, kenttäkohtainen provenienssi, ristiriitatunnukset, kandidaattilista ja arvioitu muutosten määrä.
- `PersistenceAdapter<T>`: sovelluksen omistama atominen tallennusrajapinta. Core ei itse kirjoita localStorageen, IndexedDB:hen eikä pilveen.

## V0:n ehdotettu API (ei vielä koodia)

```ts
type InputSource = { kind: "csv"|"tsv"|"paste"|"json"|"ocr"; bytesOrText: string };
type ParsedValue = {
  raw: string | null;
  normalized: unknown;
  certainty: "known"|"inferred"|"missing"|"conflict";
  sourceRow: number;
  warningCodes: string[];
};
type RowAction = "create"|"update"|"skip"|"review"|"reject";
type PlannedRow<T> = {
  sourceRow: number;
  candidate: Partial<T>;
  proposedAction: RowAction;
  targetId?: string;
  parsedFields: Record<string, ParsedValue>;
  reasons: string[];
};
type ImportPlan<T> = {
  schemaVersion: 1;
  existingSnapshotFingerprint: string;
  rows: PlannedRow<T>[];
  criticalIssues: string[];
};
function prepare<T>(
  input: InputSource,
  adapter: SchemaAdapter<T>,
  existingSnapshot: readonly T[]
): Promise<ImportPlan<T>>;
function commit<T>(
  approvedPlan: ImportPlan<T>,
  storage: PersistenceAdapter<T>
): Promise<{ ok: true; imported: number; updated: number }>;
```

Nämä ovat *suunnittelurajapintoja*. Lopullinen nimi, versiointitapa ja pakettijako päätetään vasta ensimmäisten kuluttaja-appien tarpeiden perusteella.

## Ei-neuvoteltavat invariantit

1. **Prepare on aina read-only**; cancel ei kirjoita mitään. Jos yksi kriittinen kenttä ei kelpaa, `commit` ei tee osittaista tallennusta.
2. Syöttötekstin tyhjä, `null`, `0`, epätarkka OCR ja väärä numero erotellaan; epävarmasta arvosta ei tehdä oikealta näyttävää nollaa tai ykköstä. Kurssin/FX:n runtime-validointi kuuluu jatkossakin sovelluksen data-adapterille.
3. Identiteetissä saman niminen instrumentti, sama ticker eri MIC:llä tai eri tili eivät automaattisesti tarkoita samaa omistusta. Epävarma osuma vaatii tarkistuksen.
4. Ristiin ristiriidassa olevat valuutat, mittayksiköt, ISIN/MIC ja määrät merkitään, ei korjata hiljaisesti. Lähde- ja kenttäprovenienssi säilytetään.
5. Uusi import ei poista aikaisemman omistuksen kenttää vain siksi, että uudessa lähteessä sitä ei ollut. Eksplisiittinen nolla/tyhjä ja **puuttuva** kenttä ovat eri asioita.
6. Samalla aineistolla uusittu tuonti on idempotentti; käyttäjän erillisiä rivejä tai tilejä ei yhdistetä liian innokkaasti.
7. `commit` tarkistaa vanhan snapshotin sormenjäljen ennen kirjoitusta: samanaikainen muutos keskeyttää ja vaatii suunnitelman uudelleentarkistuksen.
8. Virheellinen backup ei saa koskaan tuhota alkuperäistä. Backupilla on skeemaversio; entisten kenttien ja migraation käsittely on testattua.
9. Vain välttämättömät käyttöoikeudet; sisältö pysyy laitteessa oletuksena. OCR-palvelu ja pilvitallennus ovat eksplisiittisiä lisäosia, eivät core-vaatimuksia.
10. UI voi tarjota ennakkotarkistuksen, hyväksymisen ja virheselitykset, mutta **komponentilla ei ole automaattisia osto-/myynti- tai muita domeenitoimia**.

## Testikortisto v0

| Testiryhmä | Suojattava invariantti |
|---|---|
| CSV/TSV erotin, lainausmerkit, otsikot | Ei siirtyneitä sarakkeita |
| fi-FI/en-US luvut ja tuhaterottimet | Ei hiljaista arvovirhettä |
| `NaN`, `Infinity`, epäkelvot negatiiviset syötteet | Tyypitys, hylkäys tai eksplisiittinen varoitus |
| OCR palstarikko, nimikatko, valuuttasekoitus | Kenttäkohtainen epävarmuus, ei auto-commit |
| Kaksi eri instrumenttia samalla tickerillä | Ei väärää yhdistämistä |
| Sama instrumentti eri tilityypillä | Ei tilien yhdistymistä |
| ISIN/MIC ristiriita ja puuttuva identiteetti | Review-tila, alkuperä talteen |
| Vanhan backupin migraatio | Ei omistusten määrän, identiteetin tai tilityypin vääristymistä |
| Import peruttu / validation fail | Vanhan snapshotin muuttumattomuus |
| Tallennus keskeytyy kesken | Atominen rollback / ei osittaisia kirjoituksia |
| Toistettu import | Idempotenssi, eikä erillisten oikeiden positioiden katoamista |
| Offline Android PWA | Tuonti ja peruutus ilman verkkopalveluriippuvuutta |
| Suurempi CSV, virheellinen encoding | Rajattu muistinkäyttö ja ymmärrettävä virhe |
| Cross-app-adapteri A/B | Sama core sopii kahteen erilaiseen skeemaan |

## Toteutusjärjestys

1. Määrittele `SchemaAdapter` ja fixturet **kahdelle erilliselle kuluttajalle** (toinen Osakevahti, toinen geneerinen varasto-/luettelomalli) todistaaksesi ettei core ole talousspesifi.
2. Kirjoita ensin synteettiset parseri-/normalisointi-/identiteetti-/transaktiotestit, sitten pieni JavaScript/TypeScript-pohjainen core.
3. Kytke rajapinta ensin Osakevahdin **erilliseen Alpha/koehaaraan** nykyisen tuontimoottorin rinnalle; kontrolloi idempotenssi, mobiili, offline, localStorage ja tarvittava varmuuskopioiden round-trip.
4. Julkaisuraja: mikään työ tästä reposta ei saa automaattisesti muuttaa Osakevahdin `main`-haaraa tai nykyistä PWA-julkaisua. Korjaus alkuperäiseen P1 FX-/quote-koodiin käsitellään erillisessä Osakevahdin PR:ssä.

## Ei sisälly v0:aan

Keskitetty käyttäjärekisteri, sisällön automaattinen lähetys AI:lle, piilotettu pilvisynkronointi, sovelluskohtaiset sijoituslaskurit, hinnoittelu, monimutkainen työnkulkueditori tai pakotettu kuukausimaksu.

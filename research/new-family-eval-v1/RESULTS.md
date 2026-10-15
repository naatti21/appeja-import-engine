# YÖAJO 14 — mitatut tulokset ja päätös (2026-10-15)

**Kriteerit: FAIL. Tutkimuskoodin regressiot: PASS. Tuotanto/merge/integraatio: NO-GO.**

Arvioinnin lähdekoodi ja annotaatiot jäädytettiin commitissa `9bfda19745928bcdaf929a105f7c8617a9856082`. Käytetyn 12 perheen / 36 dokumenttiversion SHA-256 on `e4debd6d486019fb44f792b256a024e0897fe8742c81fd5dac10aaea1ee615af`. Suunnitelman ja mittareiden ennakkolukitus tehtiin jo `89d20bd49bbdab27c7d8f79d61ed279c33050f56`:ssä.

## Jäädytetyn mittauksen tulokset

| Mittari | Numerokeskeinen v1 | Tekstilähteet huomioiva v2 | Tutkimuskriteeri |
|---|---:|---:|---|
| Olennaiset lähde-ID:t, joilla kohdistettu varoitus | 36/36 (100 %) | 36/36 (100 %) | **PASS**, vaatimus 100 % |
| Harmittomat lähde-ID:t, joille turha varoitus | 66/72 (91,7 %) | 72/72 (100 %) | **FAIL**, enintään 10 % |
| Turhaan review-required: benign-only-kuoret | 18/18 (100 %) | 18/18 (100 %) | **FAIL**, enintään 10 % |
| Source input -mutaatiot | 0 | 0 | PASS |
| `canPersist=true` | 0 | 0 | PASS |
| Täsmälliset uudelleen varoitetut ID:t | 102 | 108 | Varoitusmäärä ei ole laatutulos |

Kaikissa 36 testissä on yksi ennalta todennetuksi *simuloitu* lähdearvo, 12 erilaista dokumenttiperhettä ja kolme rakenteellista varianttia perhe. Perhetyyppejä on kuusi harmitonta ja kuusi essential-tietoja sisältävää; perheitä ei pidä käsitellä 36 riippumattomana luonnollisena asiakirjana. v1 ja v2 arvioitiin täsmälleen samalla uudella aineistolla, niitä **ei** kirjoitettu uudelleen. YÖAJO 13:n sarake-/kontekstikerros pidetään erillään: sen `canAutoAccept=false`, `canPersist=false` eivät sovellu kilpailevaksi hyväksyntäasteeksi.

**Tulkinta:** Tässä valitussa uudessa, tarkoituksella hallinnollista proosaa ja numerollista metatietoa sisältävässä tutkimusjoukossa kattavuusportin koko sitomattoman lähdetekstin varoittaminen estää lähes kaikki harmittomat tapaukset. Varoituskattavuuden 100 % saavutetaan erittäin suuren käyttäjätarkistuskuorman hinnalla. Tämä **ei** osoita virhettä jokaisessa oikeassa asiakirjassa eikä todista aiempaa YÖAJO 09:n aineistoa virheelliseksi. Sillä aiemmalla, erilaisella kokeella oli 5/20 = 25 % benign-document-false-block, joka oli jo FAIL.

## Todisteet

- [YÖAJO 14:n lukittu koeajo — GitHub Actions 38807346087](https://github.com/naatti21/appeja-import-engine/actions/runs/38807346087). Kolme kohdistettua Node-testiä PASS; `Y14_SUMMARY`-lokista yllä olevat aggregaatit. Kynnysten arviointivaihe tulosti **`Y14 RESEARCH THRESHOLDS FAIL`**, exit 1. Workflown yleistaso näkyy vihreänä, koska tutkimuskynnysvaihe on erikseen merkitty advisory-`continue-on-error`; tämä **EI** ole tutkimuksen GO.
- [GitHub Actions 38807346029](https://github.com/naatti21/appeja-import-engine/actions/runs/38807346029): koko Node-regressio **182/182 PASS**, Chromium **72 PASS, 1 SKIP**. Skippi on peritty OCR-resurssien valmisteluun liittyvä ehto, ei uusi Y14-skenaario. Browser-koodi ei tässä kierroksessa muuttunut, joten regressio ei todista uusien dokumenttiperheiden todellista PDF/OCR-ajoa.
- [14 päivän QA-artifact, `qa-yoajo14-38807346087-1`](https://github.com/naatti21/appeja-import-engine/actions/runs/38807346087/artifacts/12007685324). Sisältää kokonaiset perhedetaljit ja mittarit JSONissa, ajon SHA:n, tiivistelokin ja manifestin. GitHubin ilmoittama päättymisaika **2026-10-29 21:07:07 UTC**. Artefaktin listaus varmistettu; kaikkia sisäisiä tiedostoja ei tässä raportissa ole erikseen purettu tai validoitu.

## Mitä nyt kannattaa toteuttaa?

**Arkkitehtuurin päätös:** älä lisää vain uusia varoituksia äläkä tee yleistä “nuisance-sanat saa ohittaa” -sääntöä. Tarvitaan kaksi erillistä arviota ennen käyttäjän päätöstä: (A) onko lähde todistettavasti sidottu arvoon / otsikkoon / kontekstiin ja (B) onko jäljelle jäävä tekstilähde kriittinen finanssitieto, dokumenttityypin vaatima tieto, turvallisesti tunnistettu hallinnollinen metadata vai ratkaisematon. Tuntematonta rahaa ei saa vapauttaa arkistotekstin perusteella. Pelkkä `string contains digit` tai `unlinked text` ei riitä.

Ehdotettu YÖAJO 15: **rajattu, eksplisiittisiä lähderooleja ja konservatiivista metadata-luokittelua yhdistävä tutkimuskandidaatti**, ensin uusilla DEV-fixtureillä, sitten uudella *erikseen annotoidulla* HOLDOUT-joukolla eri arvioijalla. Mittaa samanaikaisesti essential-recall, turhat varoitukset, benign-document estot ja väärät hyväksynnät. Säilytä täsmälliset source-ID:t ja käyttäjän tarkistuspolku. Ei vanhan YÖAJO 14:n aineiston jälkikäteistä optimointia eikä vanhan YÖAJO 07/09 HOLDOUT/EVALin avaamista.

## Rajat / rehellinen QA-luokitus

Tämä on **saman kehittäjäagentin annotaatio- ja arviointityö**, eikä ulkopuolisesti riippumaton sokko-QA. Aineston lähteet ovat simuloituja havaintokuoria eivätkä aitoja PDF:ien tai valokuvien lukutuloksia. Yksittäinen jo todennettu lähdearvo eristää kattavuusportin; se ei vastaa oikean Palkan tai Osakevahdin kokonaista ydinvaatimuskenttien tunnistusta. Keinotekoisten tapausten valintaa ei pidä tulkita jakaumaksi luonnollisista asiakirjoista. UI-korjausaika, fyysinen Android, toimiva offline, todellinen käyttäjätestaus ja itsenäinen hyväksyntä **NOT RUN**. Mitään ei viedä tuotantoon.

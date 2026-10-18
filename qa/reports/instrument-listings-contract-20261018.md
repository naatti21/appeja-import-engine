# Instrumenttilistausten varmistus — tutkimusrajapinta

## Toteutus

`src/portfolio-instrument-listings.mjs` käyttää `extractVisualPortfolio(...)`-tuotteen **vain lähteeseen sidottuja instrumenttiehdokkaita**. Se ei tee OCR:ää, markkinakyselyjä eikä tallennuksia. `suggestInstrumentListings(...)` käyttää erikseen syötettyä `resolver({name})`-funktiota ja hyväksyy **Osakevahdin olemassa olevan** `instrument-resolver-v1`-vastemuodon.

Aktiivinen lähtötieto on vain havaittu nimi. Kappalemäärä, arvo, tili, lähdekuva, OCR, lähde-ID, geometria tai koko salkku eivät lähde resolverille. Instrumenttinimen lähettäminen ulkopuolelle on kuitenkin henkilötietosuojan kannalta huomioon otettava tapahtuma. Moduuli ei tee varsinaista HTTP-pyyntöä eikä sitä ole kytketty UI:hin.

Oletusarvo `lookupMode:'disabled'` ei kutsu mitään hakua. `lookupMode:'local'` toimii omilla synteettisillä/offline-tiedoilla. `lookupMode:'external'` edellyttää lisäksi `approvedExternalLookup:true` -arvoa nimenomaisesta tämän istunnon käyttäjäpäätöksestä. Sitä ei saa asettaa oletusarvoksi automaattisesti. Tämä lupa ei salli muun salkkutiedon lähettämistä.

## Miksi markkinavarmennus ei ole automaattinen?

Yahoo Financen hakutulos voi sisältää samannimisiä osakkeita eri listauksissa, lyhyitä nimiä, ETF:iä ja rahastoja. Siksi ehdotuksia muodostuu vain lähdenimen **täsmäävälle** nimelle ja oikealle tyypille; epäselvät listaukset pysyvät valintoina käyttäjälle. Yksi täsmäävä hakutulos tarkoittaa yhtä **ehdotusta**, ei todennettua omistusta. `selectInstrumentListing` vaatii eksplisiittisen valinnan ja palauttaa `canPersist:false`.

Salkun näyttövaluutta (esimerkiksi EUR) ei ole instrumentin kaupankäyntivaluutta (esimerkiksi USD). Näitä ei vaadita samoiksi. Laskennallinen summa-täsmäytys ei myöskään todista nimeä eikä symbolia.

## Tietosuoja: tuotantointegraatiota EI ole hyväksytty

Osakevahdin nykyinen Worker saa instrumentin nimen GET-kyselyparametrissa `/resolve?q=...` ja sen vastaus käyttää `Cache-Control: public, max-age=300`; Worker tekee Yahoo Finance -kyselyjä. Ennen oikeaa ulkoista käyttöönottoa on päätettävä käyttäjän informoinnista ja suostumuksesta, palvelimen sekä välimuistin lokitus- ja säilytyskäytännöistä ja siitä, muutetaanko kyselyn kuljetustapaa sekä välimuistiasetuksia. **Älä lähetä oikeita käyttäjäkohtaisia nimihakuja nykyiseen Workeriin tässä tutkimusvaiheessa.**

Mahdollinen nimikohtainen paikallinen hakuvälimuisti on erillinen tietosuojapäätös, eikä sitä toteutettu. Moduuli ei tallenna käyttäjän arvoja eikä markkinahakuvastauksia.

## Toteutusrajat

- Palkka ei muutu.
- Osakevahti (stable/Alpha) ei muutu.
- LAB-julkaisu ei muutu.
- Ei mergeä eikä julkaisua ilman käyttäjän lupaa.
- Kaikki testit käyttävät keksittyä markkinametatietoa eikä käyttäjän oikeaa kuvaa.

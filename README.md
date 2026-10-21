# Wiskunde — leeromgeving + beveiligd dashboard

De website is bedoeld voor GitHub Pages. `index.html` is publiek en `dashboard.html` is de beheerinterface. De leerstof wordt als afzonderlijke `.md`-bestanden opgeslagen in een Supabase Storage-bucket.

## Belangrijk over beveiliging

- GitHub Pages is alleen de hosting van de HTML/CSS/JS.
- Supabase Auth controleert wie inlogt.
- Supabase Storage policies (in `sql/setup.sql`) zijn de echte beveiliging: iedereen kan bestanden lezen, maar alleen het UUID-account dat je instelt mag bestanden toevoegen, wijzigen of verwijderen.
- Een verborgen dashboard of client-side wachtwoord alleen is geen echte beveiliging.
- Zet NOOIT een `service_role`- of secret key in `config.js`. Gebruik uitsluitend de publishable/anon key met de policies ingeschakeld.

## Eenmalige setup

### 1. Maak een Supabase-project

Ga naar https://supabase.com en maak een project aan. Bewaar de projectgegevens veilig.

### 2. Maak jouw beheeraccount

In Supabase: **Authentication → Users → Add user**. Maak zelf één gebruiker aan met je e-mailadres en een sterk, uniek wachtwoord. Zet openbare registratie/sign-ups uit als die optie actief staat; voeg geen publieke registratieknop toe aan de website.

Kopieer de UUID van deze gebruiker.

### 3. Stel de Storage-beveiliging in

1. Open `sql/setup.sql`.
2. Vervang `VUL-HIER-JE-ADMIN-USER-UUID-IN` op alle plaatsen door jouw Auth user UUID.
3. Open **SQL Editor** in Supabase en voer het script uit.
4. Controleer onder **Storage** dat de bucket `leerstof` bestaat en publiek leesbaar is. De bucket moet publiek zijn om de leerstof zonder login te tonen; de policies beperken schrijven nog steeds tot jouw UUID.

### 4. Stel de website in

1. Kopieer `config.example.js` naar een nieuw bestand `config.js`.
2. Vul `SUPABASE_URL` en `SUPABASE_ANON_KEY` in met de URL en publishable/anon key van je Supabase-project.
3. Upload `config.js` samen met de andere websitebestanden. Het is normaal dat de project-URL en publishable/anon key in de browser zichtbaar zijn: de database- en Storage-policies moeten de toegang beveiligen.
4. Controleer dat je nooit een `service_role`- of secret key uploadt.

### 5. Publiceer met GitHub Pages

Upload de inhoud van deze map naar de root van je repository `wiskunde`. Ga naar **Settings → Pages** en kies de `main`-branch en root-map. GitHub publiceert dan je `index.html`.

### 6. Test de rechten

- Open `index.html` in een privévenster: leerstof moet leesbaar zijn zonder login.
- Open `dashboard.html`: zonder login mag je geen beheerscherm gebruiken.
- Log in met jouw account: toevoegen, wijzigen en verwijderen moet werken.
- Maak nooit een tweede gebruiker met beheerrechten. Test eventueel met een apart testaccount dat geen schrijfrechten heeft.

## Leerstof toevoegen en afbeeldingen gebruiken

Log in op `dashboard.html`, kies het boek, geef het hoofdstuk een titel en bestandsnaam en schrijf de inhoud. De editor heeft snelle opmaakknoppen en een voorbeeldweergave. Klik op **Voorbeeld tonen** om te controleren hoe je hoofdstuk eruitziet voordat je het opslaat.

### Afbeeldingen uploaden

1. Kies in de editor bij **Afbeelding toevoegen** een JPG-, PNG-, WebP- of GIF-bestand (maximaal 8 MB).
2. Vul een korte beschrijving in. Dit helpt ook leerlingen die een schermlezer gebruiken.
3. Klik op **Uploaden en invoegen**. De afbeelding wordt in de publieke Supabase-bucket bewaard en als Markdown in je tekst geplaatst.
4. Controleer het resultaat in de voorbeeldweergave en sla daarna het hoofdstuk op.

De SQL-policy geeft alleen het beheeraccount schrijfrechten in de bucket; afbeeldingen zijn, net als gepubliceerde leerstof, publiek leesbaar. Upload dus alleen afbeeldingen die je met je klas wilt delen. Een afbeelding die je niet meer gebruikt, kan je in Supabase Storage verwijderen onder `afbeeldingen/`.

Gebruik bijvoorbeeld:

```md
# Titel van het hoofdstuk

## Uitleg
Schrijf de uitleg hier.

## Formules
- Formule 1

## Uitgewerkt voorbeeld
1. Eerste stap
2. Tweede stap
```

Elk hoofdstuk wordt als een afzonderlijk Markdown-bestand in Supabase Storage bewaard. De metadata bovenaan elk bestand bepaalt het boek, de titel en de korte omschrijving.

## Let op

De voorbeeldbestanden in `leerstof/` moeten ook naar de Supabase Storage-bucket `leerstof` worden geüpload als je ze meteen wilt zien. De HTML-site leest de bestanden uit Supabase Storage, niet rechtstreeks uit de map in GitHub. Je kunt de vier voorbeeldbestanden uploaden via Storage → `leerstof` → Upload files.

De website gebruikt externe CDN's voor Supabase JS, Marked, DOMPurify en Google Fonts; bezoekers hebben internet nodig om alles te laden.

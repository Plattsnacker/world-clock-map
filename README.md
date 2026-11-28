# Weltzeit-Karte

*English version: [README_en.md](README_en.md)*

Browser-Erweiterung (Manifest V3) für Chrome und Firefox, die die Seite „Neuer Tab“ durch eine Weltkarte ersetzt. Die Karte zeigt die Tag-/Nacht-Grenze, den Sonnen- und Mondstand und die aktuellen Uhrzeiten ausgewählter Städte und aller UTC-Zeitzonen.

![Neuer Tab mit Weltkarte, Tag/Nacht-Grenze und Städte-Uhrzeiten](docs/screenshot_1.png)

## Funktionen

- **Weltkarte im neuen Tab**: Länderumrisse auf einer Karte von 84° N bis 60° S. Die Antarktis ist abgeschnitten.
- **Tag/Nacht-Grenze**: Die Nachtseite wird abgedunkelt, mit weicher Dämmerung bis 12° unter dem Horizont.
- **Mittag in der Mitte (optional)**: Statt die Tag/Nacht-Grenze über die Karte wandern zu lassen, verschiebt sich die Karte selbst. Der Ort, an dem gerade 12 Uhr mittags ist (Sonnenhöchststand), steht dann immer in der Mitte. Städte, Sonne, Mond, ISS, Erdbeben, Polarlichter und die Zeitzonenleiste wandern mit, am Rand läuft die Karte nahtlos weiter.
- **Sonne im Zenit (optional)**: Markiert den Punkt, an dem die Sonne gerade senkrecht steht (inklusive Zeitgleichung). Beim Überfahren mit der Maus erscheint ein Tooltip.
- **Mond mit Mondphase (optional)**: Markiert den Punkt, an dem der Mond gerade im Zenit steht. Die Scheibe zeigt die aktuelle Phase, so wie sie von der Nordhalbkugel aus zu sehen ist (zunehmend = rechts hell). Beim Überfahren mit der Maus zeigt ein Tooltip den Namen der Phase (z. B. „Zunehmender Mond“) und den beleuchteten Anteil in Prozent.
- **ISS (optional)**: Zeigt die aktuelle Position der Internationalen Raumstation als kleines Symbol, dazu ihre Bahnspur: einen halben Umlauf zurück (blass) und einen Umlauf voraus (gestrichelt). Die Position wird alle 10 Sekunden aktualisiert. Beim Überfahren mit der Maus zeigt ein Tooltip Koordinaten und Bahnhöhe.
- **Erdbeben (optional)**: Markiert die Erdbeben der letzten 24 Stunden als rote Kreise, deren Größe mit der Stärke wächst. Die Kreise „atmen“ langsam, und von jedem läuft in Abständen von knapp 4 Sekunden eine blasse Welle nach außen, bei Beben der letzten Stunde zwei. Ältere Beben werden blasser. Bei der Systemeinstellung „Bewegung reduzieren“ bleiben die Markierungen statisch. Die Mindeststärke ist einstellbar (ab 2,5 bis ab 6,0, Standard ab 4,5). Beim Überfahren mit der Maus zeigt ein Tooltip Stärke, Region, Zeitpunkt, Koordinaten und Herdtiefe. Daten vom USGS, alle 10 Minuten aktualisiert.
- **Polarlichter (optional)**: Zeigt die Kurzfrist-Vorhersage (30–90 Minuten) des NOAA Space Weather Prediction Center (OVATION-Modell), wo Polarlicht zu sehen sein könnte, als weich gezeichnete Fläche: grün bei geringer, über gelb bis rot bei hoher Wahrscheinlichkeit. Beim Überfahren mit der Maus zeigt ein Tooltip die Wahrscheinlichkeit an dieser Stelle und den Vorhersagezeitpunkt; der Tooltip einer Stadt nennt sie ebenfalls, sofern sie über 0 % liegt. Alle 10 Minuten aktualisiert.
- **Tropische Wirbelstürme (optional)**: Zeigt aktive Hurrikane, Taifune und Zyklone weltweit mit einem Wirbel-Symbol an ihrer aktuellen Position, dazu die bisherige Zugbahn (durchgezogen), die Vorhersage (gestrichelt) und den Unsicherheitskegel. Die Farbe richtet sich nach der Stärke: blau Tropisches Tiefdruckgebiet, gelb Tropischer Sturm, orange Hurrikan/Taifun. Beim Überfahren mit der Maus zeigt ein Tooltip Name, Stärke, höchste Windgeschwindigkeit, Position und Stand der Daten. Ist gerade kein Sturm aktiv, steht das in der Legende. Daten vom [GDACS](https://www.gdacs.org/), alle 30 Minuten aktualisiert.
- **Gradnetz und Linien (optional)**: Blendet ein dezentes Gradnetz im Abstand von 30° ein, dazu beschriftete Linien für Äquator, Wendekreise, nördlichen Polarkreis und Datumsgrenze. Die Datumsgrenze folgt einem vereinfachten Verlauf (Beringstraße, Aleuten, Kiribati, Samoa/Tonga). Der südliche Polarkreis liegt außerhalb des Kartenausschnitts.
- **Städte mit Uhrzeit**: Jede ausgewählte Stadt bekommt ein Label mit Name und Ortszeit. Liegt die Stadt bereits an einem anderen Tag als du, steht zusätzlich der Wochentag dabei. Labels werden automatisch so platziert, dass sie sich möglichst nicht überlappen, bei Bedarf mit Hilfslinie.
- **Stadt-Infos im Tooltip**: Beim Überfahren einer Stadt (Punkt oder Label) mit der Maus zeigt ein Tooltip Breiten- und Längengrad sowie Sonnenaufgang, Sonnenuntergang und Tageslänge für den heutigen Tag, jeweils in Ortszeit. Nördlich bzw. südlich der Polarkreise steht dort gegebenenfalls „Polartag“ oder „Polarnacht“.
- **Landesflaggen (optional)**: Links neben dem Ortsnamen steht die Flagge des zugehörigen Landes. Für eigene Städte lässt sich das Land beim Anlegen auswählen.
- **Arbeitszeit (optional)**: Städte, in denen gerade übliche Bürozeit ist (werktags 9–17 Uhr Ortszeit), bekommen eine grüne Aktentasche neben der Uhrzeit; der Tooltip der Stadt sagt, ob dort gerade Arbeitszeit ist. In Ländern mit Wochenende am Freitag und Samstag (z. B. Saudi-Arabien, Israel, Ägypten) zählen Sonntag bis Donnerstag als Werktage, in Iran und Afghanistan Samstag bis Mittwoch. Feiertage werden nicht berücksichtigt.
- **Aktuelles Wetter (optional)**: Neben der Uhrzeit jeder Stadt stehen die aktuelle Temperatur (wahlweise in °C oder °F) und ein kleines Wettersymbol (klar, teils bewölkt, bewölkt, Nebel, Regen, Schnee, Gewitter; nachts mit Mond). Die Symbole übernehmen die Farben des aktiven Themes.
- **Eigene Zeitzone hervorgehoben**: Städte in deiner Zeitzone und der passende Zeitzonen-Streifen sind orange markiert.
- **Zeitzonenleiste**: Unter der Karte steht für jede Zone von UTC−12 bis UTC+12 die aktuelle Uhrzeit.
- **Kopfzeile**: Lokale Uhrzeit mit Sekunden, Datum, Zeitzonenname und UTC-Versatz.
- **Einstellungsseite**:
  - Zwölf Farb-Themes (Nacht, Hell, Atlas, Ozean, Abendrot, Terminal, Herbst, Hochkontrast, Rosé, Neon, Golden, Wiese) mit Vorschau
  - Eigenes Theme: alle Karten- und Oberflächenfarben sowie die Nachtintensität frei einstellbar
  - Auswahl aus 101 Städten, gruppiert nach Regionen (Nordamerika, Mittel- & Südamerika, Europa, Afrika, Asien, Ozeanien)
  - Sonne, Mond, ISS, Erdbeben (mit Mindeststärke), Polarlichter, Wirbelstürme, „Mittag in der Mitte“, Gradnetz, Landesflaggen, Arbeitszeit und Wetteranzeige einzeln ein- und ausschalten (Sonne und Mond sind standardmäßig an)
  - Uhrzeitformat: 24 Stunden (Standard) oder 12 Stunden mit AM/PM; gilt für Kopfzeile, Städte, Zeitzonenleiste und Sonnenzeiten
  - Temperatureinheit: °C (Standard) oder °F
  - Sprache: Deutsch (Standard), Dänisch, Englisch, Französisch, Italienisch, Kroatisch, Niederländisch, Schwedisch oder Spanisch; gilt für alle Texte auf Karte und Einstellungsseite, offene Tabs wechseln sofort. Ortsnamen stehen unabhängig davon in der jeweiligen Landessprache (z. B. „Lisboa“, „København“, „Ciudad de México“), bei nicht-lateinischer Schrift auf Englisch (z. B. „Tokyo“, „Moscow“, „Cairo“). Ländernamen, Datum und Wochentage folgen der gewählten Sprache.
  - Suche nach Stadt, Land oder Zeitzone
  - „Alle auswählen“, „Keine“ und „Standard“, auch einzeln pro Region
  - Eigene Städte mit Name, IANA-Zeitzone (z. B. `Europe/Berlin`), Land (optional, für die Flagge) und Koordinaten anlegen
  - Änderungen werden sofort gespeichert und in offenen Tabs übernommen.

## Installation

Die Erweiterung ist nicht im Chrome Web Store veröffentlicht und wird als entpackte Erweiterung geladen:

1. In Chrome `chrome://extensions` öffnen.
2. Oben rechts den **Entwicklermodus** einschalten.
3. Auf **Entpackte Erweiterung laden** klicken und diesen Ordner (`weltkarte`) auswählen.
4. Einen neuen Tab öffnen. Chrome fragt eventuell, ob die geänderte Seite „Neuer Tab“ beibehalten werden soll. Bestätige mit **Änderungen beibehalten**.

Nach Änderungen am Code auf `chrome://extensions` beim Eintrag „Weltzeit-Karte“ auf das Neu-laden-Symbol klicken.

Funktioniert auch in anderen Chromium-Browsern wie Microsoft Edge (`edge://extensions`) oder Brave.

Chrome zeigt beim Laden eventuell die Warnung „Unrecognized manifest key 'browser_specific_settings'“. Der Eintrag ist nur für Firefox gedacht, die Warnung kann ignoriert werden.

### Firefox

Benötigt Firefox 128 oder neuer. Ohne Signierung durch Mozilla lässt sich die Erweiterung in normalen Firefox-Versionen nur vorübergehend laden:

1. In Firefox `about:debugging#/runtime/this-firefox` öffnen.
2. Auf **Temporäres Add-on laden…** klicken und die Datei `manifest.json` in diesem Ordner auswählen.
3. Einen neuen Tab öffnen. Firefox fragt eventuell, ob die geänderte Seite „Neuer Tab“ beibehalten werden soll. Bestätige mit **Änderungen behalten**.

Das temporäre Add-on bleibt nur bis zum Beenden von Firefox installiert. Nach Änderungen am Code auf `about:debugging` beim Eintrag „Weltzeit-Karte“ auf **Neu laden** klicken.

Für eine dauerhafte Installation gibt es zwei Wege:

- **Signieren lassen**: Den Ordnerinhalt als ZIP packen (die Dateien direkt im ZIP, nicht in einem Unterordner) und auf [addons.mozilla.org](https://addons.mozilla.org/developers/) hochladen, entweder öffentlich oder als „selbst verteilt“ (unlisted). Die signierte `.xpi`-Datei lässt sich dann normal installieren.
- **Ohne Signatur**: In Firefox Developer Edition, Nightly oder ESR unter `about:config` den Wert `xpinstall.signatures.required` auf `false` setzen und die ZIP-Datei (umbenannt in `.xpi`) über `about:addons` → Zahnrad → **Add-on aus Datei installieren…** laden.

Die Add-on-ID `weltzeit-karte@plattsnacker` ist im Manifest fest eingetragen. Ohne feste ID würde Firefox bei jedem Laden eine neue vergeben, und die gespeicherten Einstellungen gingen verloren.

## Bedienung

- **Städte auswählen**: Auf das Zahnrad oben rechts im neuen Tab klicken, oder auf `chrome://extensions` → Weltzeit-Karte → **Details** → **Erweiterungsoptionen**.
- **Eigene Stadt hinzufügen**: Auf der Einstellungsseite unter „Eigene Städte“ Name, Zeitzone, Breiten- und Längengrad eintragen. Für die Zeitzone gibt es Vorschläge zum Auswählen. Koordinaten findest du z. B. per Rechtsklick in Google Maps.
- **Farbschema wählen**: Auf der Einstellungsseite unter „Farbschema“ ein Theme anklicken. Mit „Eigenes Theme“ öffnet sich ein Editor. Er startet mit den Farben des zuletzt gewählten Themes. Über „Farben übernehmen von“ kannst du jederzeit ein fertiges Theme als Ausgangspunkt laden.
- **Sonne und Mond ein- oder ausblenden**: Auf der Einstellungsseite unter „Anzeige“ die Häkchen bei „Sonne anzeigen“ bzw. „Mond anzeigen“ setzen oder entfernen. Die Tag/Nacht-Grenze bleibt immer sichtbar.
- **ISS anzeigen**: Auf der Einstellungsseite unter „Anzeige“ das Häkchen bei „ISS anzeigen“ setzen. Die Bahndaten werden beim Öffnen eines Tabs geladen und alle 6 Stunden erneuert. Ohne Internetverbindung werden zwischengespeicherte Bahndaten bis zu einer Woche weiterverwendet, danach wird die ISS ausgeblendet.
- **Landesflaggen anzeigen**: Auf der Einstellungsseite unter „Anzeige“ das Häkchen bei „Landesflaggen anzeigen“ setzen. Die Flaggen sind lokal in der Erweiterung enthalten, es wird nichts nachgeladen.
- **Wetter anzeigen**: Auf der Einstellungsseite unter „Anzeige“ das Häkchen bei „Aktuelles Wetter anzeigen“ setzen. Die Wetterdaten werden beim Öffnen eines Tabs geladen und alle 15 Minuten aktualisiert. Ohne Internetverbindung erscheinen die Labels einfach ohne Wetter.
- **Zurücksetzen**: „Standard“ stellt die 31 vorausgewählten Städte wieder her. Eigene Städte bleiben erhalten, werden aber abgewählt.

## Berechtigungen und Datenschutz

| Berechtigung | Zweck |
| --- | --- |
| `storage` | Speichert die Städteauswahl, eigene Städte und Einstellungen in `chrome.storage.sync`. Mit aktivierter Chrome- bzw. Firefox-Synchronisierung sind sie auf allen deinen Geräten verfügbar. Wetterdaten, ISS-Bahndaten, Erdbebendaten, die Polarlicht-Vorhersage und die Wirbelsturmdaten werden in `chrome.storage.local` zwischengespeichert. |

Kartendaten, Städtekatalog und Berechnungen sind vollständig lokal. Solange Wetter, ISS, Erdbeben, Polarlichter und Wirbelstürme ausgeschaltet sind (Standard), lädt die Erweiterung nichts aus dem Internet und sendet keine Daten.

Mit eingeschalteter Wetteranzeige werden die Koordinaten der ausgewählten Städte (auf zwei Nachkommastellen gerundet) an die freie Wetter-API von [Open-Meteo](https://open-meteo.com/) gesendet. Es werden weder dein eigener Standort noch andere persönliche Daten übertragen, und es ist kein API-Schlüssel nötig. Die Ergebnisse werden 15 Minuten lang zwischengespeichert, damit nicht jeder neue Tab eine Anfrage auslöst. Die kostenlose Nutzung von Open-Meteo ist auf nicht-kommerzielle Zwecke beschränkt.

Mit eingeschalteter ISS-Anzeige lädt die Erweiterung höchstens alle 6 Stunden die aktuellen Bahnelemente (TLE) der ISS von [CelesTrak](https://celestrak.org/). Die Anfrage ist für alle Nutzer gleich und enthält keine Daten über dich oder deine Städte. Die Position der ISS wird daraus lokal berechnet.

Mit eingeschalteter Erdbebenanzeige lädt die Erweiterung höchstens alle 10 Minuten die Liste der Erdbeben der letzten 24 Stunden vom [USGS](https://earthquake.usgs.gov/earthquakes/feed/). Je nach gewählter Mindeststärke wird einer der öffentlichen Feeds abgefragt. Die Anfrage ist für alle Nutzer gleich und enthält keine Daten über dich oder deine Städte.

Mit eingeschalteter Polarlicht-Anzeige lädt die Erweiterung höchstens alle 10 Minuten die aktuelle Vorhersage vom [NOAA Space Weather Prediction Center](https://www.swpc.noaa.gov/products/aurora-30-minute-forecast). Auch diese Anfrage ist für alle Nutzer gleich und enthält keine Daten über dich oder deine Städte.

Mit eingeschalteter Wirbelsturm-Anzeige lädt die Erweiterung höchstens alle 30 Minuten die Liste der tropischen Wirbelstürme vom [Global Disaster Alert and Coordination System (GDACS)](https://www.gdacs.org/) der Vereinten Nationen und der EU-Kommission, für jeden aktiven Sturm zusätzlich dessen Zugbahn und Vorhersage. Auch diese Anfragen sind für alle Nutzer gleich und enthalten keine Daten über dich oder deine Städte.

## Projektstruktur

```
weltkarte/
├── LICENSE                    MIT-Lizenz
├── manifest.json              Manifest V3: ersetzt den neuen Tab, Einstellungsseite, Icons
├── newtab.html                Seite „Neuer Tab“
├── app.js                     Karte zeichnen (Canvas), Sonnen- und Mondstand, ISS, Nachtschatten, Labels, Zeitzonenleiste
├── style.css                  Styles für den neuen Tab
├── options.html               Einstellungsseite
├── options.js                 Städteauswahl, Suche, eigene Städte
├── options.css                Styles für die Einstellungsseite
├── i18n.js                    Übersetzungen (da, de, en, es, fr, hr, it, nl, sv) und Hilfsfunktionen für die Sprachumschaltung
├── cities.js                  Gemeinsam genutzt: Städtekatalog, Standardauswahl, Speicherzugriff, Flaggen-Hilfen
├── weather.js                 Wetterdaten von Open-Meteo laden und cachen, Wettersymbole zeichnen
├── iss.js                     ISS-Bahnelemente von CelesTrak laden und cachen, Position und Bahnspur berechnen
├── storms.js                  Tropische Wirbelstürme von GDACS laden, auf Zugbahn, Vorhersage und Unsicherheitskegel reduzieren und cachen
├── data/countries-110m.json   Länderumrisse als TopoJSON (Maßstab 1:110 Mio.)
├── flags/                     Landesflaggen als SVG (4:3) aus flag-icons, mit eigener MIT-Lizenz
├── docs/                      Screenshots für die README
└── icons/                     Icons in 16, 48 und 128 px
```

## Technische Details

- **Keine Abhängigkeiten, kein Build-Schritt**: Reines HTML, CSS und JavaScript.
- **Chrome und Firefox aus einer Codebasis**: Der Code nutzt den Namensraum `chrome.*`. Firefox stellt ihn in Manifest V3 ebenfalls bereit, auch mit Promises. Firefox-spezifisch ist nur der Block `browser_specific_settings` im Manifest (Add-on-ID, Mindestversion, Angabe zur Datenerhebung). Chrome ignoriert ihn.
- **Rendering**: Die Karte wird auf ein `<canvas>` in einfacher Plattkarten-Projektion gezeichnet und an die Pixeldichte des Bildschirms angepasst. Land, Grenzen und Zeitzonen-Streifen liegen in einer gecachten Basisebene. Nur Nachtschatten, Sonne, Mond, ISS und Städte werden neu gezeichnet.
- **Aktualisierung**: Die Uhr in der Kopfzeile läuft sekündlich, die Karte wird einmal pro Minute neu gezeichnet (mit eingeschalteter ISS alle 10 Sekunden) und zusätzlich, sobald der Tab wieder sichtbar wird.
- **TopoJSON**: Wird ohne Bibliothek direkt in `app.js` dekodiert. Polygone, die die Datumsgrenze überqueren (z. B. Russland, Fidschi), werden „abgewickelt“ und versetzt doppelt gezeichnet.
- **Wetter**: Alle Städte werden in einer einzigen Sammelanfrage an Open-Meteo abgefragt (`current=temperature_2m,weather_code,is_day`). Die WMO-Wettercodes werden auf sieben Symboltypen abgebildet, die direkt auf das Canvas gezeichnet werden. Open-Meteo erlaubt Anfragen von jeder Herkunft (CORS), deshalb braucht die Erweiterung keine zusätzliche Host-Berechtigung.
- **Mond**: Position und Phase werden mit den Hauptstörungstermen der Mondbahn (nach Meeus) berechnet, genau auf etwa ein Grad. Die Phase ergibt sich aus der Elongation zwischen Mond und Sonne.
- **ISS**: Aus den Bahnelementen (Two-Line Elements) wird die Position lokal berechnet: Kepler-Bahn mit den säkularen Störungen durch die Erdabplattung (J2) und dem Bahnabfall durch die Restatmosphäre, Umrechnung in geografische Koordinaten über die Sternzeit und das WGS84-Ellipsoid. Mit frischen Bahnelementen liegt die Abweichung zu einer vollständigen SGP4-Rechnung bei wenigen bis einigen zehn Kilometern, auf der Karte weniger als ein Pixel bis wenige Pixel. CelesTrak erlaubt Anfragen von jeder Herkunft (CORS), eine Host-Berechtigung ist nicht nötig.
- **Sprachen**: Alle Texte stehen in `i18n.js` (Objekt `STRINGS`, je Sprache ein Block mit denselben Schlüsseln). Statische Texte in den HTML-Seiten tragen `data-i18n`-Attribute, dynamische Texte holt der Code über `tr(key, params)`. Fehlt ein Schlüssel, wird Deutsch verwendet. Datum, Wochentage, Dezimaltrennzeichen und Ländernamen kommen über `Intl` passend zur Sprache.
- **Zeitzonen**: Alle Uhrzeiten kommen über `Intl.DateTimeFormat` aus der Zeitzonendatenbank des Browsers. Sommerzeit wird dadurch automatisch berücksichtigt.
- **Lokales Testen**: `newtab.html` und `options.html` lassen sich auch über einen einfachen lokalen Webserver ohne Erweiterungskontext öffnen. Die Einstellungen landen dann im `localStorage`. Ein direkter Aufruf über `file://` funktioniert nicht, weil der Browser dann `fetch()` für die Kartendaten blockiert.

  ```sh
  python -m http.server 8000
  # dann http://localhost:8000/newtab.html öffnen
  ```

### Städtekatalog erweitern

Neue Städte für alle Nutzer werden in `cities.js` im Array `CATALOG_RAW` ergänzt:

```js
// [Name, IANA-Zeitzone, Breite, Länge, Region-Index, Ländercode]
['Bremen', 'Europe/Berlin', 53.08, 8.80, 2, 'de'],
```

Den Namen in der Landessprache eintragen, bei nicht-lateinischer Schrift auf Englisch; Ortsnamen werden nicht übersetzt. Der Region-Index verweist auf das Array `REGIONS`, der Ländercode (ISO 3166-1 alpha-2, klein geschrieben) auf die Flagge in `flags/`. Die ID wird automatisch aus dem Namen erzeugt (z. B. `bremen`); ein optionales siebtes Feld legt sie ausdrücklich fest. Das ist bei umbenannten Städten nötig, damit gespeicherte Auswahlen erhalten bleiben (z. B. `Lisboa` mit der ID `lissabon`). Soll die Stadt standardmäßig ausgewählt sein, die ID zusätzlich in `DEFAULT_IDS` eintragen.

## Version

1.12.0

## Lizenz

Veröffentlicht unter der [MIT-Lizenz](LICENSE).

Die Flaggen in `flags/` stammen aus [flag-icons](https://github.com/lipis/flag-icons) (MIT-Lizenz, siehe `flags/LICENSE`).

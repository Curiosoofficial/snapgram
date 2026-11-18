# Snapgram

> **Tutorial-Projekt, nachgebaut nach JS Mastery.**
> Das Frontend habe ich 2023 nach dem Snapgram-Video-Tutorial von JavaScript Mastery nachgebaut (dort mit Appwrite als Backend).
> 2026 habe ich das Projekt überarbeitet: Fehler behoben, Pakete aktualisiert und ein **eigenes Backend** ergänzt (Vercel Functions + Postgres), das nicht Teil des Tutorials war. Dabei hat mich KI (Claude) unterstützt.

Snapgram ist eine Social-Media-App im Stil von Instagram. Man kann sich registrieren, Fotos mit Text, Ort und Tags posten, Posts liken und speichern, nach Posts suchen und das eigene Profil bearbeiten. Alle Besucher sehen dieselben Posts.

**Live-Demo:** [LIVE-LINK FOLGT] (geplant: `https://snapgram-curioso.vercel.app`)
**Demo-Login:** auf der Login-Seite «Continue with demo account» klicken oder `demo@snapgram.dev` / `demo1234` eingeben.
Die öffentliche Demo wird alle 24 Stunden auf die Beispieldaten zurückgesetzt.

## Funktionen

- Registrieren, Einloggen, Ausloggen; Seiten nur mit Login erreichbar
- Home-Feed mit den neusten Posts
- Post erstellen, bearbeiten und löschen, mit Bild-Upload per Drag & Drop
- Liken und Speichern, Seite «Saved» mit allen gespeicherten Posts
- Explore: Suche, Endlos-Scrollen (Infinite Scroll) und Filter *All / Following / Popular*
- Anderen Benutzern folgen, mit echten Follower- und Following-Zahlen auf dem Profil
- Profilseite mit eigenen und gelikten Posts, Profil und Profilbild bearbeiten
- Liste aller Benutzer («People») mit Follow-Knopf
- Responsive: Sidebar auf dem Desktop, Top- und Bottom-Bar auf dem Handy

## Stack

| Bereich | Technik |
| --- | --- |
| Frontend | React 18, TypeScript, Vite 5 |
| Styling | Tailwind CSS 3, shadcn/ui (Radix UI) |
| Daten laden und cachen | TanStack Query (React Query) v5 |
| Formulare | React Hook Form + Zod |
| Routing | React Router 6 |
| Backend | Vercel Functions (Node.js, TypeScript) im Ordner `/api` |
| Datenbank | PostgreSQL bei Neon (lokal: PGlite) |
| Hosting | Vercel |
| Alternativen | Appwrite (Original aus dem Tutorial) oder Offline-Demo im Browser |

## Architektur

```
Browser (React)
  └─ React-Query-Hooks (lib/react-query)
       └─ lib/api.ts  ── wählt EIN Backend:
            ├─ lib/rest/      → fetch("/api/…")  → Vercel Functions → Neon Postgres   (Live-Demo)
            ├─ lib/appwrite/  → Appwrite Cloud                                       (Tutorial-Original)
            └─ lib/demo/      → localStorage im Browser                              (Offline-Demo)
```

Die Komponenten wissen nicht, welches Backend antwortet. Alle drei Umsetzungen erfüllen denselben TypeScript-Typ `SnapgramApi`, und TypeScript meldet einen Fehler, sobald einer davon eine Funktion fehlt.
Welches Backend gebaut wird, entscheidet `vite.config.ts` automatisch: Mit `DATABASE_URL` (Neon) ist es das eigene Backend, mit Appwrite-Variablen Appwrite, ohne beides die Offline-Demo.

### Das eigene Backend (`/api`)

Jede Datei in `/api` ist auf Vercel eine eigene Serverless Function. Gemeinsamer Code liegt in `/api/_lib` (der Unterstrich bedeutet: keine eigene Route).

| Endpunkt | Methode | Zweck |
| --- | --- | --- |
| `/api/auth` | GET | eingeloggter Benutzer |
| `/api/auth?action=signup \| signin \| signout` | POST | Registrieren, Einloggen, Ausloggen |
| `/api/posts` | GET | Feed (`?list=explore&filter=all\|following\|popular&cursor=…`, `?search=…`, `?id=…`) |
| `/api/posts` | POST, PATCH, DELETE | Post erstellen, bearbeiten, löschen |
| `/api/likes` | POST | Like setzen oder entfernen |
| `/api/saves` | POST, DELETE | Post speichern oder entfernen |
| `/api/users` | GET, PATCH | Benutzer, Profil bearbeiten |
| `/api/follows` | POST | Benutzer folgen oder entfolgen |
| `/api/images?id=…` | GET | hochgeladenes Bild |
| `/api/health` | GET | Datenbank erreichbar? Nächster Reset? |

**Datenbank** (`api/_lib/schema.ts`): `users`, `sessions`, `posts`, `likes`, `saves`, `follows`, `images` und `meta`. Die Tabellen werden beim ersten Aufruf automatisch angelegt und mit Beispieldaten gefüllt, eine Migration von Hand ist nicht nötig.
Die API gibt dieselbe Datenform zurück wie Appwrite (`$id`, `$createdAt`, verknüpfte Daten wie `post.creator` und `post.likes` direkt dabei), deshalb musste am Frontend fast nichts geändert werden. Postgres baut das JSON selbst mit `json_build_object` und `json_agg`.

**Sicherheit, kurz erklärt:**

- Passwörter werden mit **scrypt** und einem zufälligen Salt pro Benutzer gehasht, nie im Klartext gespeichert.
- Login gibt ein zufälliges **Session-Token** zurück, das der Browser als `Authorization: Bearer …` mitschickt. In der Datenbank liegt nur der SHA-256-Hash des Tokens. Ausloggen löscht die Session auf dem Server.
- Ein Token statt Cookie, weil die App im Portfolio in einem iframe auf einer anderen Domain läuft, und dort blockieren Browser Third-Party-Cookies.
- Der Server prüft jede Eingabe neu (Länge, Format, E-Mail, Benutzername) und erlaubt Ändern und Löschen nur dem Besitzer.
- Likes: Der Server ändert nur den Like des eingeloggten Benutzers, nie die Likes anderer.
- E-Mail-Adressen, gelikte und gespeicherte Posts sieht nur der Benutzer selbst.
- Bilder: nur JPEG, PNG oder WebP bis 1.5 MB. Die ersten Bytes müssen zum Dateityp passen, SVG wird abgelehnt, weil es JavaScript enthalten kann. Ausgeliefert werden Bilder mit `Content-Security-Policy: sandbox`. Der Browser verkleinert Fotos vor dem Upload auf maximal 1080 px.
- Benutzereingaben gelangen nur über Platzhalter (`$1`, `$2`) in SQL, nie über zusammengesetzte Strings. Das verhindert SQL-Injection.
- Spam-Schutz für die öffentliche Demo: maximal 30 Posts pro Tag und Benutzer, und alle 24 Stunden ein Reset auf die Beispieldaten. Den Reset erledigt die erste Anfrage nach Ablauf der Zeit, ein Cron-Job ist nicht nötig.

**Bewusste Vereinfachungen:** Bilder liegen als Base64 in Postgres, damit nur ein Dienst nötig ist. Eine grössere App würde dafür einen Object Storage nutzen (S3, Vercel Blob). Das Session-Token liegt im `localStorage`, was bei einer XSS-Lücke auslesbar wäre. React escaped aber alle Ausgaben, und es wird nirgends HTML aus Benutzereingaben gerendert.

## Lokal starten

Voraussetzung: Node.js 18 oder neuer.

```bash
npm ci
npm run dev
```

Das startet Frontend **und** Backend. Ohne `DATABASE_URL` nutzt der Dev-Server **PGlite**, ein echtes Postgres als WebAssembly, das im Ordner `.data/` gespeichert wird. Es braucht also weder ein Konto noch eine Installation. Zum Zurücksetzen den Ordner `.data` löschen.

Weitere Befehle:

```bash
npm run build      # TypeScript prüfen (Frontend + API) und Produktions-Build erstellen
npm run typecheck  # nur TypeScript prüfen
npm run lint       # ESLint
```

## Deployment auf Vercel mit Neon

1. Repository in Vercel importieren (*Add New → Project*). Das Framework-Preset **Vite** wird erkannt.
2. Im Vercel-Projekt unter **Storage → Create Database → Neon** eine kostenlose Postgres-Datenbank anlegen, Region **Frankfurt** (`aws-eu-central-1`), und mit dem Projekt verbinden. Vercel setzt `DATABASE_URL` dann automatisch.
3. **Neu deployen**, damit der Build `DATABASE_URL` sieht und das eigene Backend wählt.
4. Testen: `https://<projekt>.vercel.app/api/health` sollte `{"ok":true,"database":"neon",…}` zeigen.

`vercel.json` legt die Functions in die Region Frankfurt (`fra1`), nahe bei der Datenbank, und leitet alle Seiten-Pfade (ausser `/api/…`) auf `index.html` um, damit React Router auch nach einem Neuladen funktioniert.
Neon legt die Datenbank nach 5 Minuten ohne Anfragen schlafen. Die erste Anfrage danach dauert deshalb etwas länger. Eine Regel, nach der Neon inaktive Gratis-Projekte löscht, habe ich nicht gefunden.

## Mit Appwrite betreiben (optional, wie im Tutorial)

Das Original-Backend aus dem Tutorial ist weiterhin eingebaut (`src/lib/appwrite`).
Das ursprüngliche Appwrite-Projekt wurde im November 2026 gelöscht: Appwrite pausiert Gratis-Projekte nach 7 Tagen ohne Aktivität in der Konsole und löscht sie nach 90 Tagen Pause. Deshalb nutzt die Live-Demo das eigene Backend.

<details>
<summary>Einrichtung von Appwrite</summary>

1. Projekt auf [Appwrite Cloud](https://cloud.appwrite.io) erstellen und eine **Web-Plattform** mit `localhost` und der Vercel-Domain hinzufügen (sonst blockiert Appwrite die Anfragen per CORS).
2. **Storage-Bucket**, Permissions: *Any* → Read (Bilder werden per `<img src>` ohne Login geladen), *Users* → Create, Update, Delete.
3. **Database** mit drei Collections, Permissions jeweils *Users* → Create, Read, Update, Delete:
   - **users:** `accountId` (String, Pflicht), `name` (String), `username` (String), `email` (Email, Pflicht), `bio` (String 2200), `imageId` (String), `imageUrl` (URL, Pflicht)
   - **posts:** `caption` (String 2200), `tags` (String-Array), `imageUrl` (URL, Pflicht), `imageId` (String, Pflicht), `location` (String), dazu ein **Fulltext-Index** auf `caption` für die Suche
   - **saves:** nur Beziehungen
   - **Beziehungen** (Two-way, On delete: Set NULL): `posts.creator` → users (Many to one, Gegenseite `posts`), `posts.likes` ↔ users (Many to many, Gegenseite `liked`), `saves.user` → users (Many to one, Gegenseite `save`), `saves.post` → posts (Many to one, Gegenseite `save`)
4. Die `VITE_APPWRITE_*`-Werte aus `.env.example` setzen (lokal in `.env.local`, auf Vercel als Environment Variables) und `VITE_BACKEND=appwrite`.

Folgen und die Explore-Filter *Following* und *Popular* gibt es mit Appwrite nicht, weil das Tutorial dafür keine Collection vorsieht. Die Knöpfe werden in diesem Modus ausgeblendet.

Die App nutzt das Appwrite Web SDK 13 aus dem Tutorial. Laut Appwrite behalten ältere SDKs das Verhalten, verknüpfte Dokumente automatisch mitzuladen. Neuere SDKs brauchen dafür `Query.select`. Getestet ist dieser Weg seit der Löschung nicht mehr.

</details>

## Überarbeitung 2026: was repariert wurde

- **Backend weg:** Das Appwrite-Projekt war gelöscht. Deshalb gibt es jetzt das eigene Backend und als Rückfallebene eine Offline-Demo.
- **Weisser Bildschirm ohne `.env`:** `client.setEndpoint(undefined)` warf beim Start einen Fehler.
- **Profilbild nie sichtbar:** Tippfehler `currentAccount.ImageUrl` statt `imageUrl` im AuthContext.
- **Login-Weiterleitung:** prüfte `localStorage` auf `"coockieFallback"` (Tippfehler) und funktionierte nur mit Appwrite. Jetzt schützt `RootLayout` die Seiten, und `AuthLayout` leitet eingeloggte Benutzer weiter (vorher fest auf `false`).
- **Löschen-Knopf ohne Funktion:** `handleDeletePost` war eine leere Funktion.
- **Bild-Upload schickte das Formular ab:** Ein `<button>` in einem `<form>` ist standardmässig `type="submit"`.
- **«Cancel» ohne Funktion**, **Ladeanzeige fehlte** (`a || b && 'Loading...'`: `&&` bindet stärker als `||`), neuer Post ohne Foto möglich.
- **Falsche Cache-Keys:** Likes und Saves invalidierten `GET_POSTS`, ein Key, den keine Query benutzt. Die Explore-Seite blieb dadurch veraltet.
- **Saved-Seite:** zeigte bei jedem gespeicherten Post das eigene Profilbild statt das des Autors.
- **Bilder im Storage:** Beim Bearbeiten wurde im Fehlerfall das *alte* Bild gelöscht, beim Löschen eines Posts blieb sein Bild liegen.
- **Fehlgeschlagene Registrierung galt als Erfolg**, weil der Fehler zurückgegeben statt abgefangen wurde.
- **Platzhalter-Knöpfe ohne Funktion:** *Follow* (Profil und People-Seite), die fest eingetragenen «20 Followers / 20 Following» und der Filter-Knopf *All* auf Explore. Sie funktionieren jetzt (Folgen mit echten Zahlen, Filter *All / Following / Popular*).
- Kleineres: doppelte React-Keys (`key={post.caption}`), Speichern-Symbol mit Alternativtext «like», leere Tags `#`, falsche Meldung «Sign up failed» beim Login, CSS-Klassen mit Tippfehlern, `navigate(-1)` durch feste Routen ersetzt (funktioniert auch im iframe).
- **Pakete:** `npm audit fix`, React Router 6.17 → 6.30, Vite 4 → 5. `any`-Typen entfernt, ESLint läuft ohne Fehler und Warnungen.

## Bekannte Grenzen

- `npm audit` meldet noch Warnungen für `zod` 3 und `react-router-dom` 6. Die Lösung wäre ein Upgrade auf die nächste Hauptversion (Zod 4, React Router 7). Die gemeldeten Fälle (riesige Arrays validieren, Server-Side-Rendering) betreffen diese App nicht direkt. Die restlichen Meldungen betreffen nur Entwicklungs-Tools.

## Credits

- Idee, Design und Frontend-Grundgerüst: [JavaScript Mastery](https://www.youtube.com/@javascriptmastery) (Snapgram-Tutorial)
- Beispielbilder: selbst gezeichnete SVG-Illustrationen (`public/demo/posts/`)

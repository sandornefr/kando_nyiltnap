# KANDÓ KÓDLABOR

Nyílt napi közös projekt: a résztvevők egy Kandó nyílt napos próbaoldalt terveznek, fejlesztenek és tesztelnek. Minden csoport saját hatjegyű kódot és külön projektet kap. Nincs egyéni pontverseny.

- Játékos: https://sandornefr.github.io/kando_nyiltnap/
- Tanár: https://sandornefr.github.io/kando_nyiltnap/?view=host
- A külön kivetítőnézet a tanári felületről nyitható meg.

## Nyolcperces foglalkozás

1. **1 perc:** bevezető és csatlakozás becenévvel. A tanár indítja a projektet.
2. **45 másodperc:** a közös megbízás bemutatása.
3. **2 perc 45 másodperc:** tervezés és fejlesztés; az elkészült részeket már tesztelni lehet.
4. **1 perc 30 másodperc:** kipróbálás, visszajelzés és javítás.
5. **1 perc:** a közös oldal bemutatása.
6. **1 perc:** tanári lezárás, beszélgetés a szakmáról.

A négy projektszakasz automatikusan vált. A tanár bármikor szüneteltethet megbeszéléshez, továbbléphet vagy átvehet egy feladatot. A hatperces projektidő a szünetben nem fogy. Az átadás a fennmaradó feladatok mellett is elkezdődik; a számláló őszintén mutatja, mennyi készült el.

## Létszám és szerepek

**Közös projekt: 4–35 fő.** A tervező, fejlesztő és tesztelő szerepet a rendszer osztja ki. Egy ember legfeljebb két feladatért felel. Négy főnél hat, 35 főnél 36 részfeladat van. A későn csatlakozó is kap feladatot, de a már befejezett munkát nem veszi el mástól.

**Bemutató: 0–3 fő.** A tanár minden feladatot elvégezhet. Ez a B terv akkor is működik, ha senki sem csatlakozik.

A tervezési választások mind érvényesek. A működésbeli hibát a tesztelő a közös oldal kipróbálásával fedezheti fel, és rövid segítséget küldhet vissza a felelősnek. A javítás után új ellenőrzés szükséges. A próbaűrlap csak a böngészőben működik: nem valódi jelentkezés, az oda írt adatot nem küldi el és nem menti.

## Telefon, iPad és kivetítő

A teljes munkafelület a rendelkezésre álló képernyőn belül marad. A hosszabb résztvevő- és feladatlista lapozható. Keskeny tanári képernyőn az „Az oldal” és „A csapat” gomb vált a két nézet között. A telefonos rendszerbillentyűzet átmenetileg csökkentheti a hasznos magasságot; az űrlap kitöltése után zárd be.

Frissítéskor az adott böngészőlapon megmarad a csatlakozás. A szüneteltetést a tanár kezeli; az internetkapcsolat átmeneti megszakadása nem törli a szerveren mentett munkát. A tényleges rendezvény előtt a helyszíni Wi-Fi-n és a használt iPadeken is érdemes főpróbát tartani.

## Telepítés

1. Railway: GitHub-repó `sandornefr/kando_nyiltnap`, automatikus Dockerfile-telepítés.
2. `TEACHER_PASSWORD`: legalább 12 karakteres saját tanári jelszó. Ne kerüljön a GitHubra.
3. Volume: `/data`; `DATA_PATH=/data/games.sqlite3`. Egyetlen Railway-példány fusson.
4. Nyilvános HTTPS-domain, `/health` válasz: `ok: true`, `version: kodlabor-1`.
5. `config.js` → `apiBase`: a Railway nyilvános HTTPS-címe, vagy GitHub `API_BASE` repository variable.
6. GitHub Pages → Source: GitHub Actions. Csak a hat nyilvános felületi fájl kerül ki; a Python-kód és az adatbázis nem.

Alapértelmezett `PUBLIC_URL`: `https://sandornefr.github.io/kando_nyiltnap/`. Más frontend esetén ezt és szükség szerint az `ALLOWED_ORIGINS` változót is állítsd be. A csoportok és becenevek 24 óráig érhetők el; lejárt rekordok takarítása új csoport létrehozásakor történik. Railway-újraindítás után a tanári bejelentkezést ismételni kell; a volume-on tárolt csoport megmarad. A korábbi minijátékok csoportjai nem alakíthatók át, új csoportot kell indítani.

## Helyi futtatás

Python 3.12, `pip install -r requirements.txt`, majd `python server.py`. Alapértelmezett port: 8771. Állíts be helyi `TEACHER_PASSWORD` és `PUBLIC_URL=http://localhost:8771/` változót. Localhoston a felület automatikusan a helyi API-t használja. A szerver privát fájlokat nem szolgál ki.

Az API integrációs ellenőrzései: `python -m unittest -v test_backend.py`. Ezek a GitHub Pages közzététele előtt automatikusan is lefutnak, külön ideiglenes adatbázisban. A tesztek nem használják az éles tanári jelszót vagy csoportadatokat.

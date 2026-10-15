# KANDÓ KÓDLABOR

Nyílt napi közös projekt: a résztvevők a kitalált Pacsi kutyakozmetika próbaoldalát terveznek, fejlesztenek és tesztelnek. Minden csoport saját hatjegyű kódot és külön projektet kap. Nincs egyéni pontverseny.

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

**Vezetett bemutató: egyedül is.** A tanári kezdőlapon a „Kipróbálom egyedül” gombot válaszd. Nem kell hozzá másik telefon vagy résztvevő. A bemutató mindig a következő feladatot kínálja: szín és cím választása → gomb és űrlap működése → a két működés kipróbálása. Nincs visszaszámlálás és automatikus továbblépés, a tanár a saját tempójában halad. Hibás működés jelzése után a vezetés a javításhoz, majd az újabb próbához visz. A teljes feladatlista is elérhető. Legfeljebb három résztvevő ebben a módban is csatlakozhat, de nem szükséges. Ez a B terv akkor is működik, ha senki sem csatlakozik.

Az **Útmutató** gomb három rövid, lapozható képernyőn mutatja meg a tanár, a diákok és a kivetítő szerepét. A csoportos munka alatt a „Most te” sáv jelzi a tanári teendőt; az oldalsáv jelzi, hogy a diákok a telefonjukon dolgoznak. A csoportot legalább négy csatlakozóval lehet indítani.

A tervezési választások mind érvényesek. A működésbeli hibát a tesztelő a közös oldal kipróbálásával fedezheti fel, és rövid segítséget küldhet vissza a felelősnek. A javítás után új ellenőrzés szükséges. A próbaűrlap csak a böngészőben működik: nem valódi időpontkérés, az oda írt adatot nem küldi el és nem menti.

## Közös megbízás és záró kódnézet

A Pacsi oldalán két kezelés (Fürdetés, Teljes kozmetika), nyitvatartás és időpontkérés szerepel. A próbaűrlap kitalált kutyanevet kér. Nem kezel valódi ügyféladatot, nem foglal időpontot. A szolgáltatói információs sorrend kialakításához az Óbunda és a StarDogs nyilvános oldalait néztük át; más szolgáltató árait, képeit vagy elérhetőségeit nem másoljuk.

Az átadásnál és lezárás után **A kód mögötte** (bemutatóban **Mi van a gombok mögött?**) megmutatja a csapat választásaiból ténylegesen használt HTML-gombot, CSS-színeket és JavaScript-működést. A tanár váltása a külön kivetítőn is megjelenik. A rövid tanulási út: 9. HTML, CSS, Bootstrap és alap JavaScript; 11.-től C# asztali alkalmazások, adatbázis és webprogramozás; 13. React frontend és backend. A Bootstrap a tanterv része, maga a játék nem használja.

A belépő- és indítóoldalon lila–menta kódablak üdvözöl: „Helló, Kandó! A jövő veled kezdődik.”

A megbízásnál a tanár **Megnézzük a valódi hirdetést** gombbal nyithatja meg a Tücsök Kutyakozmetika nyilvános Facebook-időpontposztját. A csoport ideje addig szünetel, és a „Vissza és folytatás” gomb indítja újra; a korábban kézzel szüneteltetett játék szünetben marad. A külső oldal kérhet bejelentkezést. A játék önmagában is érthető, a kitalált Pacsi tanulási feladat, nem a Tücsök valódi megbízása. Forrás: https://www.facebook.com/tucsokkutyakozmetika/posts/pfbid02YMSGtLsJ8vtuLedCZYrDQnaoDaMYdjWQQ5akXzkTjsWf7rksoaNCFs4iXtdU1umjl

## Telefon, iPad és kivetítő

A teljes munkafelület a rendelkezésre álló képernyőn belül marad. A hosszabb résztvevő- és feladatlista lapozható. Keskeny tanári képernyőn a „Közös oldal” és „A csapat” gomb vált a két nézet között. A telefonos rendszerbillentyűzet átmenetileg csökkentheti a hasznos magasságot; az űrlap kitöltése után zárd be.

Frissítéskor az adott böngészőlapon megmarad a csatlakozás. A szüneteltetést a tanár kezeli; az internetkapcsolat átmeneti megszakadása nem törli a szerveren mentett munkát. A tényleges rendezvény előtt a helyszíni Wi-Fi-n és a használt iPadeken is érdemes főpróbát tartani.

## Telepítés

1. Railway: GitHub-repó `sandornefr/kando_nyiltnap`, automatikus Dockerfile-telepítés.
2. `TEACHER_PASSWORD`: legalább 12 karakteres saját tanári jelszó. Ne kerüljön a GitHubra.
3. Volume: `/data`; `DATA_PATH=/data/games.sqlite3`. Egyetlen Railway-példány fusson.
4. Nyilvános HTTPS-domain, `/health` válasz: `ok: true`, `version: kodlabor-2`.
5. `config.js` → `apiBase`: a Railway nyilvános HTTPS-címe, vagy GitHub `API_BASE` repository variable.
6. GitHub Pages → Source: GitHub Actions. Csak a hat nyilvános felületi fájl kerül ki; a Python-kód és az adatbázis nem.

Alapértelmezett `PUBLIC_URL`: `https://sandornefr.github.io/kando_nyiltnap/`. Más frontend esetén ezt és szükség szerint az `ALLOWED_ORIGINS` változót is állítsd be. A csoportok és becenevek 24 óráig érhetők el; lejárt rekordok takarítása új csoport létrehozásakor történik. Railway-újraindítás után a tanári bejelentkezést ismételni kell; a volume-on tárolt csoport megmarad. A korábbi minijátékok csoportjai nem alakíthatók át, új csoportot kell indítani.

## Helyi futtatás

Python 3.12, `pip install -r requirements.txt`, majd `python server.py`. Alapértelmezett port: 8771. Állíts be helyi `TEACHER_PASSWORD` és `PUBLIC_URL=http://localhost:8771/` változót. Localhoston a felület automatikusan a helyi API-t használja. A szerver privát fájlokat nem szolgál ki.

Az API integrációs ellenőrzései: `python -m unittest -v test_backend.py`. Ezek a GitHub Pages közzététele előtt automatikusan is lefutnak, külön ideiglenes adatbázisban. A tesztek nem használják az éles tanári jelszót vagy csoportadatokat.

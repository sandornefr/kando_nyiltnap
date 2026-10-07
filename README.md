# Kandó Küldetés

Telefonon és iPaden játszható nyílt napi csapatjáték, külön tanári és kivetítőnézettel.

## Telepítés

1. Railway: New Project → GitHub Repo → sandornefr/kando_nyiltnap. A Dockerfile automatikusan indul.
2. Variables: `TEACHER_PASSWORD` legalább 12 karakteres, saját tanári jelszó. Ne kerüljön a GitHubra.
3. Volume: csatolási út `/data`; változó `DATA_PATH=/data/games.sqlite3`. Egyetlen példány fusson.
4. Settings → Networking → Generate Domain. A `/health` végpont sikeres választ adjon.
5. A nyilvános HTTPS címet írd a `config.js` `apiBase` értékébe (záró perjel nélkül), vagy a GitHub `API_BASE` repository variable-be.
6. GitHub Settings → Pages → Source: GitHub Actions. A Pages munkafolyamat csak a négy nyilvános felületi fájlt tölti fel.

Játékos: https://sandornefr.github.io/kando_nyiltnap/

Tanár: https://sandornefr.github.io/kando_nyiltnap/?view=host

A tanári nézetből nyitható a kivetítő. Minden új csoport külön kódot kap; legfeljebb 50 játékos léphet be. A becenevek és eredmények 24 óráig elérhetők, a régi rekordokat új játék létrehozásakor törli a szerver. Railway újraindításakor a tanári bejelentkezést meg kell ismételni, a volume-on tárolt játék megmarad.

## Helyi futtatás

Python 3.12, `pip install -r requirements.txt`, majd `python server.py`. Alapértelmezett port: 8771. Állíts be helyi `TEACHER_PASSWORD` és `PUBLIC_URL=http://localhost:8771/` változót. Üres `config.js` apiBase esetén a felület a saját szerverét használja.

## Első változat

Három küldetés: TV-box bekötése, robot programozása, jegyautomata tesztelése. A helyes megoldás legfeljebb 1000 pont; hibás próbálkozásonként 100 ponttal kevesebb, minimum 600 pont. Nincs telefonsebességet jutalmazó időbónusz. A tanár indít, szüneteltet és zárja le a köröket.

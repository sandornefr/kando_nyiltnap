"""Room-independent Kandó Kódlabor project catalogue and behavioural checks."""
from copy import deepcopy

PHASES = [
    {'id': 'brief', 'label': 'Közös terv', 'duration': 45},
    {'id': 'build', 'label': 'Építés', 'duration': 165},
    {'id': 'review', 'label': 'Kipróbálás és javítás', 'duration': 90},
    {'id': 'handover', 'label': 'Közös bemutató', 'duration': 60},
]
ROLE_LABELS = {'designer': 'Tervező', 'developer': 'Fejlesztő', 'tester': 'Tesztelő'}
DEFAULTS = dict(theme='violet', title='discover', intro='curious', hero='code',
                cardCode='create', cardNetwork='connect', buttonLabel='try',
                layout='cards', buttonTarget='signup', formRule='nonempty',
                navTarget='programs', feedback='visible', menuRule='toggle',
                counterRule='one', filterRule='match', headingSize='large',
                borderStyle='soft', footerText='community')


def option(value, label, visual=None):
    result = dict(value=value, label=label)
    if visual:
        result['visual'] = visual
    return result


def design(key, title, hint, options):
    return dict(id='design-' + key, key=key, title=title, hint=hint,
                role='designer', kind='choice', options=options, dependsOn=[])


def code(key, title, hint, options):
    return dict(id='code-' + key, key=key, title=title, hint=hint,
                role='developer', kind='code', options=options, dependsOn=[])


BUILDERS = [
    design('theme', 'Válassz közös színvilágot!', 'Minden szín jó választás. Figyeld meg, hogyan változik az egész oldal!', [option('violet', 'Lila – kreatív'), option('mint', 'Menta – friss'), option('amber', 'Borostyán – energikus')]),
    design('title', 'Adj címet a nyílt napnak!', 'A cím fogadja a látogatókat. Melyik hívogat legjobban?', [option('discover', 'Fedezd fel a Kandót!'), option('build', 'Alkoss velünk a Kandóban!'), option('future', 'Itt kezdődik a jövőd!')]),
    code('buttonTarget', 'Kösd be a fő gombot!', 'A fő gomb a próbaűrlaphoz vezessen.', [option('signup', 'A próbaűrlaphoz ugrik', 'KATTINTÁS → PRÓBAŰRLAP'), option('programs', 'A programokhoz ugrik', 'KATTINTÁS → PROGRAMOK')]),
    code('formRule', 'Ellenőrizd az üres mezőt!', 'Üres becenévvel ne jelenjen meg sikeres visszajelzés. Ez csak próba, adatot nem küldünk.', [option('nonempty', 'Csak kitöltött mezővel sikeres', 'HA VAN SZÖVEG → SIKER'), option('always', 'Mindig sikeres', 'MINDEN ESETBEN → SIKER')]),
    design('intro', 'Írj rövid meghívót!', 'Válassz egy bemutatkozó mondatot a főcím alá!', [option('curious', 'Kíváncsi vagy, hogyan működik a digitális világ?'), option('team', 'Egy csapat. Sok ötlet. Közös alkotás.'), option('practice', 'Próbáld ki, tervezz, és alkoss velünk!')]),
    design('hero', 'Válassz nyitóképet!', 'A nyitókép mutassa meg, milyen élmény vár a Kandóban!', [option('code', 'Kód és alkotás'), option('network', 'Kapcsolatok és hálózat'), option('team', 'Együtt dolgozó csapat')]),
    design('cardCode', 'Mutasd be a programozást!', 'Melyik felirat kelti fel legjobban az érdeklődést?', [option('create', 'Alkoss saját weboldalt!'), option('solve', 'Oldj meg izgalmas feladatokat!'), option('play', 'Programozz játékos kihívásokat!')]),
    design('cardNetwork', 'Mutasd be a hálózatokat!', 'A hálózatos program kapjon saját, érthető meghívót!', [option('connect', 'Kapcsold össze a világot!'), option('explore', 'Fedezd fel a hálózatokat!'), option('signal', 'Kövesd a jelek útját!')]),
    design('buttonLabel', 'Nevezd el a fő gombot!', 'A felirat hívjon kipróbálásra. Minden változat használható.', [option('try', 'Kipróbálom!'), option('join', 'Csatlakozom!'), option('discover', 'Felfedezem!')]),
    design('layout', 'Rendezd el a programokat!', 'Válassz áttekinthető elrendezést a két programhoz!', [option('cards', 'Két programkártya'), option('split', 'Két egymás alatti sáv')]),
    code('navTarget', 'Kösd be a Programok menüt!', 'A Programok menüpont a programokhoz vezessen.', [option('programs', 'A programokhoz ugrik', 'PROGRAMOK MENÜ → PROGRAMOK'), option('signup', 'A próbaűrlaphoz ugrik', 'PROGRAMOK MENÜ → PRÓBAŰRLAP')]),
    code('feedback', 'Adj látható visszajelzést!', 'A kitöltött próbaűrlap után a látogató lássa, hogy sikerült a próba!', [option('visible', 'Látható sikerüzenet', 'SIKER → ÜZENET MEGJELENIK'), option('hidden', 'Rejtett sikerüzenet', 'SIKER → ÜZENET REJTVE')]),
    code('menuRule', 'Tedd kapcsolhatóvá a menüt!', 'A menügomb elsőre nyisson, másodszorra csukjon.', [option('toggle', 'Nyitás és csukás váltakozik', 'KATTINTÁS → ÁLLAPOT VÁLTÁSA'), option('open', 'Mindig kinyit', 'KATTINTÁS → NYITVA')]),
    code('counterRule', 'Számolj egyesével!', 'A + gomb eggyel növelje a próbahelyek számát.', [option('one', 'Egy kattintás: +1', 'ÚJ ÉRTÉK = RÉGI + 1'), option('two', 'Egy kattintás: +2', 'ÚJ ÉRTÉK = RÉGI + 2')]),
    code('filterRule', 'Szűrd a programokat!', 'A kategóriaválasztó csak a kiválasztott programtípust mutassa.', [option('match', 'Csak a választott kategória', 'HA KATEGÓRIA EGYEZIK → MUTAT'), option('all', 'Minden kategória marad', 'MINDEN PROGRAM → MUTAT')]),
    design('headingSize', 'Emeld ki a főcímet!', 'Próbáld ki, melyik címméret illik a közös oldalhoz!', [option('large', 'Nagy és hangsúlyos'), option('normal', 'Kompakt és nyugodt')]),
    design('borderStyle', 'Formázd a kártyák sarkát!', 'A kártyák formája is alakítja az oldal hangulatát.', [option('soft', 'Lekerekített sarkok'), option('square', 'Szögletes sarkok')]),
    design('footerText', 'Írj záróüzenetet!', 'A lap alján egy közös mondattal búcsúzzunk a látogatótól!', [option('community', 'Közösen alkotunk a Kandóban.'), option('future', 'A jövő veled kezdődik.'), option('welcome', 'Várunk a Kandóban!')]),
]
BY_KEY = {item['key']: item for item in BUILDERS}
FUNCTIONAL = dict(buttonTarget='signup', formRule='nonempty', navTarget='programs',
                  feedback='visible', menuRule='toggle', counterRule='one', filterRule='match')
CHECK_HINTS = {
    'buttonTarget': ('A fő gomb a próbaűrlapra visz.', 'A fő gomb a programokhoz visz.', 'A kattintás célja a próbaűrlap legyen.'),
    'formRule': ('Az üres mező nem sikeres; a kitöltött mező sikeres.', 'Az üres mező is sikeres visszajelzést ad.', 'Előbb ellenőrizd, van-e szöveg a mezőben.'),
    'navTarget': ('A Programok menüpont a programokhoz visz.', 'A Programok menüpont a próbaűrlaphoz visz.', 'A Programok menüpont célja a programok szakasz legyen.'),
    'feedback': ('A sikeres próba után látható az üzenet.', 'A sikeres próba után rejtve marad az üzenet.', 'Sikeres próba után jelenítsd meg a visszajelzést.'),
    'menuRule': ('Két kattintás után a menü ismét csukva van.', 'Két kattintás után is nyitva marad a menü.', 'A menü állapota minden kattintáskor váltson.'),
    'counterRule': ('Az első + kattintás után 2 próbahely látszik.', 'Az első + kattintás után 3 próbahely látszik.', 'A + gomb eggyel növelje a próbahelyek számát.'),
    'filterRule': ('A Játék szűrő csak a Játékkészítés programot mutatja.', 'A Játék szűrő a hálózatos programot is mutatja.', 'Csak az egyező kategóriájú programot jelenítsd meg.'),
}


REVIEW_TITLES = {
    'theme': 'Nézd meg a színeket!', 'title': 'Olvasd el a főcímet!',
    'buttonTarget': 'Próbáld ki a fő gombot!', 'formRule': 'Próbálj üres mezőt küldeni!',
    'intro': 'Olvasd el a meghívót!', 'hero': 'Nézd meg a nyitóképet!',
    'cardCode': 'Nézd meg a játékos programot!', 'cardNetwork': 'Nézd meg a hálózatos programot!',
    'buttonLabel': 'Olvasd el a gomb feliratát!', 'layout': 'Nézd meg az elrendezést!',
    'navTarget': 'Próbáld ki a Programok menüt!', 'feedback': 'Keress sikerüzenetet!',
    'menuRule': 'Nyisd ki, majd csukd be a menüt!', 'counterRule': 'Növeld a próbahelyek számát!',
    'filterRule': 'Válaszd a Játék szűrőt!', 'headingSize': 'Nézd meg a címméretet!',
    'borderStyle': 'Nézd meg a kártyák sarkát!', 'footerText': 'Olvasd el a záróüzenetet!',
}
REVIEW_HINTS = {
    'buttonTarget': 'Nyomd meg a fő gombot! A próbaűrlaphoz visz?',
    'formRule': 'Előbb üresen, majd egy becenévvel küldd el az űrlapot!',
    'navTarget': 'A ☰ menüben válaszd a Programokat!',
    'feedback': 'Küldd el a kitöltött próbaűrlapot! Látszik a sikerüzenet?',
    'menuRule': 'Nyomd meg kétszer a ☰ menügombot!',
    'counterRule': 'A próbaűrlapon egyszer nyomd meg a + gombot!',
    'filterRule': 'Programok → Játék. Csak a játékos program marad?',
    'cardCode': 'A Programoknál nézd meg a Játékkészítés kártyáját!',
    'cardNetwork': 'A Programoknál nézd meg a Hálózatépítés kártyáját!',
    'footerText': 'Keresd a záróüzenetet az oldal alján!',
}


def review(builder):
    return dict(id='test-' + builder['key'], key=builder['key'],
                title=REVIEW_TITLES[builder['key']],
                hint=REVIEW_HINTS.get(builder['key'], 'Nézd meg a közös oldalt, majd ellenőrizd a változást!'),
                role='tester', kind='test', options=[option('confirm', 'Működik, jóváhagyom'), option('report', 'Javítást kérek')], dependsOn=[builder['id']])


# Six core tasks work for four participants; further pairs add distinct visible contributions.
CATALOGUE = BUILDERS[:4] + [review(BUILDERS[2]), review(BUILDERS[3])]
for _builder in BUILDERS[4:-1]:
    CATALOGUE += [_builder, review(_builder)]
CATALOGUE += [review(BUILDERS[0]), review(BUILDERS[1]), BUILDERS[-1], review(BUILDERS[-1])]


def task_count(players):
    return max(6, min(36, players + players % 2))


def new_tasks(count):
    return [dict(deepcopy(item), ownerId=None, done=False, issue=None, value=None, probes={}) for item in CATALOGUE[:count]]


def assign(room):
    """Before starting, distribute same-role tasks with one or two per player."""
    people = sorted(room['players'].values(), key=lambda person: person['order'])
    tasks = new_tasks(task_count(len(people)))
    room['tasks'] = tasks
    if not people:
        return
    grouped = {role: [task for task in tasks if task['role'] == role] for role in ROLE_LABELS}
    slots = {role: len(items) for role, items in grouped.items()}
    while sum(slots.values()) > len(people):
        candidates = [role for role, count in slots.items() if count > (len(grouped[role]) + 1) // 2]
        if not candidates:
            break
        role = max(candidates, key=lambda value: (slots[value], {'designer': 2, 'tester': 1, 'developer': 0}[value]))
        slots[role] -= 1
    # Demo with 1–3 people can leave roles to the teacher, preserving the two-task maximum.
    if sum(slots.values()) > len(people):
        slots = {role: 0 for role in ROLE_LABELS}
        for index in range(len(people)):
            slots[list(ROLE_LABELS)[index]] = 1
    index = 0
    for role, role_tasks in grouped.items():
        owners = people[index:index + slots[role]]
        index += slots[role]
        for person in owners:
            person['role'] = role
        for task_index, task in enumerate(role_tasks):
            if owners and task_index < 2 * len(owners):
                task['ownerId'] = owners[task_index % len(owners)]['id']


def check(task, config):
    key = task['key']
    if key in FUNCTIONAL:
        passed = config[key] == FUNCTIONAL[key]
        good, bad, hint = CHECK_HINTS[key]
        return dict(passed=passed, observed=good if passed else bad,
                    hint='Működik! Hagyd jóvá az ellenőrzést.' if passed else hint)
    selected = next(item['label'] for item in BY_KEY[key]['options'] if item['value'] == config[key])
    return dict(passed=True, observed='A közös oldalon ez jelenik meg: ' + selected,
                hint='Nézd meg az élő előnézetben! Ha olvasható és látszik a változás, hagyd jóvá.')

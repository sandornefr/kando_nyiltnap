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
    design('theme', 'Színezd ki az oldalt!', 'A választott szín megjelenik a közös oldalon.', [option('violet', 'Szilvalila'), option('mint', 'Erdőzöld'), option('amber', 'Terrakotta')]),
    design('title', 'Tedd ki a főcímet!', 'Válassz címet! Küldd ki az oldalra!', [option('discover', 'Kutyakozmetika, odafigyeléssel.'), option('build', 'Ápolt bunda, jó közérzet.'), option('future', 'Szőrápolás, nyugodt környezetben.')]),
    code('buttonTarget', 'Kösd be az időpontkérő gombot!', 'A gomb nyissa meg az Időpontkérést! Ott még épülhet a tartalom.', [option('signup', 'Az időpontkéréshez ugrik', 'KATTINTÁS → IDŐPONTKÉRÉS'), option('programs', 'A szolgáltatásokhoz ugrik', 'KATTINTÁS → SZOLGÁLTATÁSOK')]),
    code('formRule', 'Építs időpontkérő űrlapot!', 'Kerüljön be az űrlap! Üres kutyanévvel ne lehessen elküldeni.', [option('nonempty', 'Csak kitöltött mezővel sikeres', 'HA VAN SZÖVEG → SIKER'), option('always', 'Mindig sikeres', 'MINDEN ESETBEN → SIKER')]),
    design('intro', 'Tedd ki a bemutatkozást!', 'Ez a mondat a főcím alá kerül.', [option('curious', 'Fürdetés és teljes kozmetika, előre egyeztetett időpontban.'), option('team', 'Kistestű és nagytestű kutyákat is várunk.'), option('practice', 'Válassz szolgáltatást, és kérj időpontot online.')]),
    design('hero', 'Tegyél fotót a főoldalra!', 'Válassz képet! Megjelenik a főoldalon.', [option('code', 'Szőrápolás'), option('network', 'Fürdetés'), option('team', 'Kutya')]),
    design('cardCode', 'Építs Fürdetés-kártyát!', 'Fotó és leírás kerül a Szolgáltatásokhoz.', [option('create', 'Fürdetés, szárítás, átfésülés.'), option('solve', 'Tiszta, könnyen fésülhető bunda.'), option('play', 'Kímélő ápolás minden szőrtípushoz.')]),
    design('cardNetwork', 'Építs Teljes kozmetika-kártyát!', 'A második kezelés is megjelenik a Szolgáltatásoknál.', [option('connect', 'Fürdetés, nyírás, karomápolás.'), option('explore', 'Teljes ápolás az orrtól a farokig.'), option('signal', 'Fazonigazítás és alapos szőrápolás.')]),
    design('buttonLabel', 'Tegyél gombot a főoldalra!', 'Válassz feliratot az időpontkérő gombnak!', [option('try', 'Időpontot kérek'), option('join', 'Időpontkérés'), option('discover', 'Kérek egy időpontot')]),
    design('layout', 'Építs szolgáltatásoldalt!', 'Kártyák vagy sávok? Ide kerülnek a kezelések.', [option('cards', 'Két szolgáltatáskártya'), option('split', 'Két egymás alatti sáv')]),
    code('navTarget', 'Kösd be a Szolgáltatások menüt!', 'A Szolgáltatások menüpont a két szolgáltatáshoz vezessen.', [option('programs', 'A szolgáltatásokhoz ugrik', 'SZOLGÁLTATÁSOK MENÜ → SZOLGÁLTATÁSOK'), option('signup', 'Az időpontkéréshez ugrik', 'SZOLGÁLTATÁSOK MENÜ → IDŐPONTKÉRÉS')]),
    code('feedback', 'Adj látható visszajelzést!', 'A kitöltött időpontkérés után látszódjon a próba eredménye. Valódi foglalás nem történik.', [option('visible', 'Látható sikerüzenet', 'SIKER → ÜZENET MEGJELENIK'), option('hidden', 'Rejtett sikerüzenet', 'SIKER → ÜZENET REJTVE')]),
    code('menuRule', 'Tedd kapcsolhatóvá a menüt!', 'A menügomb elsőre nyisson, másodszorra csukjon.', [option('toggle', 'Nyitás és csukás váltakozik', 'KATTINTÁS → ÁLLAPOT VÁLTÁSA'), option('open', 'Mindig kinyit', 'KATTINTÁS → NYITVA')]),
    code('counterRule', 'Számold meg a kutyákat!', 'A + gomb eggyel növelje a kutyák számát az időpontkérésnél.', [option('one', 'Egy kattintás: +1', 'ÚJ ÉRTÉK = RÉGI + 1'), option('two', 'Egy kattintás: +2', 'ÚJ ÉRTÉK = RÉGI + 2')]),
    code('filterRule', 'Szűrd a szolgáltatásokat!', 'A szűrő csak a kiválasztott szolgáltatást mutassa.', [option('match', 'Csak a választott szolgáltatás', 'HA KATEGÓRIA EGYEZIK → MUTAT'), option('all', 'Mindkét szolgáltatás marad', 'MINDEN SZOLGÁLTATÁS → MUTAT')]),
    design('headingSize', 'Emeld ki a főcímet!', 'Próbáld ki, melyik címméret illik a közös oldalhoz!', [option('large', 'Nagy és hangsúlyos'), option('normal', 'Kompakt és nyugodt')]),
    design('borderStyle', 'Formázd a kártyák sarkát!', 'A kártyák formája is alakítja az oldal hangulatát.', [option('soft', 'Lekerekített sarkok'), option('square', 'Szögletes sarkok')]),
    design('footerText', 'Építs láblécet!', 'A választott üzenet a lap aljára kerül.', [option('community', 'Szeretettel várunk a Tücsökben.'), option('future', 'Bejelentkezés előzetes egyeztetéssel.'), option('welcome', 'Bejelentkezés alapján')]),
]
BY_KEY = {item['key']: item for item in BUILDERS}
FUNCTIONAL = dict(buttonTarget='signup', formRule='nonempty', navTarget='programs',
                  feedback='visible', menuRule='toggle', counterRule='one', filterRule='match')
CHECK_HINTS = {
    'buttonTarget': ('A fő gomb az időpontkéréshez visz.', 'A fő gomb a szolgáltatásokhoz visz.', 'A kattintás célja az időpontkérő űrlap legyen.'),
    'formRule': ('Üres kutyanévvel nem küldhető el; kitöltve elfogadja az űrlap.', 'Az űrlap üres kutyanevet is elfogad.', 'Előbb ellenőrizd, van-e szöveg a kutyanév mezőben.'),
    'navTarget': ('A Szolgáltatások menüpont a szolgáltatásokhoz visz.', 'A Szolgáltatások menüpont az időpontkéréshez visz.', 'A Szolgáltatások menüpont célja a szolgáltatások szakasz legyen.'),
    'feedback': ('A sikeres próba után látható az üzenet.', 'A sikeres próba után rejtve marad az üzenet.', 'Sikeres próba után jelenítsd meg a visszajelzést.'),
    'menuRule': ('Két kattintás után a menü ismét csukva van.', 'Két kattintás után is nyitva marad a menü.', 'A menü állapota minden kattintáskor váltson.'),
    'counterRule': ('Az első + kattintás után a kutyák száma 2.', 'Az első + kattintás után a kutyák száma 3.', 'A + gomb eggyel növelje a kutyák számát.'),
    'filterRule': ('A Fürdetés szűrő csak a Fürdetés szolgáltatást mutatja.', 'A Fürdetés szűrő a Teljes kozmetikát is mutatja.', 'Csak a kiválasztott szolgáltatást jelenítsd meg.'),
}


REVIEW_TITLES = {
    'theme': 'Nézd meg a színeket!', 'title': 'Olvasd el a főcímet!',
    'buttonTarget': 'Próbáld ki a fő gombot!', 'formRule': 'Próbálj üres mezőt küldeni!',
    'intro': 'Olvasd el a bemutatkozást!', 'hero': 'Nézd meg a nyitóképet!',
    'cardCode': 'Nézd meg a Fürdetés kártyáját!', 'cardNetwork': 'Nézd meg a Teljes kozmetika kártyáját!',
    'buttonLabel': 'Olvasd el a gomb feliratát!', 'layout': 'Nézd meg az elrendezést!',
    'navTarget': 'Próbáld ki a Szolgáltatások menüt!', 'feedback': 'Keress sikerüzenetet!',
    'menuRule': 'Nyisd ki, majd csukd be a menüt!', 'counterRule': 'Növeld a kutyák számát!',
    'filterRule': 'Válaszd a Fürdetés szűrőt!', 'headingSize': 'Nézd meg a címméretet!',
    'borderStyle': 'Nézd meg a kártyák sarkát!', 'footerText': 'Olvasd el a záróüzenetet!',
}
REVIEW_HINTS = {
    'buttonTarget': 'Nyomd meg a fő gombot! Az időpontkéréshez visz?',
    'formRule': 'Válassz szabad időpontot! Próbáld ki név nélkül, majd egy kitalált kutyanévvel.',
    'navTarget': 'A ☰ menüben válaszd a Szolgáltatásokat!',
    'feedback': 'Válassz szabad időpontot és írj kitalált kutyanevet! Látszik a sikerüzenet?',
    'menuRule': 'Nyomd meg kétszer a ☰ menügombot!',
    'counterRule': 'Válassz szabad időpontot, majd nyomd meg a + gombot! Kettő kutyát mutat?',
    'filterRule': 'Szolgáltatások → Fürdetés. Csak a Fürdetés kártyája marad?',
    'cardCode': 'A Szolgáltatásoknál nézd meg a Fürdetés kártyáját!',
    'cardNetwork': 'A Szolgáltatásoknál nézd meg a Teljes kozmetika kártyáját!',
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

# A route can be tested while its destination is still empty. Controls inside
# that destination need their actual UI first; no prerequisite publishes it.
TEST_PREREQUISITES = {
    'formRule': ['code-formRule'],
    'feedback': ['code-formRule'],
    'counterRule': ['code-formRule'],
    'filterRule': ['design-cardCode', 'design-cardNetwork'],
    'headingSize': ['design-title'],
    'borderStyle': ['design-layout'],
}
PROJECT_VIEWS = {
    'cardCode': 'programs', 'cardNetwork': 'programs', 'layout': 'programs',
    'navTarget': 'programs', 'filterRule': 'programs', 'borderStyle': 'programs',
    'formRule': 'signup', 'feedback': 'signup', 'counterRule': 'signup',
}
PUBLICATION_LABELS = {
    'theme': 'Megérkeztek a színek', 'title': 'Főcím került az oldalra',
    'buttonTarget': 'Működik az időpontkérő gomb útvonala', 'formRule': 'Elkészült az időpontkérő űrlap',
    'intro': 'Megérkezett a bemutatkozás', 'hero': 'Fotó került a főoldalra',
    'cardCode': 'Elkészült a Fürdetés-kártya', 'cardNetwork': 'Elkészült a Teljes kozmetika-kártya',
    'buttonLabel': 'Gomb került a főoldalra', 'layout': 'Elkészült a szolgáltatásoldal váza',
    'navTarget': 'Elkészült a Szolgáltatások menüpont', 'feedback': 'Elkészült a visszajelzés',
    'menuRule': 'Elkészült a nyitható menü', 'counterRule': 'Elkészült a kutyaszámláló',
    'filterRule': 'Elkészült a szolgáltatásszűrő', 'headingSize': 'Megváltozott a főcím mérete',
    'borderStyle': 'Megváltozott a kártyák formája', 'footerText': 'Lábléc került az oldalra',
}


def task_dependencies(task, available):
    dependencies = list(task['dependsOn'])
    if task['kind'] == 'test':
        dependencies += TEST_PREREQUISITES.get(task['key'], [])
        if task['key'] == 'borderStyle' and 'design-layout' not in available:
            dependencies += ['design-cardCode']
    return list(dict.fromkeys(key for key in dependencies if key in available))


def task_count(players):
    return max(6, min(36, players + players % 2))


def new_tasks(count):
    tasks = [dict(deepcopy(item), ownerId=None, done=False, issue=None, value=None, publishVersion=0, probes={}) for item in CATALOGUE[:count]]
    available = {task['id'] for task in tasks}
    for task in tasks:
        task['dependsOn'] = task_dependencies(task, available)
    return tasks


def assign(room, people=None):
    """Before starting, distribute same-role tasks with one or two per player."""
    people = sorted((person for person in room['players'].values() if person.get('active', True)) if people is None else people,
                    key=lambda person: person['order'])
    tasks = new_tasks(len(CATALOGUE) if room['mode'] == 'demo' else task_count(len(people)))
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

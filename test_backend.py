"""API integration tests. Run: python -m unittest -v test_backend.py"""
import concurrent.futures
from contextlib import closing
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

# Import without creating production storage, including when invoked from CI.
IMPORT_DIR = tempfile.TemporaryDirectory(prefix='kodlabor-import-')
os.environ['DATA_PATH'] = str(Path(IMPORT_DIR.name) / 'rooms.sqlite3')
import server
from project import DEFAULTS, FUNCTIONAL, CATALOGUE


class SharedProjectTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='kodlabor-test-')
        server.DB_PATH = str(Path(self.temp.name) / 'rooms.sqlite3')
        with closing(sqlite3.connect(server.DB_PATH)) as db, db:
            db.execute('CREATE TABLE rooms (code TEXT PRIMARY KEY, data TEXT NOT NULL)')
        server.PASSWORD = 'test-password-only-12345'
        server.ADMINS.clear()
        server.LIMITS.clear()
        server.app.config['TESTING'] = True
        self.client = server.app.test_client()
        self.admin = self.client.post('/api/login', json={'password': server.PASSWORD}).get_json()['token']

    def tearDown(self):
        self.temp.cleanup()

    def post(self, path, data, expected=200, client=None):
        response = (client or self.client).post('/api/' + path, json=data)
        self.assertEqual(expected, response.status_code, response.get_json())
        return response.get_json()

    def create(self, count=4, mode='group'):
        created = self.post('create', {'admin': self.admin, 'mode': mode})
        self.code, self.host = created['code'], created['token']
        self.tokens = [self.post('join', {'code': self.code, 'name': f'Csapat {index + 1}'})['token'] for index in range(count)]
        return self.state()

    def state(self, token=None):
        headers = {'Authorization': 'Bearer ' + token} if token else {}
        response = self.client.get('/api/state', query_string={'code': self.code}, headers=headers)
        self.assertEqual(200, response.status_code)
        return response.get_json()

    def control(self, action, expected=200, **extra):
        return self.post('control', dict(code=self.code, token=self.host, action=action, **extra), expected)

    def start_build(self):
        self.control('start')
        return self.control('next')

    def submit(self, task, value, token=None, expected=200, client=None):
        return self.post('task', dict(code=self.code, token=token or self.host, taskId=task, value=value), expected, client)

    def probe(self, task, token=None, expected=200, client=None):
        return self.post('probe', dict(code=self.code, token=token or self.host, taskId=task), expected, client)

    def task(self, state, task_id):
        return next(task for task in state['tasks'] if task['id'] == task_id)

    def test_group_sizes_everyone_has_real_owned_work(self):
        for count in (4, 6, 20, 35):
            with self.subTest(count=count):
                state = self.create(count)
                self.assertGreaterEqual(len(state['tasks']), count)
                self.assertLessEqual(len(state['tasks']), 36)
                self.assertEqual(count, len({person['id'] for person in state['players']}))
                for person in state['players']:
                    owned = [task for task in state['tasks'] if task['ownerId'] == person['id']]
                    self.assertTrue(1 <= len(owned) <= 2, (count, person))
                    self.assertTrue(all(task['role'] == person['role'] for task in owned))
                by_id = {task['id']: task for task in state['tasks']}
                for task in state['tasks']:
                    self.assertTrue(all(key in by_id for key in task['dependsOn']))
                if count == 4:
                    self.assertEqual(['designer', 'developer', 'developer', 'tester'], [person['role'] for person in state['players']])
                self.assertEqual('working', self.control('start')['status'])

    def test_group_minimum_and_demo_zero_to_three(self):
        self.create(3)
        self.control('start', 409)
        for count in range(4):
            self.create(count, 'demo')
            self.start_build()
            state = self.submit('design-theme', 'mint')
            self.assertEqual('mint', state['project']['config']['theme'])
            self.assertTrue(all(person['total'] <= 2 for person in state['players']))
        self.post('join', dict(code=self.code, name='Negyedik'), 409)

    def test_demo_has_no_clock_and_advances_only_on_teacher_command(self):
        self.create(0, 'demo')
        start = time.time()
        self.control('start')
        with patch('server.time.time', return_value=start + 3600):
            state = self.state()
            self.assertEqual('brief', state['phase'])
            state = self.control('next')
            self.assertEqual('build', state['phase'])
        with patch('server.time.time', return_value=start + 12 * 3600):
            state = self.state()
            self.assertEqual('working', state['status'])
            self.assertEqual('build', state['phase'])
            self.assertFalse(state['automatic'])
            self.assertFalse(state['paused'])
            self.assertEqual(0, state['remaining'])
            self.assertEqual(0, state['sessionRemaining'])
            self.assertEqual(0, server.load(self.code)['deadline'])
            self.submit('code-buttonTarget', 'signup')
            self.assertTrue(self.probe('test-buttonTarget')['passed'])
            self.submit('test-buttonTarget', 'confirm')
            self.assertEqual('review', self.control('next')['phase'])
        with patch('server.time.time', return_value=start + 13 * 3600):
            self.assertEqual('review', self.state()['phase'])
            self.submit('design-theme', 'mint')
            self.assertEqual('handover', self.control('next')['phase'])
        with patch('server.time.time', return_value=start + 14 * 3600):
            self.assertEqual('working', self.state()['status'])
            self.assertEqual('finished', self.control('next')['status'])

    def test_current_task_copy_reaches_existing_rooms_without_losing_work(self):
        self.create(35)
        self.start_build()
        self.submit('design-title', 'build')
        self.submit('code-buttonTarget', 'signup')
        self.probe('test-buttonTarget')
        room = server.load(self.code)
        previous_project = self.state()['project']
        previous_work = [{key: task[key] for key in ('id', 'ownerId', 'done', 'value', 'issue', 'probes')} for task in room['tasks']]
        for task in room['tasks']:
            task.update(title='Korábbi nyílt nap', hint='Korábbi meghívó',
                        options=[dict(option, label='Korábbi felirat') for option in task['options']])
        server.save(room)
        state = self.state()
        self.assertIn('Tücsök Kutyakozmetika', state['brief'])
        self.assertIn('Fürdetés', state['brief'])
        self.assertIn('bejelentkezés alapján', state['brief'])
        self.assertIn('kitalált kutyanevet', state['brief'])
        self.assertEqual(previous_project, state['project'])
        for task, current in zip(state['tasks'], CATALOGUE):
            self.assertEqual(current['title'], task['title'])
            self.assertEqual(current['hint'], task['hint'])
            self.assertEqual(current['options'], task['options'])
        refreshed = server.load(self.code)
        self.assertEqual(previous_work, [{key: task[key] for key in ('id', 'ownerId', 'done', 'value', 'issue', 'probes')} for task in refreshed['tasks']])
        self.submit('test-buttonTarget', 'confirm')

    def test_source_presentation_is_host_controlled_shared_and_preserved_on_finish(self):
        state = self.create()
        self.assertIsNone(state['presentation'])
        self.control('code-html', expected=409)
        self.start_build()
        self.control('code-css', expected=409)
        self.post('control', dict(code=self.code, token=self.tokens[0], action='code-html'), 403)
        self.control('next')
        self.control('next')
        state = self.control('code-css')
        self.assertEqual(dict(tab='css', path=False), state['presentation'])
        self.assertEqual(state['presentation'], self.state()['presentation'])
        self.assertEqual(state['presentation'], server.load(self.code)['presentation'])
        state = self.control('code-path', requestId='code-path-once-123')
        self.assertEqual(dict(tab='css', path=True), state['presentation'])
        self.assertEqual(state['presentation'], self.control('code-path', requestId='code-path-once-123')['presentation'])
        self.assertEqual(dict(tab='html', path=False), self.control('code-html')['presentation'])
        presentation = self.control('code-javascript')['presentation']
        with patch('server.time.time', return_value=time.time() + 400):
            state = self.state()
            self.assertEqual('finished', state['status'])
            self.assertEqual(presentation, state['presentation'])
            self.assertEqual(dict(tab='javascript', path=True), self.control('code-path')['presentation'])
            self.assertIsNone(self.control('code-close')['presentation'])
            self.assertIsNone(self.state()['presentation'])
            self.assertEqual(dict(tab='html', path=True), self.control('code-path')['presentation'])
        self.control('close')
        self.control('code-html', expected=409)

    def test_teacher_and_player_capabilities_are_private(self):
        self.create()
        public = self.state()
        raw = json.dumps(public)
        for token in self.tokens + [self.host, self.admin]:
            self.assertNotIn(token, raw)
        self.assertNotIn('self', public)
        self.assertNotIn('host', public)
        own = self.state(self.tokens[0])
        self.assertEqual(own['self']['id'], own['players'][0]['id'])
        self.assertTrue(self.state(self.host)['host'])
        self.assertNotIn('self', self.state('árvíztűrő'))
        self.start_build()
        self.submit('code-buttonTarget', 'signup', self.tokens[0], 403)
        self.submit('design-theme', 'mint', 'invalid', 403)
        self.post('control', dict(code=self.code, token=self.tokens[0], action='finish'), 403)
        self.submit('code-buttonTarget', 'signup')
        self.assertEqual('done', self.task(self.state(), 'code-buttonTarget')['status'])

    def test_functional_issue_report_repair_and_retest(self):
        self.create()
        self.start_build()
        self.probe('test-buttonTarget', expected=409)
        self.submit('code-buttonTarget', 'programs')
        self.submit('test-buttonTarget', 'confirm', expected=409)
        failed = self.probe('test-buttonTarget')
        self.assertFalse(failed['passed'])
        self.submit('test-buttonTarget', 'confirm', expected=409)
        state = self.submit('test-buttonTarget', 'report')
        self.assertEqual('issue', self.task(state, 'code-buttonTarget')['status'])
        self.assertEqual('locked', self.task(state, 'test-buttonTarget')['status'])
        self.submit('test-buttonTarget', 'report')  # Retry is harmless.
        self.submit('code-buttonTarget', 'signup')
        self.submit('test-buttonTarget', 'confirm', expected=409)
        self.assertTrue(self.probe('test-buttonTarget')['passed'])
        state = self.submit('test-buttonTarget', 'confirm')
        self.assertEqual('done', self.task(state, 'test-buttonTarget')['status'])
        self.assertIsNone(self.task(state, 'code-buttonTarget')['issue'])

    def test_probes_survive_unrelated_edits_and_same_value_retry(self):
        self.create()
        self.start_build()
        self.submit('code-buttonTarget', 'signup')
        self.probe('test-buttonTarget')
        self.submit('design-theme', 'mint')
        state = self.submit('test-buttonTarget', 'confirm')
        revision = state['project']['revision']
        event_count = len(state['events'])
        state = self.submit('code-buttonTarget', 'signup')
        self.assertEqual(revision, state['project']['revision'])
        self.assertEqual(event_count, len(state['events']))
        self.assertEqual('done', self.task(state, 'test-buttonTarget')['status'])
        state = self.submit('code-buttonTarget', 'programs')
        self.assertEqual('ready', self.task(state, 'test-buttonTarget')['status'])
        self.submit('test-buttonTarget', 'confirm', expected=409)

    def test_probe_belongs_to_the_actor(self):
        self.create()
        self.start_build()
        self.submit('code-buttonTarget', 'signup')
        self.probe('test-buttonTarget')
        tester = next(token for token in self.tokens if self.state(token)['self']['role'] == 'tester')
        self.submit('test-buttonTarget', 'confirm', tester, 409)
        self.probe('test-buttonTarget', tester)
        self.submit('test-buttonTarget', 'confirm', tester)

    def test_all_functional_checks_follow_selected_configuration(self):
        self.create(35)
        self.start_build()
        self.submit('design-cardCode', DEFAULTS['cardCode'])
        self.submit('design-cardNetwork', DEFAULTS['cardNetwork'])
        for key, good in FUNCTIONAL.items():
            task_id = 'code-' + key
            task = self.task(self.state(), task_id)
            bad = next(option['value'] for option in task['options'] if option['value'] != good)
            self.submit(task_id, bad)
            self.assertFalse(self.probe('test-' + key)['passed'], key)
            self.submit(task_id, good)
            self.assertTrue(self.probe('test-' + key)['passed'], key)
        self.submit('design-theme', 'amber')
        self.assertTrue(self.probe('test-theme')['passed'])

    def test_blank_project_and_first_default_publication_are_distinct(self):
        for count, mode in ((4, 'group'), (0, 'demo')):
            with self.subTest(mode=mode):
                state = self.create(count, mode)
                self.assertEqual([], state['project']['builtKeys'])
                self.assertEqual(0, state['project']['revision'])
                self.assertIsNone(state['project']['lastChange'])
                state = self.start_build()
                self.assertEqual([], state['project']['builtKeys'])
                state = self.submit('design-title', DEFAULTS['title'])
                self.assertEqual(['title'], state['project']['builtKeys'])
                self.assertEqual(1, state['project']['revision'])
                change = state['project']['lastChange']
                self.assertEqual('title', change['key'])
                self.assertEqual('home', change['view'])
                self.assertEqual('publish', change['kind'])
                self.assertEqual('A tanár', change['actor'])
                self.assertEqual(change['eventId'], state['events'][-1]['id'])
                self.assertEqual('title', state['events'][-1]['key'])
                retry = self.submit('design-title', DEFAULTS['title'])
                self.assertEqual(state['project'], retry['project'])
                self.assertEqual(state['events'], retry['events'])

    def test_publication_attribution_and_issue_never_remove_visible_work(self):
        self.create()
        self.start_build()
        token = next(token for token in self.tokens
                     if 'code-buttonTarget' in self.state(token)['self']['taskIds'])
        name = self.state(token)['self']['name']
        state = self.submit('code-buttonTarget', 'programs', token)
        self.assertEqual(name, state['project']['lastChange']['actor'])
        self.assertEqual(['buttonTarget'], state['project']['builtKeys'])
        self.probe('test-buttonTarget')
        state = self.submit('test-buttonTarget', 'report')
        self.assertEqual(['buttonTarget'], state['project']['builtKeys'])
        self.assertEqual(1, state['project']['revision'])
        self.assertEqual('programs', state['project']['config']['buttonTarget'])
        self.assertEqual('test-report', state['project']['lastChange']['kind'])
        repaired = self.submit('code-buttonTarget', 'signup', token)
        self.assertEqual(['buttonTarget'], repaired['project']['builtKeys'])
        self.assertEqual(2, repaired['project']['revision'])
        self.assertEqual('publish', repaired['project']['lastChange']['kind'])

    def test_legacy_published_values_and_phase_changes_do_not_fill_missing_work(self):
        self.create(35)
        self.start_build()
        room = server.load(self.code)
        next(task for task in room['tasks'] if task['key'] == 'hero').update(value='code', done=True)
        room['project'].pop('lastChange', None)
        server.save(room)
        state = self.state()
        self.assertEqual(['hero'], state['project']['builtKeys'])
        self.assertIsNone(state['project']['lastChange'])
        self.control('next')
        self.control('next')
        state = self.control('finish')
        self.assertEqual(['hero'], state['project']['builtKeys'])
        self.assertEqual(1, state['progress']['done'])
        self.assertEqual(0, state['project']['revision'])

    def test_demo_contains_full_project_and_test_prerequisites_are_visible_work(self):
        state = self.create(0, 'demo')
        self.assertEqual(36, len(state['tasks']))
        self.start_build()
        state = self.submit('code-feedback', 'visible')
        self.assertEqual('locked', self.task(state, 'test-feedback')['status'])
        self.probe('test-feedback', expected=409)
        self.submit('code-formRule', 'nonempty')
        self.assertTrue(self.probe('test-feedback')['passed'])
        state = self.submit('code-filterRule', 'match')
        self.assertEqual('locked', self.task(state, 'test-filterRule')['status'])
        self.submit('design-cardCode', 'create')
        self.probe('test-filterRule', expected=409)
        self.submit('design-cardNetwork', 'connect')
        self.assertTrue(self.probe('test-filterRule')['passed'])
        self.create()
        self.start_build()
        self.submit('code-buttonTarget', 'signup')
        self.assertTrue(self.probe('test-buttonTarget')['passed'])
        self.assertNotIn('formRule', self.state()['project']['builtKeys'])

    def test_live_test_preview_is_private_attributed_temporary_and_not_publication(self):
        self.create()
        self.start_build()
        tester = next(token for token in self.tokens
                      if 'test-buttonTarget' in self.state(token)['self']['taskIds'])
        action = dict(code=self.code, token=tester, taskId='test-buttonTarget',
                      action='cta', view='signup', result='empty')
        self.post('preview-action', action, 409)
        self.submit('code-buttonTarget', 'signup')
        before = self.state()['project']
        self.post('preview-action', dict(action, token='spectator'), 403)
        self.post('preview-action', dict(action, token=self.tokens[0]), 403)
        self.post('preview-action', dict(action, result='Kitalált kutyanév'), 400)
        self.post('preview-action', dict(action, dogName='Bodri'), 400)
        self.post('preview-action', dict(action, view='https://example.com'), 400)
        self.post('preview-action', action)
        state = self.state()
        live = state['project']['liveTest']
        self.assertEqual(self.state(tester)['self']['name'], live['actor'])
        self.assertEqual('signup', live['view'])
        self.assertEqual('cta', live['action'])
        self.assertEqual('empty', live['result'])
        self.assertEqual(before['revision'], state['project']['revision'])
        self.assertEqual(before['lastChange'], state['project']['lastChange'])
        self.assertEqual(before['builtKeys'], state['project']['builtKeys'])
        self.assertNotIn(tester, json.dumps(live))
        self.post('preview-action', dict(action, action='back', view='home'))
        self.assertEqual(live, self.state()['project']['liveTest'])
        with patch('server.time.time', return_value=live['at'] + 6):
            self.assertIsNone(self.state()['project']['liveTest'])
        self.control('pause')
        self.post('preview-action', action, 409)
        self.control('resume')
        self.control('close')
        self.post('preview-action', action, 409)

    def test_live_choice_is_attributed_without_publishing_or_invalidating_probe(self):
        self.create()
        self.start_build()
        self.submit('code-buttonTarget', 'signup')
        self.probe('test-buttonTarget')
        token = next(token for token in self.tokens
                     if 'code-buttonTarget' in self.state(token)['self']['taskIds'])
        before = self.state()
        baseline_tasks = server.load(self.code)['tasks']
        action = dict(code=self.code, token=token, taskId='code-buttonTarget',
                      value='programs', baseValue='signup', baseVersion=1)
        self.post('try', action)
        state = self.state()
        self.assertEqual(before['project']['config'], state['project']['config'])
        self.assertEqual(before['project']['revision'], state['project']['revision'])
        self.assertEqual(before['project']['builtKeys'], state['project']['builtKeys'])
        self.assertEqual(before['project']['lastChange'], state['project']['lastChange'])
        self.assertEqual(before['progress'], state['progress'])
        self.assertEqual(before['events'], state['events'])
        self.assertEqual(baseline_tasks, server.load(self.code)['tasks'])
        draft = state['project']['liveDrafts'][0]
        self.assertEqual('buttonTarget', draft['key'])
        self.assertEqual('programs', draft['value'])
        self.assertEqual(self.state(token)['self']['name'], draft['actor'])
        self.assertNotIn(token, json.dumps(draft))
        self.submit('test-buttonTarget', 'confirm')  # The published version's probe remains valid.
        published = self.submit('code-buttonTarget', 'programs', token)
        self.assertEqual([], published['project']['liveDrafts'])
        self.assertEqual('programs', published['project']['config']['buttonTarget'])
        self.assertEqual(before['project']['revision'] + 1, published['project']['revision'])
        self.post('try', action, 409)  # Delayed choice from before publication cannot return.

    def test_live_choice_replaces_actor_draft_expires_and_does_not_build(self):
        self.create()
        self.start_build()
        token = self.tokens[0]  # The small group's designer owns theme and title.
        first = dict(code=self.code, token=token, taskId='design-title', value='future', baseValue=None, baseVersion=0)
        self.post('try', first)
        draft = self.state()['project']['liveDrafts'][0]
        self.post('try', dict(first, taskId='design-theme', value='mint'))
        state = self.state()
        self.assertEqual(1, len(state['project']['liveDrafts']))
        self.assertGreater(state['project']['liveDrafts'][0]['id'], draft['id'])
        self.assertEqual('theme', state['project']['liveDrafts'][0]['key'])
        self.assertEqual([], state['project']['builtKeys'])
        self.assertEqual(0, state['project']['revision'])
        self.post('try', dict(first, token=self.host))
        state = self.state()
        self.assertEqual(2, len(state['project']['liveDrafts']))
        self.assertEqual('A tanár', state['project']['liveDrafts'][0]['actor'])
        with patch('server.time.time', return_value=time.time() + 16):
            expired = self.state()['project']
            self.assertEqual([], expired['liveDrafts'])
            self.assertEqual([], expired['builtKeys'])
            self.assertEqual(DEFAULTS, expired['config'])

    def test_live_choice_requires_active_owner_valid_choice_and_current_baseline(self):
        self.create()
        self.start_build()
        action = dict(code=self.code, token=self.tokens[0], taskId='design-title', value='future', baseValue=None, baseVersion=0)
        self.post('try', dict(action, token='spectator'), 403)
        self.post('try', dict(action, token=self.tokens[1]), 403)
        self.post('try', dict(action, token=self.host, taskId='test-buttonTarget'), 409)
        self.post('try', dict(action, value='arbitrary input'), 400)
        self.post('try', dict(action, dogName='Bodri'), 400)
        self.post('try', dict(action, baseValue='discover'), 409)
        self.post('try', dict(action, baseVersion=True), 409)
        self.post('try', dict(action, baseVersion=1), 409)
        self.post('try', {key: value for key, value in action.items() if key != 'baseValue'}, 409)
        self.post('try', {key: value for key, value in action.items() if key != 'baseVersion'}, 409)
        self.control('pause')
        self.post('try', action, 409)
        self.control('resume')
        self.post('try', action)
        self.post('leave', dict(code=self.code, token=action['token']))
        self.assertEqual([], self.state()['project']['liveDrafts'])
        self.post('try', action, 409)
        self.post('resume', dict(code=self.code, token=action['token']))
        self.post('try', action)
        player_id = self.state(action['token'])['self']['id']
        self.control('remove-player', playerId=player_id)
        self.assertEqual([], self.state()['project']['liveDrafts'])
        self.post('try', action, 403)
        self.control('close')
        self.post('try', dict(action, token=self.host), 409)

    def test_live_choices_filter_legacy_inactive_revoked_or_reassigned_actor(self):
        self.create()
        self.start_build()
        token = self.tokens[0]
        action = dict(code=self.code, token=token, taskId='design-title', value='future', baseValue=None, baseVersion=0)
        self.post('try', action)
        room = server.load(self.code)
        actor_id = room['players'][token]['id']
        room['players'][token]['active'] = False
        server.save(room)
        self.assertEqual([], self.state()['project']['liveDrafts'])
        room['players'][token]['active'] = True
        next(task for task in room['tasks'] if task['id'] == 'design-title')['ownerId'] = None
        server.save(room)
        self.assertEqual([], self.state()['project']['liveDrafts'])
        next(task for task in room['tasks'] if task['id'] == 'design-title')['ownerId'] = actor_id
        room['players'].pop(token)
        server.save(room)
        self.assertEqual([], self.state()['project']['liveDrafts'])

    def test_visual_reviews_wait_for_the_element_they_change(self):
        self.create(0, 'demo')
        self.start_build()
        self.submit('design-headingSize', 'large')
        self.probe('test-headingSize', expected=409)
        self.submit('design-title', 'discover')
        self.assertTrue(self.probe('test-headingSize')['passed'])
        self.submit('design-borderStyle', 'soft')
        self.probe('test-borderStyle', expected=409)
        self.submit('design-layout', 'cards')
        self.assertTrue(self.probe('test-borderStyle')['passed'])

    def test_live_previews_are_hidden_when_paused_or_presenting_final_work(self):
        for action in ('pause', 'handover', 'finish', 'close'):
            with self.subTest(action=action):
                self.create(0, 'demo')
                self.start_build()
                self.submit('code-buttonTarget', 'signup')
                self.post('try', dict(code=self.code, token=self.host,
                                     taskId='design-title', value='future', baseValue=None, baseVersion=0))
                self.post('preview-action', dict(code=self.code, token=self.host,
                          taskId='test-buttonTarget', action='cta', view='signup', result='empty'))
                before = self.state()['project']
                self.assertEqual(1, len(before['liveDrafts']))
                self.assertIsNotNone(before['liveTest'])
                if action == 'handover':
                    review = self.control('next')['project']
                    self.assertEqual(before['liveDrafts'], review['liveDrafts'])
                    self.assertEqual(before['liveTest'], review['liveTest'])
                    state = self.control('next')
                else:
                    state = self.control(action)
                self.assertEqual([], state['project']['liveDrafts'])
                self.assertIsNone(state['project']['liveTest'])
                self.assertEqual(before['builtKeys'], state['project']['builtKeys'])
                self.assertEqual(before['config'], state['project']['config'])
                self.assertEqual(before['revision'], state['project']['revision'])

    def test_same_value_publication_rejects_a_delayed_older_draft(self):
        self.create()
        self.start_build()
        first = self.submit('design-title', 'discover')
        first_version = self.task(first, 'design-title')['publishVersion']
        self.assertEqual(1, first_version)
        old_attempt = dict(code=self.code, token=self.host, taskId='design-title',
                           value='future', baseValue='discover', baseVersion=first_version)
        self.post('try', old_attempt)
        published = self.submit('design-title', 'discover')
        self.assertEqual(2, self.task(published, 'design-title')['publishVersion'])
        self.assertEqual(first['project']['revision'], published['project']['revision'])
        self.assertEqual([], published['project']['liveDrafts'])
        self.post('try', old_attempt, 409)
        self.assertEqual([], self.state()['project']['liveDrafts'])
        self.post('try', dict(old_attempt, baseVersion=2))
        self.assertEqual('future', self.state()['project']['liveDrafts'][0]['value'])

    def test_pause_freezes_time_and_disallows_edits(self):
        self.create()
        self.start_build()
        paused = self.control('pause')
        now = time.time()
        with patch('server.time.time', return_value=now + 1000):
            state = self.state()
            self.assertEqual(paused['remaining'], state['remaining'])
            self.assertEqual('build', state['phase'])
            self.submit('design-theme', 'mint', expected=409)
        self.assertFalse(self.control('resume')['paused'])
        self.submit('design-theme', 'mint')

    def test_phases_catch_up_and_finish_without_claiming_complete(self):
        self.create()
        start = time.time()
        state = self.control('start')
        self.assertTrue(state['automatic'])
        self.assertEqual(360, state['sessionRemaining'])
        self.submit('design-theme', 'mint', expected=409)
        with patch('server.time.time', return_value=start + 46):
            self.assertEqual('build', self.state()['phase'])
        with patch('server.time.time', return_value=start + 211):
            self.assertEqual('review', self.state()['phase'])
        with patch('server.time.time', return_value=start + 301):
            self.assertEqual('handover', self.state()['phase'])
            self.submit('design-theme', 'mint', expected=409)
        with patch('server.time.time', return_value=start + 361):
            state = self.state()
            self.assertEqual('finished', state['status'])
            self.assertEqual(0, state['progress']['done'])
            self.assertEqual(0, state['remaining'])

    def test_expiry_and_legacy_rooms_are_cleanly_rejected(self):
        self.create()
        room = server.load(self.code)
        room['created'] = time.time() - 86401
        server.save(room)
        self.assertEqual(404, self.client.get('/api/state', query_string={'code': self.code}).status_code)
        room['created'] = time.time()
        room.pop('schema')
        server.save(room)
        self.assertEqual(410, self.client.get('/api/state', query_string={'code': self.code}).status_code)
        self.post('join', dict(code=self.code, name='Valaki'), 410)
        self.post('answer', dict(code=self.code, answer='quantity'), 410)

    def test_invalid_data_cors_and_static_allowlist(self):
        self.create()
        self.start_build()
        self.submit('design-theme', '<script>', expected=400)
        self.submit('design-theme', {}, expected=400)
        self.post('task', dict(code=self.code, token={}, taskId='design-theme', value='mint'), 403)
        self.post('task', dict(code=self.code, token=self.host, taskId={}, value='mint'), 404)
        self.post('create', dict(admin={}, mode='group'), 401)
        self.post('create', dict(admin=self.admin, mode='oops'), 400)
        self.post('join', dict(code=self.code, name=[]), 400)
        self.assertEqual(415, self.client.post('/api/task', data='oops').status_code)
        self.assertEqual(400, self.client.post('/api/task', json=[]).status_code)
        self.assertEqual(403, self.client.get('/api/state?code=' + self.code, headers={'Origin': 'https://evil.example'}).status_code)
        self.assertEqual(204, self.client.options('/api/task', headers={'Origin': 'https://sandornefr.github.io'}).status_code)
        for secret in ('server.py', 'project.py', 'requirements.txt', '.env', 'games.sqlite3'):
            self.assertEqual(404, self.client.get('/' + secret).status_code)
        for name in ('grooming.jpg', 'bath.jpg', 'dog.jpg'):
            with self.subTest(photo=name), self.client.get('/assets/' + name) as response:
                self.assertEqual(200, response.status_code)
                self.assertEqual('image/jpeg', response.mimetype)
                self.assertTrue(response.data.startswith(b'\xff\xd8\xff'))
                self.assertTrue(response.data.endswith(b'\xff\xd9'))
        for path in ('/assets/SOURCES.txt', '/assets/server.py', '/assets/missing.jpg',
                     '/assets/%2e%2e%2fserver.py', '/assets/%2e%2e%5cserver.py'):
            with self.subTest(blocked_asset=path):
                self.assertEqual(404, self.client.get(path).status_code)
        self.assertEqual('kodlabor-2', self.client.get('/health').get_json()['version'])

    def test_idempotent_create_join_control(self):
        data = dict(admin=self.admin, mode='group', requestId='create-once-123')
        first = self.post('create', data)
        self.assertEqual(first, self.post('create', data))
        self.code, self.host = first['code'], first['token']
        joining = dict(code=self.code, name='Egy valaki', requestId='join-once-123')
        self.assertEqual(self.post('join', joining), self.post('join', joining))
        for index in range(3):
            self.post('join', dict(code=self.code, name=f'Társ {index}'))
        self.control('start')
        self.control('next', requestId='next-once-123')
        self.assertEqual('build', self.control('next', requestId='next-once-123')['phase'])
        self.control('pause', requestId='pause-once-123')
        self.assertTrue(self.control('pause', requestId='pause-once-123')['paused'])

    def test_late_join_preserves_existing_completed_work(self):
        self.create()
        self.start_build()
        self.submit('design-theme', 'mint')
        before = self.state()
        joined = self.post('join', dict(code=self.code, name='Később érkező'))
        after = self.state(joined['token'])
        self.assertTrue(after['self']['taskIds'])
        self.assertEqual('mint', after['project']['config']['theme'])
        self.assertEqual(self.task(before, 'design-theme')['ownerId'], self.task(after, 'design-theme')['ownerId'])
        self.assertEqual('done', self.task(after, 'design-theme')['status'])

    def test_resume_full_room_keeps_identity_assignments_and_completed_work(self):
        self.create(35)
        self.start_build()
        token = self.tokens[0]
        before = self.state(token)
        owned = before['self']['taskIds']
        task = self.task(before, owned[0])
        self.submit(task['id'], task['options'][0]['value'], token)
        completed = self.state(token)
        self.post('leave', dict(code=self.code, token=token))
        self.assertEqual(34, self.state()['connectedCount'])
        resumed = self.post('resume', dict(code=self.code, token=token))
        self.assertEqual(dict(code=self.code, token=token), resumed)
        after = self.state(token)
        self.assertEqual(35, len(after['players']))
        self.assertEqual(35, after['connectedCount'])
        self.assertEqual(before['self']['id'], after['self']['id'])
        self.assertEqual(before['self']['role'], after['self']['role'])
        self.assertEqual(owned, after['self']['taskIds'])
        self.assertEqual(completed['tasks'], after['tasks'])
        self.assertEqual(completed['project'], after['project'])
        self.assertEqual(completed['progress'], after['progress'])
        self.assertTrue(after['self']['active'])
        self.assertTrue(after['self']['connected'])

    def test_presence_expires_without_heartbeat_and_does_not_discard_tasks(self):
        self.create()
        self.start_build()
        original = self.state()
        room = server.load(self.code)
        for person in room['players'].values():
            person['lastSeen'] = time.time() - server.PRESENCE_TIMEOUT - 1
        server.save(room)
        stale = self.state(self.host)
        self.assertEqual(0, stale['connectedCount'])
        self.assertTrue(all(person['active'] and not person['connected'] for person in stale['players']))
        self.assertEqual(original['tasks'], stale['tasks'])
        self.assertEqual(0, self.state()['connectedCount'])  # Spectators do not keep players alive.
        online = self.state(self.tokens[0])
        self.assertTrue(online['self']['connected'])
        self.assertEqual(1, online['connectedCount'])
        self.assertGreater(server.load(self.code)['players'][self.tokens[0]]['lastSeen'], time.time() - 2)
        self.assertEqual(original['tasks'], online['tasks'])

    def test_leave_is_idempotent_and_polling_cannot_undo_an_explicit_exit(self):
        self.create()
        self.start_build()
        token = self.tokens[0]
        original = self.state(token)
        self.assertEqual(dict(ok=True), self.post('leave', dict(code=self.code, token=token)))
        left = self.state(token)
        self.assertFalse(left['self']['active'])
        self.assertFalse(left['self']['connected'])
        self.assertEqual(3, left['connectedCount'])
        self.post('leave', dict(code=self.code, token=token))
        self.assertEqual(left['events'], self.state(token)['events'])
        self.assertEqual(original['self']['taskIds'], left['self']['taskIds'])
        self.assertEqual(original['tasks'], left['tasks'])
        self.post('resume', dict(code=self.code, token=token))
        self.assertTrue(self.state(token)['self']['connected'])

    def test_only_connected_players_count_toward_start_and_receive_initial_tasks(self):
        self.create(5)
        room = server.load(self.code)
        for person in room['players'].values():
            person['lastSeen'] = time.time() - server.PRESENCE_TIMEOUT - 1
        ghost_id = room['players'][self.tokens[4]]['id']
        server.save(room)
        for token in self.tokens[:3]:
            self.state(token)
        self.assertEqual(3, self.state()['connectedCount'])
        self.control('start', expected=409)
        self.post('resume', dict(code=self.code, token=self.tokens[3]))
        started = self.control('start')
        self.assertEqual(4, started['connectedCount'])
        self.assertEqual('working', started['status'])
        self.assertEqual(0, next(person for person in started['players'] if person['id'] == ghost_id)['total'])
        self.assertNotIn(ghost_id, [task['ownerId'] for task in started['tasks']])
        self.assertEqual(4, len({task['ownerId'] for task in started['tasks']}))
        # A backgrounded tab can return by its ordinary poll, without reloading or rejoining.
        returned = self.state(self.tokens[4])
        self.assertTrue(returned['self']['taskIds'])
        self.assertEqual(ghost_id, returned['self']['id'])
        repeated = self.state(self.tokens[4])
        self.assertEqual(returned['self']['taskIds'], repeated['self']['taskIds'])
        self.assertEqual(returned['tasks'], repeated['tasks'])
        self.assertEqual(5, repeated['connectedCount'])

    def test_resume_requires_private_token_and_public_state_never_exposes_it(self):
        self.create()
        token = self.tokens[0]
        name = self.state(token)['self']['name']
        self.post('leave', dict(code=self.code, token=token))
        self.post('join', dict(code=self.code, name=name), expected=409)
        for invalid in (None, {}, 'not-a-player-token', self.host):
            with self.subTest(token_type=type(invalid).__name__):
                self.post('resume', dict(code=self.code, token=invalid, name=name), expected=403)
                self.post('leave', dict(code=self.code, token=invalid), expected=403)
        self.assertFalse(self.state(token)['self']['active'])
        self.post('resume', dict(code=self.code, token=token))
        public = json.dumps(self.state())
        for secret in self.tokens + [self.host, self.admin]:
            self.assertNotIn(secret, public)
        self.assertNotIn('lastSeen', public)

    def test_teacher_removal_revokes_access_and_frees_work_without_resetting_it(self):
        self.create(3)
        joining = dict(code=self.code, name='Visszatérő', requestId='removed-join-once-123')
        token = self.post('join', joining)['token']
        self.start_build()
        before = self.state(token)
        player_id = before['self']['id']
        self.submit('code-buttonTarget', 'signup')
        self.probe('test-buttonTarget', token)
        self.submit('test-buttonTarget', 'confirm', token)
        completed = self.state()
        self.post('control', dict(code=self.code, token=self.tokens[0], action='remove-player', playerId=player_id), expected=403)
        removed = self.control('remove-player', playerId=player_id, requestId='remove-member-once-123')
        self.assertEqual(3, len(removed['players']))
        self.assertNotIn(player_id, [person['id'] for person in removed['players']])
        self.assertEqual(completed['project'], removed['project'])
        self.assertEqual(completed['progress'], removed['progress'])
        for task in completed['tasks']:
            current = self.task(removed, task['id'])
            expected_owner = None if task['ownerId'] == player_id else task['ownerId']
            self.assertEqual(expected_owner, current['ownerId'])
            self.assertEqual(task['status'], current['status'])
            self.assertEqual(task['value'], current['value'])
        stored = server.load(self.code)
        self.assertNotIn(token, stored['players'])
        self.assertNotIn(token, stored['joinRequests'].values())
        self.assertTrue(all(token not in task['probes'] for task in stored['tasks']))
        self.post('resume', dict(code=self.code, token=token), expected=403)
        self.post('leave', dict(code=self.code, token=token), expected=403)
        self.assertNotIn('self', self.state(token))
        self.probe('test-buttonTarget', token, expected=403)
        self.assertEqual(removed['events'], self.control('remove-player', playerId=player_id, requestId='remove-member-once-123')['events'])
        rejoined = self.post('join', joining)
        self.assertNotEqual(token, rejoined['token'])
        self.assertNotEqual(player_id, self.state(rejoined['token'])['self']['id'])

    def test_returning_player_survives_backend_restart_with_saved_progress(self):
        self.create()
        self.start_build()
        token = self.tokens[0]
        before = self.state(token)
        self.submit('design-theme', 'amber', token)
        self.post('leave', dict(code=self.code, token=token))
        env = dict(os.environ, DATA_PATH=server.DB_PATH)
        script = ('import json,server; c=server.app.test_client(); '
                  'r=c.post("/api/resume",json=' + repr(dict(code=self.code, token=token)) + '); '
                  'assert r.status_code == 200, r.get_json(); '
                  's=c.get("/api/state",query_string=' + repr(dict(code=self.code)) + ',headers='
                  + repr(dict(Authorization='Bearer ' + token)) + '); print(json.dumps(s.get_json()))')
        run = subprocess.run([sys.executable, '-c', script], capture_output=True, text=True, env=env, check=True)
        resumed = json.loads(run.stdout)
        self.assertEqual(before['self']['id'], resumed['self']['id'])
        self.assertEqual(before['self']['taskIds'], resumed['self']['taskIds'])
        self.assertTrue(resumed['self']['connected'])
        self.assertEqual('amber', resumed['project']['config']['theme'])
        self.assertEqual('done', self.task(resumed, 'design-theme')['status'])

    def test_concurrent_resume_creates_no_duplicate_player_or_assignment(self):
        self.create()
        self.start_build()
        token = self.tokens[0]
        original = self.state(token)
        self.post('leave', dict(code=self.code, token=token))

        def resume(_index):
            with server.app.test_client() as client:
                return self.post('resume', dict(code=self.code, token=token), client=client)

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            resumed = list(executor.map(resume, range(8)))
        self.assertTrue(all(result == dict(code=self.code, token=token) for result in resumed))
        final = self.state(token)
        self.assertEqual(4, len(final['players']))
        self.assertEqual(original['self']['id'], final['self']['id'])
        self.assertEqual(original['tasks'], final['tasks'])
        self.assertEqual(4, final['connectedCount'])

    def test_resume_cannot_reopen_closed_or_expired_groups(self):
        self.create()
        token = self.tokens[0]
        self.post('leave', dict(code=self.code, token=token))
        self.control('close')
        self.post('resume', dict(code=self.code, token=token), expected=409)
        self.assertFalse(self.state(token)['self']['active'])
        room = server.load(self.code)
        room['created'] = time.time() - server.TTL - 1
        server.save(room)
        self.post('resume', dict(code=self.code, token=token), expected=404)

    def test_database_survives_new_python_process(self):
        self.create()
        self.start_build()
        self.submit('design-theme', 'amber')
        env = dict(os.environ, DATA_PATH=server.DB_PATH)
        script = 'import json,server; r=server.app.test_client().get("/api/state",query_string={"code":' + repr(self.code) + '},headers={"Authorization":"Bearer " + ' + repr(self.host) + '}); print(json.dumps(r.get_json()))'
        run = subprocess.run([sys.executable, '-c', script], capture_output=True, text=True, env=env, check=True)
        state = json.loads(run.stdout)
        self.assertTrue(state['host'])
        self.assertEqual('amber', state['project']['config']['theme'])
        self.assertEqual('done', self.task(state, 'design-theme')['status'])

    def test_concurrent_35_players_keep_all_submissions(self):
        self.create(35)
        self.start_build()
        state = self.state()
        for task in state['tasks']:
            if task['kind'] != 'test':
                self.submit(task['id'], DEFAULTS[task['key']])
        assignments = [(token, self.state(token)['self']['taskIds']) for token in self.tokens]

        def work(assignment):
            token, ids = assignment
            with server.app.test_client() as client:
                for task_id in ids:
                    task = self.task(state, task_id)
                    if task['kind'] == 'test':
                        self.probe(task_id, token, client=client)
                        self.submit(task_id, 'confirm', token, client=client)
                    else:
                        self.submit(task_id, DEFAULTS[task['key']], token, client=client)
            return True

        with concurrent.futures.ThreadPoolExecutor(max_workers=35) as executor:
            self.assertTrue(all(executor.map(work, assignments)))
        final = self.state()
        self.assertEqual({'done': 36, 'total': 36}, final['progress'])
        self.assertEqual(35, len(final['players']))
        self.assertEqual(DEFAULTS, final['project']['config'])

    def test_close_is_idempotent_and_blocks_actions(self):
        self.create()
        self.start_build()
        self.assertEqual('closed', self.control('close')['status'])
        self.assertEqual('closed', self.control('close')['status'])
        self.submit('design-theme', 'mint', expected=409)
        self.post('join', dict(code=self.code, name='Még egy'), 409)


if __name__ == '__main__':
    unittest.main()

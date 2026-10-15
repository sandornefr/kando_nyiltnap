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
        self.control('start')
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
        self.assertEqual('kodlabor-1', self.client.get('/health').get_json()['version'])

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

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('./viewport.js'), 'utf8');

function surface(width = 820, height = 1100, visual = true) {
  const listeners = new Map();
  const target = () => {
    const events = new Map();
    const result = {addEventListener(type, callback) {
      if (!events.has(type)) events.set(type, []);
      events.get(type).push(callback);
    }};
    listeners.set(result, events);
    return result;
  };
  const classes = new Set();
  const properties = new Map();
  const document = Object.assign(target(), {
    activeElement: {tagName: 'BODY'},
    documentElement: {
      clientHeight: height,
      clientWidth: width,
      style: {setProperty: (key, value) => properties.set(key, value)},
      classList: {toggle: (key, enabled) => enabled ? classes.add(key) : classes.delete(key)}
    }
  });
  const viewport = visual ? Object.assign(target(), {height, width, scale: 1}) : undefined;
  const orientation = target();
  const window = Object.assign(target(), {innerHeight: height, innerWidth: width,
    visualViewport: viewport, screen: {orientation}});
  let sequence = 0;
  const frames = new Map();
  vm.runInNewContext(source, {document, window,
    requestAnimationFrame(callback) {frames.set(++sequence, callback); return sequence;},
    cancelAnimationFrame(id) {frames.delete(id);}
  });
  function flush() {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback());
  }
  function emit(element, event) { (listeners.get(element).get(event) || []).forEach(callback => callback()); }
  function focus(element = {tagName: 'INPUT', type: 'text'}) {
    document.activeElement = element;
    emit(document, 'focusin');
    flush();
  }
  function blur() {
    document.activeElement = {tagName: 'BODY'};
    emit(document, 'focusout');
    flush();
  }
  flush();
  return {window, document, viewport, orientation, frames, flush, emit, focus, blur,
    keyboard: () => classes.has('keyboard-open'),
    height: () => Number.parseFloat(properties.get('--visible-height'))};
}

test('iPad software keyboard reduces available height and closes after viewport restoration', () => {
  const page = surface();
  assert.equal(page.height(), 1100);
  assert.equal(page.keyboard(), false);
  page.focus();
  assert.equal(page.keyboard(), false);
  page.viewport.height = 660;
  page.emit(page.viewport, 'resize');
  page.flush();
  assert.equal(page.height(), 660);
  assert.equal(page.keyboard(), true);
  page.viewport.height = 1100;
  page.emit(page.viewport, 'resize');
  page.flush();
  assert.equal(page.height(), 1100);
  assert.equal(page.keyboard(), false);
});

test('blur keeps controls in place until the keyboard has finished closing', () => {
  const page = surface();
  page.focus({tagName: 'TEXTAREA'});
  page.viewport.height = 650;
  page.emit(page.viewport, 'resize');
  page.flush();
  assert.equal(page.keyboard(), true);
  page.blur();
  assert.equal(page.keyboard(), true);
  assert.equal(page.height(), 650);
  page.viewport.height = 1000;
  page.emit(page.viewport, 'resize');
  page.flush();
  assert.equal(page.keyboard(), true, 'partial closing animation must not move controls');
  page.viewport.height = 1100;
  page.emit(page.viewport, 'resize');
  page.flush();
  assert.equal(page.keyboard(), false);
});

test('pinch zoom does not masquerade as a keyboard or reflow the layout again', () => {
  const page = surface();
  page.focus();
  for (const scale of [1.5, 2, 3]) {
    page.viewport.scale = scale;
    page.viewport.height = page.window.innerHeight / scale;
    page.emit(page.viewport, 'resize');
    page.flush();
    assert.equal(page.keyboard(), false);
    assert.equal(page.height(), 1100);
  }
  page.viewport.scale = .8;
  page.viewport.height = 1500;
  page.emit(page.viewport, 'resize');
  page.flush();
  assert.equal(page.keyboard(), false);
  assert.equal(page.height(), 1100, 'visible layout height is clamped to the layout viewport');
});

test('editable focus and a meaningful reduction are both required', () => {
  const page = surface();
  page.viewport.height = 650;
  page.emit(page.viewport, 'resize');
  page.flush();
  assert.equal(page.keyboard(), false);
  for (const element of [{tagName: 'BUTTON'}, {tagName: 'INPUT', type: 'checkbox'},
    {tagName: 'INPUT', type: 'range'}, {tagName: 'INPUT', type: 'text', readOnly: true},
    {tagName: 'TEXTAREA', disabled: true}]) {
    page.focus(element);
    assert.equal(page.keyboard(), false);
  }
  page.focus({tagName: 'DIV', isContentEditable: true});
  assert.equal(page.keyboard(), true);
  page.viewport.height = 1100;
  page.emit(page.viewport, 'resize');
  page.flush();
  page.viewport.height = 1030;
  page.emit(page.viewport, 'resize');
  page.flush();
  assert.equal(page.keyboard(), false, 'a browser toolbar change is not a keyboard');
});

test('portrait and landscape resize use current dimensions instead of an old keyboard baseline', () => {
  const page = surface();
  page.focus();
  page.window.innerWidth = 1100;
  page.window.innerHeight = 820;
  page.viewport.width = 1100;
  page.viewport.height = 820;
  page.emit(page.window, 'orientationchange');
  page.emit(page.window, 'resize');
  page.emit(page.viewport, 'resize');
  assert.equal(page.frames.size, 1, 'resize bursts are coalesced');
  page.flush();
  assert.equal(page.height(), 820);
  assert.equal(page.keyboard(), false);
  page.viewport.height = 480;
  page.emit(page.viewport, 'resize');
  page.flush();
  assert.equal(page.keyboard(), true);
  page.window.innerWidth = 820;
  page.window.innerHeight = 1100;
  page.viewport.height = 1100;
  page.emit(page.orientation, 'change');
  page.flush();
  assert.equal(page.height(), 1100);
  assert.equal(page.keyboard(), false);
});

test('pageshow refreshes a restored page even when no resize event fires', () => {
  const page = surface();
  page.focus();
  page.viewport.height = 650;
  page.emit(page.viewport, 'resize');
  page.flush();
  assert.equal(page.keyboard(), true);
  page.document.activeElement = {tagName: 'BODY'};
  page.viewport.height = 1100;
  page.emit(page.window, 'pageshow');
  page.flush();
  assert.equal(page.height(), 1100);
  assert.equal(page.keyboard(), false);
});

test('without visualViewport, editable resize is compared with the previous resting height', () => {
  const page = surface(390, 700, false);
  page.focus({tagName: 'INPUT', type: 'tel'});
  page.window.innerHeight = 420;
  page.emit(page.window, 'resize');
  page.flush();
  assert.equal(page.height(), 420);
  assert.equal(page.keyboard(), true);
  page.blur();
  assert.equal(page.keyboard(), true, 'fallback also preserves keyboard layout during blur');
  page.window.innerHeight = 620;
  page.emit(page.window, 'resize');
  page.flush();
  assert.equal(page.keyboard(), true, 'blur must not overwrite the resting-height baseline');
  page.window.innerHeight = 700;
  page.emit(page.window, 'resize');
  page.flush();
  assert.equal(page.keyboard(), false);
  page.focus();
  page.window.innerWidth = 700;
  page.window.innerHeight = 390;
  page.emit(page.window, 'orientationchange');
  page.emit(page.window, 'resize');
  page.flush();
  assert.equal(page.height(), 390);
  assert.equal(page.keyboard(), false, 'rotation is not a keyboard opening');
});

test('rotation resets a closing-keyboard fallback without carrying portrait height into landscape', () => {
  const page = surface(820, 1100, false);
  page.focus();
  page.window.innerHeight = 650;
  page.emit(page.window, 'resize');
  page.flush();
  page.blur();
  assert.equal(page.keyboard(), true);
  page.window.innerWidth = 1100;
  page.window.innerHeight = 820;
  page.emit(page.window, 'orientationchange');
  page.emit(page.window, 'resize');
  page.flush();
  assert.equal(page.keyboard(), false);
  assert.equal(page.height(), 820);
});

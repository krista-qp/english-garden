import test from 'node:test';
import assert from 'node:assert/strict';
import { isUnderstood, normalise } from '../js/check.js';

test('normalise expands contractions and strips punctuation', () => {
  assert.deepEqual(normalise("I'm from Latvia."), ['i', 'am', 'from', 'latvia']);
  assert.deepEqual(normalise('I don’t understand!'), ['i', 'do', 'not', 'understand']);
  assert.deepEqual(normalise("What's that?"), ['what', 'is', 'that']);
});

test('short phrases must match fully, hello variants allowed', () => {
  assert.ok(isUnderstood('Hello.', ['hallo']));
  assert.ok(isUnderstood('Hello.', ['Hullo there']));
  assert.ok(!isUnderstood('Hello.', ['yellow']));
  assert.ok(isUnderstood('A little.', ['a little']));
  assert.ok(!isUnderstood('A little.', ['little']));
  assert.ok(isUnderstood('Sorry?', ['sorry']));
});

test('longer phrases need 60% of tokens in any alternative', () => {
  const p = 'Can you write it, please?';
  assert.ok(isUnderstood(p, ['can you right it please']));
  assert.ok(isUnderstood(p, ['banana', 'you write it please']));
  assert.ok(!isUnderstood(p, ['can I eat']));
  assert.ok(isUnderstood("I'm from Latvia.", ['I am from Latvia']));
  assert.ok(isUnderstood("I don't understand.", ["I don't understand"]));
});

test('name is optional, the rest must match', () => {
  const p = 'My name is {name}.';
  assert.ok(isUnderstood(p, ['my name is Ilze'], 'Ilze'));
  assert.ok(isUnderstood(p, ['my name is Elsa'], 'Ilze'));
  assert.ok(isUnderstood(p, ['my name is Līga'], 'Līga'));
  assert.ok(!isUnderstood(p, ['Ilze'], 'Ilze'));
});

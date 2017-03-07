/* @flow */

import flatMapR from './flatMapR';

import LiveSet from '.';
import transduce from './transduce';
import t from 'transducers.js';

test('recursive pool', () => {
  const {liveSet: sources, controller: sourcesController} = LiveSet.active();
  const fmLs = flatMapR(sources, s => s);
  const s1 = LiveSet.constant(new Set([1, 2, 3, 4]));
  sourcesController.add(s1);
  expect(Array.from(fmLs.values())).toEqual([1, 2, 3, 4]);
  const s2 = transduce(fmLs, t.compose(
    t.filter(x => x < 1000),
    t.filter(x => x%2 === 0),
    t.map(x => x*10+1)
  ));
  sourcesController.add(s2);
  const s3 = transduce(fmLs, t.compose(
    t.filter(x => x < 1000),
    t.filter(x => x%2 === 1),
    t.map(x => x*10)
  ));
  sourcesController.add(s3);

  expect(() => fmLs.values()).toThrowError(
    'reading inactive recursively-flatMapped stream is not supported'
  );

  const next = jest.fn();
  const fmLsSub = fmLs.subscribe({next});
  expect(Array.from(fmLs.values())).toEqual([1, 2, 3, 4, 21, 41, 10, 30, 210, 410, 101, 301, 2101, 4101, 1010, 3010]);

  fmLsSub.pullChanges();
  expect(next.mock.calls).toEqual([
    [[
      {type: 'add', value: 101},
      {type: 'add', value: 301},
      {type: 'add', value: 2101},
      {type: 'add', value: 4101},
      {type: 'add', value: 1010},
      {type: 'add', value: 3010},
    ]]
  ]);

  sourcesController.add(LiveSet.constant(new Set([5])));
  expect(next.mock.calls.slice(1)).toEqual([]);
  fmLsSub.pullChanges();
  expect(next.mock.calls.slice(1)).toEqual([
    [[
      {type: 'add', value: 5},
      {type: 'add', value: 50},
      {type: 'add', value: 501},
      {type: 'add', value: 5010},
    ]]
  ]);
});

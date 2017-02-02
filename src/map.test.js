/* @flow */

import map from './map';
import LiveSet from '.';
import delay from 'pdelay';

test('works', async () => {
  const lsCleanup = jest.fn();
  const ls = new LiveSet({
    read: () => new Set(['1', 'one']),
    listen(controller) {
      controller.add('uno');
      setTimeout(() => {
        controller.remove('1');
        controller.add('ten');
      }, 30);
      return lsCleanup;
    }
  });

  const mapper = jest.fn(x => `:${x}`);
  const mappedLs = map(ls, mapper);

  expect(Array.from(mappedLs.values())).toEqual([':1', ':one']);
  expect(mapper.mock.calls).toEqual([
    ['1'],
    ['one']
  ]);

  const next = jest.fn();
  const sub = mappedLs.subscribe(next);

  await delay(60);

  expect(Array.from(mappedLs.values())).toEqual([':one', ':uno', ':ten']);
  expect(mapper.mock.calls).toEqual([
    ['1'],
    ['one'],
    ['1'],
    ['one'],
    ['uno'],
    ['ten']
  ]);
  expect(lsCleanup).toHaveBeenCalledTimes(0);

  sub.unsubscribe();
  await delay(0);

  expect(lsCleanup).toHaveBeenCalledTimes(1);
});

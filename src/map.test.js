/* @flow */

import map from './map';
import LiveSet from '.';
import delay from 'pdelay';

test('works', async () => {
  const lsCleanup = jest.fn();
  const ls = new LiveSet({
    read: () => new Set([{x:'1'}, {x:'one'}]),
    listen(controller) {
      const originalValues = Array.from(ls.values());
      controller.add({x:'uno'});
      setTimeout(() => {
        controller.remove(originalValues[0]);
        controller.add({x:'ten'});
      }, 30);
      return lsCleanup;
    }
  });

  const mapper = jest.fn(x => ({m:x.x}));
  const mappedLs = map(ls, mapper);

  expect(Array.from(mappedLs.values())).toEqual([{m:'1'}, {m:'one'}]);
  expect(mapper.mock.calls).toEqual([
    [{x:'1'}],
    [{x:'one'}]
  ]);

  const next = jest.fn();
  const sub = mappedLs.subscribe(next);

  await delay(60);

  expect(Array.from(mappedLs.values())).toEqual([
    {m:'one'}, {m:'uno'}, {m:'ten'}
  ]);
  expect(mapper.mock.calls).toEqual([
    [{x:'1'}],
    [{x:'one'}],
    [{x:'1'}],
    [{x:'one'}],
    [{x:'uno'}],
    [{x:'ten'}]
  ]);
  expect(lsCleanup).toHaveBeenCalledTimes(0);

  sub.unsubscribe();
  await delay(0);

  expect(lsCleanup).toHaveBeenCalledTimes(1);
});

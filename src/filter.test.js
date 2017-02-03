/* @flow */

import filter from './filter';
import LiveSet from '.';
import delay from 'pdelay';

test('works', async () => {
  const lsCleanup = jest.fn();
  const ls = new LiveSet({
    read: () => new Set([{x:1}, {x:2}]),
    listen(controller) {
      const originalValues = Array.from(ls.values());
      controller.add({x:3});
      setTimeout(() => {
        controller.remove(originalValues[0]);
        controller.remove(originalValues[1]);
        controller.add({x:4});
      }, 30);
      return lsCleanup;
    }
  });

  const filterFn = jest.fn(x => x.x % 2 === 0);
  const filteredLs = filter(ls, filterFn);

  expect(Array.from(filteredLs.values())).toEqual([{x:2}]);
  expect(filterFn.mock.calls).toEqual([
    [{x:1}],
    [{x:2}]
  ]);

  const next = jest.fn();
  const sub = filteredLs.subscribe(next);

  await delay(60);

  expect(Array.from(filteredLs.values())).toEqual([{x:4}]);
  expect(filterFn.mock.calls).toEqual([
    [{x:1}],
    [{x:2}],
    [{x:1}],
    [{x:2}],
    [{x:3}],
    [{x:4}]
  ]);
  expect(lsCleanup).toHaveBeenCalledTimes(0);

  sub.unsubscribe();
  await delay(0);

  expect(lsCleanup).toHaveBeenCalledTimes(1);
});

/* @flow */

import filter from './filter';
import LiveSet from '.';
import delay from 'pdelay';

test('works', async () => {
  const lsCleanup = jest.fn();
  const ls = new LiveSet({
    read: () => new Set([1, 2]),
    listen(controller) {
      controller.add(3);
      setTimeout(() => {
        controller.remove(1);
        controller.remove(2);
        controller.add(4);
      }, 30);
      return lsCleanup;
    }
  });

  const filterFn = jest.fn(x => x % 2 === 0);
  const filteredLs = filter(ls, filterFn);

  expect(Array.from(filteredLs.values())).toEqual([2]);
  expect(filterFn.mock.calls).toEqual([
    [1],
    [2]
  ]);

  const next = jest.fn();
  const sub = filteredLs.subscribe(next);

  await delay(60);

  expect(Array.from(filteredLs.values())).toEqual([4]);
  expect(filterFn.mock.calls).toEqual([
    [1],
    [2],
    [1],
    [2],
    [3],
    [4]
  ]);
  expect(lsCleanup).toHaveBeenCalledTimes(0);

  sub.unsubscribe();
  await delay(0);

  expect(lsCleanup).toHaveBeenCalledTimes(1);
});

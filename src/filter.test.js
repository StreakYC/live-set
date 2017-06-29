/* @flow */

import filter from './filter';
import LiveSet from '.';
import delay from 'pdelay';

test('works', async () => {
  let lsStep;
  const lsCleanup = jest.fn();
  const ls = new LiveSet({
    read: () => new Set([{x:1}, {x:2}]),
    listen(setValues, controller) {
      setValues(this.read());
      const originalValues = Array.from(ls.values());
      controller.add({x:3});
      lsStep = () => {
        controller.remove(originalValues[0]);
        controller.remove(originalValues[1]);
        controller.add({x:4});
      };
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

  if (!lsStep) throw new Error('listen callback was not called');
  lsStep();
  await delay(0);

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

test('read behavior consistent while stream is active or inactive', async () => {
  const {liveSet, controller} = LiveSet.active(new Set([5,6]));
  const filteredLs = filter(liveSet, x => x%2 === 0);

  expect(Array.from(filteredLs.values())).toEqual([6]);
  controller.add(7);
  controller.add(8);
  expect(Array.from(filteredLs.values())).toEqual([6,8]);
  filteredLs.subscribe({});
  controller.add(9);
  controller.add(10);
  expect(Array.from(filteredLs.values())).toEqual([6,8,10]);
  await delay(0);
  expect(Array.from(filteredLs.values())).toEqual([6,8,10]);
});

test('filter by Boolean', () => {
  const ls: LiveSet<?number> = LiveSet.constant(new Set([5,null,7]));
  const filteredLs: LiveSet<number> = filter(ls, Boolean);
  expect(Array.from(filteredLs.values())).toEqual([5,7]);
});

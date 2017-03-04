/* @flow */

import merge from './merge';
import map from './map';
import LiveSet from '.';
import delay from 'pdelay';

test('works', async () => {
  const ls1Cleanup = jest.fn();
  const ls1 = new LiveSet({
    read: () => new Set([{x:'1'}, {x:'one'}]),
    listen(setValues, controller) {
      setValues(this.read());
      const originalValues = Array.from(ls1.values());
      controller.add({x:'uno'});
      setTimeout(() => {
        controller.remove(originalValues[0]);
        controller.add({x:'ten'});
      }, 30);
      return ls1Cleanup;
    }
  });

  const ls2Cleanup = jest.fn();
  const ls2 = new LiveSet({
    read: () => new Set([{x:'2'}, {x:'two'}]),
    listen(setValues, controller) {
      setValues(this.read());
      const originalValues = Array.from(ls2.values());
      controller.add({x:'dos'});
      setTimeout(() => {
        controller.remove(originalValues[0]);
        controller.add({x:'twenty'});
      }, 90);
      return ls2Cleanup;
    }
  });

  const ls = merge([ls1, ls2]);

  expect(Array.from(ls.values())).toEqual([{x:'1'}, {x:'one'}, {x:'2'}, {x:'two'}]);

  const next = jest.fn(), error = jest.fn(), complete = jest.fn();
  const sub = ls.subscribe({next, error, complete});

  await delay(60);

  expect(Array.from(ls.values())).toEqual([{x:'one'}, {x:'uno'}, {x:'2'}, {x:'two'}, {x:'dos'}, {x:'ten'}]);

  await delay(60);

  expect(Array.from(ls.values())).toEqual([{x:'one'}, {x:'uno'}, {x:'two'}, {x:'dos'}, {x:'ten'}, {x:'twenty'}]);

  expect(next.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(error).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(0);
  expect(ls1Cleanup).toHaveBeenCalledTimes(0);
  expect(ls2Cleanup).toHaveBeenCalledTimes(0);

  sub.unsubscribe();
  await delay(0);

  expect(error).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(0);
  expect(ls1Cleanup).toHaveBeenCalledTimes(1);
  expect(ls2Cleanup).toHaveBeenCalledTimes(1);
});

test('read behavior consistent while stream is active or inactive', async () => {
  const {liveSet, controller} = LiveSet.active(new Set([1,2]));
  const {liveSet: liveSet2} = LiveSet.active(new Set([5,6]));
  const mergedLs = merge([liveSet, liveSet2]);

  expect(Array.from(mergedLs.values())).toEqual([1,2,5,6]);
  controller.add(3);
  expect(Array.from(mergedLs.values())).toEqual([1,2,3,5,6]);
  mergedLs.subscribe({});
  controller.add(4);
  expect(Array.from(mergedLs.values())).toEqual([1,2,3,5,6,4]);
  await delay(0);
  expect(Array.from(mergedLs.values())).toEqual([1,2,3,5,6,4]);
});

test('pullChanges on diamond merge does not multiply pull to root', async () => {
  const rootUnsubscribe = jest.fn();
  const rootPullChanges = jest.fn();
  let controller;
  const root = map(new LiveSet({
    read() {
      throw new Error();
    },
    listen(setValues, _controller) {
      setValues(new Set([1,2,3]));
      controller = _controller;
      return {
        unsubscribe: rootUnsubscribe,
        getChangePullers: () => [rootPullChanges]
      };
    }
  }), x => x);

  const transformed = new Array(5)
    .fill(0)
    .map((value, i) => i*100)
    .map(offset => map(root, x => x+offset));

  const merged = merge(transformed);

  const next = jest.fn();
  const sub = merged.subscribe(next);
  if (!controller) throw new Error();

  controller.add(4);

  expect(rootUnsubscribe).toHaveBeenCalledTimes(0);
  expect(rootPullChanges).toHaveBeenCalledTimes(0);
  expect(next.mock.calls).toEqual([]);

  sub.pullChanges();

  expect(rootUnsubscribe).toHaveBeenCalledTimes(0);
  expect(rootPullChanges).toHaveBeenCalledTimes(1);
  expect(next.mock.calls).toEqual([
    [[
      {type: 'add', value: 4},
      {type: 'add', value: 104},
      {type: 'add', value: 204},
      {type: 'add', value: 304},
      {type: 'add', value: 404},
    ]],
  ]);
});

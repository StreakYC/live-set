/* @flow */

import merge from './merge';
import LiveSet from '.';
import delay from 'pdelay';

test('works', async () => {
  let ls1Step, ls2Step;

  const ls1Cleanup = jest.fn();
  const ls1 = new LiveSet({
    read: () => new Set([{ x: '1' }, { x: 'one' }]),
    listen(setValues, controller) {
      setValues(this.read());
      const originalValues = Array.from(ls1.values());
      controller.add({ x: 'uno' });
      ls1Step = () => {
        controller.remove(originalValues[0]);
        controller.add({ x: 'ten' });
      };
      return ls1Cleanup;
    }
  });

  const ls2Cleanup = jest.fn();
  const ls2 = new LiveSet({
    read: () => new Set([{ x: '2' }, { x: 'two' }]),
    listen(setValues, controller) {
      setValues(this.read());
      const originalValues = Array.from(ls2.values());
      controller.add({ x: 'dos' });
      ls2Step = () => {
        controller.remove(originalValues[0]);
        controller.add({ x: 'twenty' });
      };
      return ls2Cleanup;
    }
  });

  const ls = merge([ls1, ls2]);

  expect(Array.from(ls.values())).toEqual([
    { x: '1' },
    { x: 'one' },
    { x: '2' },
    { x: 'two' }
  ]);

  const next = jest.fn(),
    error = jest.fn(),
    complete = jest.fn();
  const sub = ls.subscribe({ next, error, complete });
  expect(Array.from(ls.values())).toEqual([
    { x: '1' },
    { x: 'one' },
    { x: 'uno' },
    { x: '2' },
    { x: 'two' },
    { x: 'dos' }
  ]);
  expect(next.mock.calls).toEqual([]);

  if (!ls1Step || !ls2Step) throw new Error('Should not happen');

  ls1Step();
  await delay(0);

  expect(Array.from(ls.values())).toEqual([
    { x: 'one' },
    { x: 'uno' },
    { x: '2' },
    { x: 'two' },
    { x: 'dos' },
    { x: 'ten' }
  ]);
  expect(next.mock.calls).toEqual([
    [
      [
        { type: 'remove', value: { x: '1' } },
        { type: 'add', value: { x: 'ten' } }
      ]
    ]
  ]);

  ls2Step();
  await delay(0);

  expect(Array.from(ls.values())).toEqual([
    { x: 'one' },
    { x: 'uno' },
    { x: 'two' },
    { x: 'dos' },
    { x: 'ten' },
    { x: 'twenty' }
  ]);

  expect(next.mock.calls).toEqual([
    [
      [
        { type: 'remove', value: { x: '1' } },
        { type: 'add', value: { x: 'ten' } }
      ]
    ],
    [
      [
        { type: 'remove', value: { x: '2' } },
        { type: 'add', value: { x: 'twenty' } }
      ]
    ]
  ]);
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
  const { liveSet, controller } = LiveSet.active(new Set([1, 2]));
  const { liveSet: liveSet2 } = LiveSet.active(new Set([5, 6]));
  const mergedLs = merge([liveSet, liveSet2]);

  expect(Array.from(mergedLs.values())).toEqual([1, 2, 5, 6]);
  controller.add(3);
  expect(Array.from(mergedLs.values())).toEqual([1, 2, 3, 5, 6]);
  mergedLs.subscribe({});
  controller.add(4);
  expect(Array.from(mergedLs.values())).toEqual([1, 2, 3, 5, 6, 4]);
  await delay(0);
  expect(Array.from(mergedLs.values())).toEqual([1, 2, 3, 5, 6, 4]);
});

/* @flow */

import transduce from './transduce';

import t from 'transducers.js';
import LiveSet from '.';
import delay from 'pdelay';

test('read', () => {
  const ls = new LiveSet({
    read: () => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    listen() {
      throw new Error('should not be called in this test');
    }
  });

  const tls = transduce(
    ls,
    t.compose(
      t.filter(x => x % 2 === 0),
      t.map(x => x * 10),
      t.take(3)
    )
  );

  expect(Array.from(tls.values())).toEqual([20, 40, 60]);
});

test('end before changes', async () => {
  const ls = new LiveSet({
    read: () => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    listen(setValues, controller) {
      setValues(this.read());
      setTimeout(() => {
        controller.add(11);
      }, 0);
    }
  });

  const tls = transduce(
    ls,
    t.compose(
      t.filter(x => x % 2 === 0),
      t.map(x => x * 10),
      t.take(3)
    )
  );

  tls.subscribe({
    next() {
      throw new Error('should not receive changes');
    },
    error(e) {
      throw e;
    },
    complete() {
      throw new Error('should not complete');
    }
  });
  expect(Array.from(tls.values())).toEqual([20, 40, 60]);

  await delay(50);
});

test('listen', async () => {
  let lsStep1, lsStep2;
  const lsCleanup = jest.fn();
  const ls = new LiveSet({
    read: () => new Set([{ x: 1 }, { x: 2 }]),
    listen(setValues, controller) {
      setValues(this.read());
      const originalValues = Array.from(ls.values());

      controller.add({ x: 3 });
      const four = { x: 4 };
      controller.add(four);
      lsStep1 = () => {
        controller.remove(originalValues[0]);
        controller.remove(originalValues[1]);
        controller.add({ x: 5 });
        controller.add({ x: 6 });
        controller.add({ x: 7 });
        controller.add({ x: 8 });
        controller.add({ x: 9 });
        controller.add({ x: 10 });
      };
      lsStep2 = () => {
        controller.add({ x: 11 });
        controller.add({ x: 12 });
        controller.remove(four);
        controller.end();
      };
      return lsCleanup;
    }
  });

  const tls = transduce(
    ls,
    t.compose(
      t.filter(x => x.x % 2 === 0),
      t.map(x => ({ x: x.x * 10 })),
      t.take(3)
    )
  );

  expect(Array.from(tls.values())).toEqual([{ x: 20 }]);

  const complete = jest.fn();
  const sub = tls.subscribe({ complete });

  if (!lsStep1 || !lsStep2) throw new Error('listen callback was not called');

  expect(lsCleanup).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(0);
  expect(sub.closed).toBe(false);
  expect(tls.isEnded()).toBe(false);

  lsStep1();
  await delay(0);

  expect(Array.from(tls.values())).toEqual([{ x: 40 }, { x: 60 }]);
  expect(lsCleanup).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(0);
  expect(sub.closed).toBe(false);
  expect(tls.isEnded()).toBe(false);

  lsStep2();
  await delay(0);

  expect(Array.from(tls.values())).toEqual([{ x: 60 }]);
  expect(lsCleanup).toHaveBeenCalledTimes(1);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(sub.closed).toBe(true);
  expect(tls.isEnded()).toBe(true);
});

test('read behavior consistent while stream is active or inactive', async () => {
  const { liveSet, controller } = LiveSet.active(new Set([5, 6]));
  const mappedLs = transduce(liveSet, t.map(x => x * 10));

  expect(Array.from(mappedLs.values())).toEqual([50, 60]);
  controller.add(7);
  expect(Array.from(mappedLs.values())).toEqual([50, 60, 70]);
  mappedLs.subscribe({});
  controller.add(8);
  expect(Array.from(mappedLs.values())).toEqual([50, 60, 70, 80]);
  await delay(0);
  expect(Array.from(mappedLs.values())).toEqual([50, 60, 70, 80]);
});

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

  const tls = transduce(ls, t.compose(
    t.filter(x => x%2 === 0),
    t.map(x => x*10),
    t.take(3)
  ));

  expect(Array.from(tls.values())).toEqual([20, 40, 60]);
});

test('listen', async () => {
  const lsCleanup = jest.fn();
  const ls = new LiveSet({
    read: () => new Set([{x:1}, {x:2}]),
    listen(controller) {
      const originalValues = Array.from(ls.values());

      controller.add({x:3});
      const four = {x:4};
      controller.add(four);
      setTimeout(() => {
        controller.remove(originalValues[0]);
        controller.remove(originalValues[1]);
        controller.add({x:5});
        controller.add({x:6});
        controller.add({x:7});
        controller.add({x:8});
        controller.add({x:9});
        controller.add({x:10});
        setTimeout(() => {
          controller.add({x:11});
          controller.add({x:12});
          controller.remove(four);
          controller.end();
        }, 60);
      }, 30);
      return lsCleanup;
    }
  });

  const tls = transduce(ls, t.compose(
    t.filter(x => x.x%2 === 0),
    t.map(x => ({x: x.x*10})),
    t.take(3)
  ));

  expect(Array.from(tls.values())).toEqual([{x:20}]);

  const complete = jest.fn();
  const sub = tls.subscribe({complete});

  expect(lsCleanup).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(0);
  expect(sub.closed).toBe(false);
  expect(tls.isEnded()).toBe(false);

  await delay(60);

  expect(Array.from(tls.values())).toEqual([{x:20}, {x:40}, {x:60}]);
  expect(lsCleanup).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(0);
  expect(sub.closed).toBe(false);
  expect(tls.isEnded()).toBe(false);

  await delay(60);

  expect(Array.from(tls.values())).toEqual([{x:20}, {x:60}]);
  expect(lsCleanup).toHaveBeenCalledTimes(1);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(sub.closed).toBe(true);
  expect(tls.isEnded()).toBe(true);
});

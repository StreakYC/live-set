/* @flow */

import flatMap from './flatMap';
import LiveSet from '.';
import delay from 'pdelay';

test('works', async () => {
  const controllers = [];

  const lsCleanup = jest.fn();
  const ls = new LiveSet({
    read: () => new Set([1,2]),
    listen(setValues, controller) {
      setValues(this.read());
      controllers.push(controller);

      controller.remove(1);
      controller.add(3);
      const t = setTimeout(() => {
        controller.remove(2);
        controller.add(4);
      }, 60);
      return () => {
        clearTimeout(t);
        lsCleanup();
      };
    }
  });

  const ls2Cleanup = jest.fn();
  const ls2 = flatMap(ls, value =>
    new LiveSet({
      read: () => new Set([value*10]),
      listen(setValues, controller) {
        setValues(this.read());
        controllers.push(controller);

        const t = setTimeout(() => {
          controller.add(value*100);
          controller.add(value*1000);
          controller.remove(value*10);
        }, 90);
        return () => {
          clearTimeout(t);
          ls2Cleanup();
        };
      }
    })
  );

  expect(Array.from(ls2.values())).toEqual([10, 20]);

  const next = jest.fn(), error = jest.fn(), complete = jest.fn();
  ls2.subscribe({next, error, complete});

  expect(Array.from(ls2.values())).toEqual([20, 30]);
  expect(next).toHaveBeenCalledTimes(0);
  expect(error).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(0);

  await delay(60);

  expect(next).toHaveBeenCalledTimes(1);
  expect(error).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(0);
  expect(Array.from(ls2.values())).toEqual([30, 40]);

  expect(lsCleanup).toHaveBeenCalledTimes(0);
  expect(ls2Cleanup).toHaveBeenCalledTimes(1);

  await delay(120);

  expect(next.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(error).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(0);
  expect(Array.from(ls2.values())).toEqual([300, 3000, 400, 4000]);

  expect(lsCleanup).toHaveBeenCalledTimes(0);
  expect(ls2Cleanup).toHaveBeenCalledTimes(1);

  controllers.slice(0, -1).forEach(controller => {
    if (!controller.closed) {
      controller.end();
    }
  });
  await delay(0);

  expect(lsCleanup).toHaveBeenCalledTimes(1);
  expect(ls2Cleanup).toHaveBeenCalledTimes(2);
  expect(complete).toHaveBeenCalledTimes(0);

  controllers.slice(-1).forEach(controller => {
    controller.end();
  });
  await delay(0);

  expect(lsCleanup).toHaveBeenCalledTimes(1);
  expect(ls2Cleanup).toHaveBeenCalledTimes(3);
  expect(complete).toHaveBeenCalledTimes(1);
});

test('handles removal of initial values', async () => {
  const {liveSet, controller} = LiveSet.active(new Set([5,6]));

  const fls = flatMap(liveSet, x => new LiveSet({
    read: () => new Set([{x}]),
    listen(setValues) {
      setValues(this.read());
    }
  }));

  const next = jest.fn();
  fls.subscribe(next);

  expect(Array.from(fls.values())).toEqual([{x: 5}, {x: 6}]);
  controller.remove(5);
  await delay(0);
  expect(Array.from(fls.values())).toEqual([{x: 6}]);
});

test('read behavior consistent while stream is active or inactive', async () => {
  const {liveSet, controller} = LiveSet.active(new Set([5,6]));

  let subControllers = [];
  const fmLs = flatMap(liveSet, x => new LiveSet({
    read: () => new Set([x*10]),
    listen(setValues, controller) {
      setValues(this.read());
      subControllers.push(controller);
      return () => {
        subControllers = subControllers.filter(c => c !== controller);
      };
    }
  }));

  expect(Array.from(fmLs.values())).toEqual([50,60]);
  controller.add(7);
  expect(Array.from(fmLs.values())).toEqual([50,60,70]);
  fmLs.subscribe({});
  controller.add(8);
  expect(Array.from(fmLs.values())).toEqual([50,60,70,80]);
  await delay(0);
  expect(Array.from(fmLs.values())).toEqual([50,60,70,80]);

  subControllers[0].add(101);
  expect(Array.from(fmLs.values())).toEqual([50,60,70,80,101]);
  await delay(0);
  expect(Array.from(fmLs.values())).toEqual([50,60,70,80,101]);
});

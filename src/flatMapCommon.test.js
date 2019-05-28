/* @flow */

import flatMap from './flatMap';
import flatMapR from './flatMapR';

import LiveSet from '.';
import delay from 'pdelay';
import map from './map';

for (let flatMapX of [flatMap, flatMapR]) {
  // Poison these two names to make sure none of the tests call them.
  const flatMap = null; // eslint-disable-line no-unused-vars
  const flatMapR = null; // eslint-disable-line no-unused-vars

  describe(flatMapX.name, () => {
    test('works', async () => {
      const controllers = [];

      const lsCleanup = jest.fn();
      const ls = new LiveSet({
        read: () => new Set([1, 2]),
        listen(setValues, controller) {
          setValues(this.read());
          controllers.push(controller);

          controller.remove(1);
          controller.add(3);
          return lsCleanup;
        }
      });

      let ls2Callbacks = new Set();
      const ls2Cleanup = jest.fn();
      const ls2 = flatMapX(
        ls,
        value =>
          new LiveSet({
            read: () => new Set([value * 10]),
            listen(setValues, controller) {
              setValues(this.read());
              controllers.push(controller);

              const cb = () => {
                controller.add(value * 100);
                controller.add(value * 1000);
                controller.remove(value * 10);
              };
              ls2Callbacks.add(cb);
              return () => {
                ls2Callbacks.delete(cb);
                ls2Cleanup();
              };
            }
          })
      );

      expect(Array.from(ls2.values())).toEqual([10, 20]);

      const next = jest.fn(),
        error = jest.fn(),
        complete = jest.fn();
      ls2.subscribe({ next, error, complete });

      expect(Array.from(ls2.values())).toEqual([20, 30]);
      expect(next).toHaveBeenCalledTimes(0);
      expect(error).toHaveBeenCalledTimes(0);
      expect(complete).toHaveBeenCalledTimes(0);

      controllers[0].remove(2);
      controllers[0].add(4);
      await delay(0); // Let promises resolve

      expect(next.mock.calls).toEqual([
        [[{ type: 'remove', value: 20 }, { type: 'add', value: 40 }]]
      ]);
      expect(error).toHaveBeenCalledTimes(0);
      expect(complete).toHaveBeenCalledTimes(0);
      expect(Array.from(ls2.values())).toEqual([30, 40]);

      expect(lsCleanup).toHaveBeenCalledTimes(0);
      expect(ls2Cleanup).toHaveBeenCalledTimes(1);

      ls2Callbacks.forEach(fn => fn());
      await delay(0);

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
      const { liveSet, controller } = LiveSet.active(new Set([5, 6]));

      const fls = flatMapX(
        liveSet,
        x =>
          new LiveSet({
            read: () => new Set([{ x }]),
            listen(setValues) {
              setValues(this.read());
            }
          })
      );

      const next = jest.fn();
      fls.subscribe(next);

      expect(Array.from(fls.values())).toEqual([{ x: 5 }, { x: 6 }]);
      controller.remove(5);
      await delay(0);
      expect(Array.from(fls.values())).toEqual([{ x: 6 }]);
    });

    test('read behavior consistent while stream is active or inactive', async () => {
      const { liveSet, controller } = LiveSet.active(new Set([5, 6]));

      let subControllers = [];
      const fmLs = flatMapX(
        liveSet,
        x =>
          new LiveSet({
            read: () => new Set([x * 10]),
            listen(setValues, controller) {
              setValues(this.read());
              subControllers.push(controller);
              return () => {
                subControllers = subControllers.filter(c => c !== controller);
              };
            }
          })
      );

      expect(Array.from(fmLs.values())).toEqual([50, 60]);
      controller.add(7);
      expect(Array.from(fmLs.values())).toEqual([50, 60, 70]);
      fmLs.subscribe({});
      controller.add(8);
      expect(Array.from(fmLs.values())).toEqual([50, 60, 70, 80]);
      await delay(0);
      expect(Array.from(fmLs.values())).toEqual([50, 60, 70, 80]);

      subControllers[0].add(101);
      expect(Array.from(fmLs.values())).toEqual([50, 60, 70, 80, 101]);
      await delay(0);
      expect(Array.from(fmLs.values())).toEqual([50, 60, 70, 80, 101]);
    });

    test('handle constant', async () => {
      const { liveSet, controller } = LiveSet.active(new Set([5, 6]));
      const fmLs = flatMapX(liveSet, x =>
        LiveSet.constant(new Set([x, x * 10]))
      );
      expect(Array.from(fmLs.values())).toEqual([5, 50, 6, 60]);

      const next = jest.fn();
      fmLs.subscribe(next);
      expect(Array.from(fmLs.values())).toEqual([5, 50, 6, 60]);

      controller.add(7);
      await delay(0);
      expect(next.mock.calls).toEqual([
        [[{ type: 'add', value: 7 }, { type: 'add', value: 70 }]]
      ]);
      expect(Array.from(fmLs.values())).toEqual([5, 50, 6, 60, 7, 70]);

      controller.remove(5);
      await delay(0);
      expect(next.mock.calls).toEqual([
        [[{ type: 'add', value: 7 }, { type: 'add', value: 70 }]],
        [[{ type: 'remove', value: 5 }, { type: 'remove', value: 50 }]]
      ]);
      expect(Array.from(fmLs.values())).toEqual([6, 60, 7, 70]);
    });

    test('add in pullChanges is not double-counted in pool', async () => {
      const { liveSet: s1, controller: c1 } = LiveSet.active();
      const fm1 = flatMapX(s1, s => s);

      const fm1Next = jest.fn();
      const fm1Sub = fm1.subscribe(fm1Next);

      const foo = new LiveSet({
        read() {
          throw new Error();
        },
        listen(setValues, controller) {
          setValues(new Set([]));
          let hasPulled = false;
          return {
            unsubscribe() {},
            pullChanges() {
              if (!hasPulled) {
                hasPulled = true;
                controller.add({ original: 5 });
              }
            }
          };
        }
      });

      const fooMapper = jest.fn(x => ({ transformed: x }));
      c1.add(map(foo, fooMapper));

      expect(fooMapper.mock.calls).toEqual([]);
      expect(fm1Next.mock.calls).toEqual([]);

      await delay(0);

      expect(fooMapper.mock.calls).toEqual([]);
      expect(fm1Next.mock.calls).toEqual([]);

      fm1Sub.pullChanges();

      expect(fooMapper.mock.calls).toEqual([[{ original: 5 }]]);
      expect(fm1Next.mock.calls).toEqual([
        [[{ type: 'add', value: { transformed: { original: 5 } } }]]
      ]);
    });

    test('two dependent pools', () => {
      const { liveSet: s1, controller: c1 } = LiveSet.active();
      const { liveSet: s2, controller: c2 } = LiveSet.active();
      const fm1 = flatMapX(s1, s => s);
      const fm2 = flatMapX(s2, s => s);

      const output1Mapper = jest.fn(x => x);
      const output1 = map(fm1, output1Mapper);
      const sub1Next = jest.fn();
      const sub1 = output1.subscribe(sub1Next);
      const sub2Next = jest.fn();
      const sub2 = fm2.subscribe(sub2Next);

      const fm2Mapper = jest.fn(x => ({ transformed: x }));
      c1.add(map(fm2, fm2Mapper));
      c2.add(LiveSet.constant(new Set([{ original: 5 }])));

      expect(fm2Mapper.mock.calls).toEqual([]);
      expect(output1Mapper.mock.calls).toEqual([]);
      expect(sub1Next.mock.calls).toEqual([]);
      expect(sub2Next.mock.calls).toEqual([]);

      sub1.pullChanges();
      sub2.pullChanges();

      expect(fm2Mapper.mock.calls).toEqual([[{ original: 5 }]]);
      expect(output1Mapper.mock.calls).toEqual([
        [{ transformed: { original: 5 } }]
      ]);
      expect(sub1Next.mock.calls).toEqual([
        [[{ type: 'add', value: { transformed: { original: 5 } } }]]
      ]);
      expect(sub2Next.mock.calls).toEqual([
        [[{ type: 'add', value: { original: 5 } }]]
      ]);
    });

    test('ended input liveset', async () => {
      const input = LiveSet.constant(new Set([5]));
      let controller;
      const fmLs = flatMapX(
        input,
        x =>
          new LiveSet({
            read: () => new Set([x]),
            listen(setValues, _controller) {
              setValues(this.read());
              controller = _controller;
            }
          })
      );
      const next = jest.fn();
      expect(controller).toBe(undefined);
      const sub = fmLs.subscribe(next);
      expect(fmLs.isEnded()).toBe(false);
      if (!controller) throw new Error();
      controller.add(123);
      expect(next).toHaveBeenCalledTimes(0);
      sub.pullChanges();
      expect(next).toHaveBeenCalledTimes(1);
      expect(Array.from(fmLs.values())).toEqual([5, 123]);
    });

    test('input liveset ends after', async () => {
      const { liveSet: input, controller: inputController } = LiveSet.active(
        new Set([5])
      );
      let controller;
      const fmLs = flatMapX(
        input,
        x =>
          new LiveSet({
            read: () => new Set([x]),
            listen(setValues, _controller) {
              setValues(this.read());
              controller = _controller;
            }
          })
      );
      const next = jest.fn();
      expect(controller).toBe(undefined);
      const sub = fmLs.subscribe(next);
      inputController.end();
      expect(fmLs.isEnded()).toBe(false);
      if (!controller) throw new Error();
      controller.add(123);
      expect(next).toHaveBeenCalledTimes(0);
      sub.pullChanges();
      expect(next).toHaveBeenCalledTimes(1);
      expect(Array.from(fmLs.values())).toEqual([5, 123]);
    });
  });
}

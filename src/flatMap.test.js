/* @flow */

import flatMap from './flatMap';

import LiveSet from '.';
import delay from 'pdelay';
import transduce from './transduce';
import map from './map';
import t from 'transducers.js';

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
      return lsCleanup;
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

  controllers[0].remove(2);
  controllers[0].add(4);
  await delay(0); // Let promises resolve

  expect(next.mock.calls).toEqual([
    [[{type: 'remove', value: 20}, {type: 'add', value: 40}]]
  ]);
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

test('handle constant', async () => {
  const {liveSet, controller} = LiveSet.active(new Set([5,6]));
  const fmLs = flatMap(liveSet, x => LiveSet.constant(new Set([x, x*10])));
  expect(Array.from(fmLs.values())).toEqual([5,50,6,60]);

  const next = jest.fn();
  fmLs.subscribe(next);
  expect(Array.from(fmLs.values())).toEqual([5,50,6,60]);

  controller.add(7);
  await delay(0);
  expect(next.mock.calls).toEqual([
    [[{type: 'add', value: 7}, {type: 'add', value: 70}]]
  ]);
  expect(Array.from(fmLs.values())).toEqual([5,50,6,60,7,70]);

  controller.remove(5);
  await delay(0);
  expect(next.mock.calls).toEqual([
    [[{type: 'add', value: 7}, {type: 'add', value: 70}]],
    [[{type: 'remove', value: 5}, {type: 'remove', value: 50}]]
  ]);
  expect(Array.from(fmLs.values())).toEqual([6,60,7,70]);
});

test('recursive pool', async () => {
  const {liveSet: sources, controller: sourcesController} = LiveSet.active();
  const fmLs = flatMap(sources, s => s);
  const s1 = LiveSet.constant(new Set([1, 2, 3, 4]));
  sourcesController.add(s1);
  expect(Array.from(fmLs.values())).toEqual([1, 2, 3, 4]);
  const s2 = transduce(fmLs, t.compose(
    t.filter(x => x < 1000),
    t.filter(x => x%2 === 0),
    t.map(x => x*10+1)
  ));
  sourcesController.add(s2);
  const s3 = transduce(fmLs, t.compose(
    t.filter(x => x < 1000),
    t.filter(x => x%2 === 1),
    t.map(x => x*10)
  ));
  sourcesController.add(s3);

  expect(() => fmLs.values()).toThrowError(
    'reading inactive recursively-flatMapped stream is not supported'
  );

  const next = jest.fn();
  fmLs.subscribe({next});
  expect(Array.from(fmLs.values())).toEqual([1, 2, 3, 4, 21, 41, 10, 30, 210, 410, 101, 301, 2101, 4101, 1010, 3010]);
});

test('add in pullChanges is not double-counted in pool', async () => {
  const {liveSet: s1, controller: c1} = LiveSet.active();
  const fm1 = flatMap(s1, s => s);

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
            controller.add({original: 5});
          }
        }
      };
    }
  });

  const fooMapper = jest.fn(x => ({transformed: x}));
  c1.add(map(foo, fooMapper));

  expect(fooMapper.mock.calls).toEqual([]);
  expect(fm1Next.mock.calls).toEqual([]);

  await delay(0);

  expect(fooMapper.mock.calls).toEqual([]);
  expect(fm1Next.mock.calls).toEqual([]);

  fm1Sub.pullChanges();

  expect(fooMapper.mock.calls).toEqual([
    [{original: 5}]
  ]);
  expect(fm1Next.mock.calls).toEqual([
    [[{type: 'add', value: {transformed: {original: 5}}}]]
  ]);
});

test('two dependent recursive pools', () => {
  const {liveSet: s1, controller: c1} = LiveSet.active();
  const {liveSet: s2, controller: c2} = LiveSet.active();
  const fm1 = flatMap(s1, s => s);
  const fm2 = flatMap(s2, s => s);

  const output1Mapper = jest.fn(x => x);
  const output1 = map(fm1, output1Mapper);
  const sub1Next = jest.fn();
  const sub1 = output1.subscribe(sub1Next);
  const sub2Next = jest.fn();
  const sub2 = fm2.subscribe(sub2Next);

  const fm2Mapper = jest.fn(x => ({transformed: x}));
  c1.add(map(fm2, fm2Mapper));
  c2.add(LiveSet.constant(new Set([{original: 5}])));

  expect(fm2Mapper.mock.calls).toEqual([]);
  expect(output1Mapper.mock.calls).toEqual([]);
  expect(sub1Next.mock.calls).toEqual([]);
  expect(sub2Next.mock.calls).toEqual([]);

  sub1.pullChanges();
  sub2.pullChanges();

  expect(fm2Mapper.mock.calls).toEqual([
    [{original: 5}]
  ]);
  expect(output1Mapper.mock.calls).toEqual([
    [{transformed: {original: 5}}]
  ]);
  expect(sub1Next.mock.calls).toEqual([
    [[{type: 'add', value: {transformed: {original: 5}}}]]
  ]);
  expect(sub2Next.mock.calls).toEqual([
    [[{type: 'add', value: {original: 5}}]]
  ]);
});

test('ended input liveset', async () => {
  const input = LiveSet.constant(new Set([5]));
  let controller;
  const fmLs = flatMap(input, x => new LiveSet({
    read: () => new Set([x]),
    listen(setValues, _controller) {
      setValues(this.read());
      controller = _controller;
    }
  }));
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
  const {liveSet: input, controller: inputController} = LiveSet.active(new Set([5]));
  let controller;
  const fmLs = flatMap(input, x => new LiveSet({
    read: () => new Set([x]),
    listen(setValues, _controller) {
      setValues(this.read());
      controller = _controller;
    }
  }));
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

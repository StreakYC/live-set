/* @flow */

import LiveSet from '.';

import delay from 'pdelay';

test('read', () => {
  let currentValue = new Set([5,6,7]);
  const read = jest.fn(() => currentValue);
  const ls = new LiveSet({
    read,
    listen() {
      throw new Error('should not be called');
    }
  });

  expect(read).toHaveBeenCalledTimes(0);
  expect(Array.from(ls.values())).toEqual([5,6,7]);
  expect(read).toHaveBeenCalledTimes(1);

  currentValue = new Set([7,8,9]);
  expect(Array.from(ls.values())).toEqual([7,8,9]);
  expect(read).toHaveBeenCalledTimes(2);
});

test('listen, subscribe', async () => {
  const unsub = jest.fn();
  const ls = new LiveSet({
    read: () => new Set([4,5]),
    listen(setValues, c) {
      setValues(this.read());
      expect(c.closed).toBe(false);
      c.add(5);
      c.add(6);
      c.add(7);
      let t = setTimeout(() => {
        expect(c.closed).toBe(false);
        c.remove(5);
        c.add(8);
        t = setTimeout(() => {
          throw new Error('should not happen');
        }, 1);
      }, 1);
      return () => {
        expect(c.closed).toBe(true);
        clearTimeout(t);
        unsub();
      };
    }
  });

  expect(Array.from(ls.values())).toEqual([4,5]);

  let changeHandlerCallCount = 0;
  const sub = ls.subscribe(changes => {
    switch (changeHandlerCallCount++) {
    case 0:
      expect(changes).toEqual([{type: 'remove', value: 5}, {type: 'add', value: 8}]);
      expect(Array.from(ls.values())).toEqual([4,6,7,8]);
      expect(sub.closed).toBe(false);
      sub.unsubscribe();
      expect(sub.closed).toBe(true);
      break;
    default:
      throw new Error(`Should not happen. ${changeHandlerCallCount}`);
    }
  });
  expect(sub.closed).toBe(false);
  // The listen function should run immediately
  expect(Array.from(ls.values())).toEqual([4,5,6,7]);
  // The change handler should be called asynchronously
  expect(changeHandlerCallCount).toBe(0);
  expect(unsub).toHaveBeenCalledTimes(0);
  await delay(40);
  expect(changeHandlerCallCount).toBe(1);
  expect(unsub).toHaveBeenCalledTimes(1);
  expect(ls.isEnded()).toBe(false);
});

test('subscribe, end', async () => {
  const listenStart = jest.fn();
  const unsub = jest.fn();

  let controller;

  const ls = new LiveSet({
    read: () => new Set([1]),
    listen(setValues, c) {
      setValues(this.read());
      controller = c;
      expect(c.closed).toBe(false);
      listenStart();
      c.add(2);
      return () => {
        expect(c.closed).toBe(true);
        unsub();
      };
    }
  });

  expect(Array.from(ls.values())).toEqual([1]);

  const next = jest.fn();
  const complete = jest.fn();
  const sub = ls.subscribe(next, null, complete);
  if (!controller) throw new Error();
  expect(next.mock.calls).toEqual([]);
  expect(Array.from(ls.values())).toEqual([1,2]);
  await delay(0);

  expect(next.mock.calls).toEqual([]);
  expect(complete).toHaveBeenCalledTimes(0);
  expect(sub.closed).toBe(false);
  expect(unsub).toHaveBeenCalledTimes(0);
  expect(Array.from(ls.values())).toEqual([1,2]);
  expect(ls.isEnded()).toBe(false);

  expect(controller.closed).toBe(false);
  controller.add(3);
  controller.end();
  expect(controller.closed).toBe(true);
  await delay(0); // Let async callbacks fire

  expect(next.mock.calls).toEqual([
    [[{type: 'add', value: 3}]],
  ]);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(sub.closed).toBe(true);
  expect(unsub).toHaveBeenCalledTimes(1);
  expect(ls.isEnded()).toBe(true);

  // Values should be frozen at end time.
  expect(Array.from(ls.values())).toEqual([1,2,3]);

  {
    const start = jest.fn();
    const next = jest.fn();
    const error = jest.fn();
    const complete = jest.fn();
    const sub = ls.subscribe({start, next, error, complete});
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][0]).toBe(sub);
    expect(next).toHaveBeenCalledTimes(0);
    expect(error).toHaveBeenCalledTimes(0);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(sub.closed).toBe(true);
  }

  {
    const start = jest.fn(sub => {
      sub.unsubscribe();
    });
    const next = jest.fn();
    const error = jest.fn();
    const complete = jest.fn();
    const sub = ls.subscribe({start, next, error, complete});
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][0]).toEqual(sub);
    expect(next).toHaveBeenCalledTimes(0);
    expect(error).toHaveBeenCalledTimes(0);
    expect(complete).toHaveBeenCalledTimes(0);
    expect(sub.closed).toBe(true);
  }
});

test('error', async () => {
  const {liveSet, controller} = LiveSet.active(new Set([1]));

  const start = jest.fn(), next = jest.fn(), error = jest.fn(), complete = jest.fn();
  const sub = liveSet.subscribe({start, next, error, complete});

  controller.add(2);
  controller.error(new Error('foo'));

  expect(start).toHaveBeenCalledTimes(1);
  expect(start.mock.calls[0][0]).toEqual(sub);
  expect(next).toHaveBeenCalledTimes(0);
  expect(error).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(0);
  expect(sub.closed).toBe(false);
  await delay(0);
  expect(next.mock.calls).toEqual([
    [[{type: 'add', value: 2}]]
  ]);
  expect(error).toHaveBeenCalledTimes(1);
  expect(error.mock.calls[0][0].message).toBe('foo');
  expect(complete).toHaveBeenCalledTimes(0);
  expect(sub.closed).toBe(true);
});

test("don't receive changes that already happened when subscribing", async () => {
  const {liveSet, controller} = LiveSet.active(new Set([5]));
  controller.remove(5);
  controller.add(6);

  expect(Array.from(liveSet.values())).toEqual([6]);

  const next = jest.fn();
  liveSet.subscribe(next);

  await delay(0);

  expect(next.mock.calls).toEqual([
  ]);
});

test('subscribe, unsubscribe, subscribe', async () => {
  const listenStart = jest.fn();
  const unsub = jest.fn();
  const ls = new LiveSet({
    read: () => new Set([1]),
    listen(setValues, c) {
      setValues(this.read());
      listenStart();
      c.add(2);
      let t = setTimeout(() => {
        c.add(3);
      }, 40);
      return () => {
        clearTimeout(t);
        unsub();
      };
    }
  });

  for (let i=0; i<3; i++) {
    expect(Array.from(ls.values())).toEqual([1]);
    const changeHandler = jest.fn();
    const sub = ls.subscribe(changeHandler);
    expect(changeHandler.mock.calls).toEqual([]);
    expect(Array.from(ls.values())).toEqual([1,2]);
    await delay(1);
    expect(changeHandler.mock.calls).toEqual([]);
    expect(Array.from(ls.values())).toEqual([1,2]);
    await delay(100);
    expect(changeHandler.mock.calls).toEqual([
      [[{type: 'add', value: 3}]]
    ]);
    expect(Array.from(ls.values())).toEqual([1,2,3]);
    sub.unsubscribe();
    await delay(0);
  }
});

test('multiple subscribers, one immediate unsubscription', async () => {
  const listenStart = jest.fn();
  const unsub = jest.fn();
  const ls = new LiveSet({
    read: () => new Set([1]),
    listen(setValues, c) {
      setValues(this.read());
      listenStart();
      c.add(2);
      let t = setTimeout(() => {
        c.add(3);
        t = setTimeout(() => {
          throw new Error('should not happen');
        }, 1);
      }, 1);
      return () => {
        clearTimeout(t);
        unsub();
      };
    }
  });

  expect(Array.from(ls.values())).toEqual([1]);
  expect(listenStart).toHaveBeenCalledTimes(0);
  const sub1 = ls.subscribe({});
  // The listen function should run immediately
  expect(Array.from(ls.values())).toEqual([1,2]);
  expect(listenStart).toHaveBeenCalledTimes(1);

  let changeHandlerCallCount = 0;
  const sub2 = ls.subscribe(changes => {
    switch (changeHandlerCallCount++) {
    case 0:
      expect(changes).toEqual([{type: 'add', value: 3}]);
      expect(Array.from(ls.values())).toEqual([1,2,3]);
      sub2.unsubscribe();
      break;
    default:
      throw new Error(`Should not happen. ${changeHandlerCallCount}`);
    }
  });

  sub1.unsubscribe();

  expect(listenStart).toHaveBeenCalledTimes(1);
  expect(unsub).toHaveBeenCalledTimes(0);

  // The change handler should be called asynchronously
  expect(changeHandlerCallCount).toBe(0);
  await delay(40);
  expect(changeHandlerCallCount).toBe(1);
  expect(unsub).toHaveBeenCalledTimes(1);
});

test('multiple subscribers', async () => {
  const listenStart = jest.fn();
  const unsub = jest.fn();
  const ls = new LiveSet({
    read: () => new Set([1]),
    listen(setValues, c) {
      setValues(this.read());
      listenStart();
      c.add(2);
      let t = setTimeout(() => {
        c.add(3);
      }, 1);
      return () => {
        clearTimeout(t);
        unsub();
      };
    }
  });

  expect(Array.from(ls.values())).toEqual([1]);
  expect(listenStart).toHaveBeenCalledTimes(0);

  let changeHandler1CallCount = 0;
  const sub1 = ls.subscribe(changes => {
    switch (changeHandler1CallCount++) {
    case 0:
      expect(changes).toEqual([{type: 'add', value: 3}]);
      expect(Array.from(ls.values())).toEqual([1,2,3]);
      expect(sub1.closed).toBe(false);
      sub1.unsubscribe();
      expect(sub1.closed).toBe(true);
      break;
    default:
      throw new Error(`Should not happen. ${changeHandler1CallCount}`);
    }
  });

  // The listen function should run immediately
  expect(Array.from(ls.values())).toEqual([1,2]);
  expect(listenStart).toHaveBeenCalledTimes(1);

  let changeHandler2CallCount = 0;
  const sub2 = ls.subscribe(changes => {
    switch (changeHandler2CallCount++) {
    case 0:
      expect(changes).toEqual([{type: 'add', value: 3}]);
      expect(Array.from(ls.values())).toEqual([1,2,3]);
      expect(sub2.closed).toBe(false);
      sub2.unsubscribe();
      expect(sub2.closed).toBe(true);
      break;
    default:
      throw new Error(`Should not happen. ${changeHandler2CallCount}`);
    }
  });

  expect(listenStart).toHaveBeenCalledTimes(1);
  expect(unsub).toHaveBeenCalledTimes(0);

  // The change handlers should be called asynchronously
  expect(changeHandler1CallCount).toBe(0);
  expect(changeHandler2CallCount).toBe(0);
  await delay(40);
  expect(changeHandler1CallCount).toBe(1);
  expect(changeHandler2CallCount).toBe(1);
  expect(unsub).toHaveBeenCalledTimes(1);
});

test('immediate end', async () => {
  const liveSet = new LiveSet({
    read: () => new Set([5,6]),
    listen(setValues, controller) {
      setValues(this.read());
      controller.add(7);
      controller.end();
    }
  });
  const next = jest.fn(), complete = jest.fn();
  liveSet.subscribe({next, complete});
  expect(next.mock.calls).toEqual([]);
  expect(complete).toHaveBeenCalledTimes(0);
  await delay(0);
  expect(next.mock.calls).toEqual([]);
  expect(complete).toHaveBeenCalledTimes(1);
});

test('pullChanges', async () => {
  const {liveSet, controller} = LiveSet.active(new Set([5,6]));
  const next = jest.fn(), next2 = jest.fn();
  const sub = liveSet.subscribe(next);
  liveSet.subscribe(next2);
  controller.add(7);
  expect(next.mock.calls).toEqual([
  ]);
  expect(next2.mock.calls).toEqual([
  ]);
  sub.pullChanges();
  expect(next.mock.calls).toEqual([
    [[{type: 'add', value: 7}]]
  ]);
  expect(next2.mock.calls).toEqual([
  ]);
  await delay(0);
  expect(next.mock.calls).toEqual([
    [[{type: 'add', value: 7}]]
  ]);
  expect(next2.mock.calls).toEqual([
    [[{type: 'add', value: 7}]]
  ]);
  controller.add(8);
  expect(next.mock.calls).toEqual([
    [[{type: 'add', value: 7}]]
  ]);
  expect(next2.mock.calls).toEqual([
    [[{type: 'add', value: 7}]]
  ]);
  await delay(0);
  expect(next.mock.calls).toEqual([
    [[{type: 'add', value: 7}]],
    [[{type: 'add', value: 8}]]
  ]);
  expect(next2.mock.calls).toEqual([
    [[{type: 'add', value: 7}]],
    [[{type: 'add', value: 8}]]
  ]);
});

test('pullChanges and ignoring already-delivered values', async () => {
  const {liveSet, controller} = LiveSet.active(new Set([5]));
  const next = jest.fn();
  controller.add(6);
  const sub = liveSet.subscribe(next);
  controller.add(7);
  expect(next.mock.calls).toEqual([
  ]);
  sub.pullChanges();
  expect(next.mock.calls).toEqual([
    [[{type: 'add', value: 7}]]
  ]);
  await delay(0);
  expect(next.mock.calls).toEqual([
    [[{type: 'add', value: 7}]]
  ]);
  controller.add(8);
  controller.add(9);
  expect(next.mock.calls).toEqual([
    [[{type: 'add', value: 7}]]
  ]);
  await delay(0);
  expect(next.mock.calls).toEqual([
    [[{type: 'add', value: 7}]],
    [[{type: 'add', value: 8}, {type: 'add', value: 9}]],
  ]);
});

test('values() triggers pullChanges()', () => {
  const ls = new LiveSet({
    read: () => new Set([5,6]),
    listen(setValues, controller) {
      setValues(this.read());
      return {
        unsubscribe() {},
        pullChanges() {
          controller.add(7);
        }
      };
    }
  });

  expect(Array.from(ls.values())).toEqual([5,6]);
  ls.subscribe({});
  expect(Array.from(ls.values())).toEqual([5,6,7]);
});

test('constant', async () => {
  const ls = LiveSet.constant(new Set([5,6,7]));
  expect(ls.isEnded()).toBe(true);
  expect(Array.from(ls.values())).toEqual([5,6,7]);
  const start = jest.fn(), next = jest.fn(), error = jest.fn(), complete = jest.fn();
  const sub = ls.subscribe({start, next, error, complete});
  expect(sub.closed).toBe(true);
  expect(start).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledTimes(0);
  expect(error).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(1);
  await delay(0);
  expect(start).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledTimes(0);
  expect(error).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(1);
});

test('immediate unsubscribe from ended liveset', async () => {
  const ls = LiveSet.constant(new Set([5,6,7]));
  const next = jest.fn(), error = jest.fn(), complete = jest.fn();
  const sub = ls.subscribe({start: sub => sub.unsubscribe(), next, error, complete});
  expect(sub.closed).toBe(true);
  expect(next).toHaveBeenCalledTimes(0);
  expect(error).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(0);
  await delay(0);
  expect(next).toHaveBeenCalledTimes(0);
  expect(error).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(0);
});

/* @flow */

import toValueObservable from './toValueObservable';

import LiveSet from '.';
import delay from 'pdelay';

test('works', async () => {
  let controller;
  const cleanup = jest.fn();
  const liveSet = new LiveSet({
    read: () => new Set([5,6]),
    listen(setValues, _controller) {
      setValues(this.read());
      controller = _controller;
      return cleanup;
    }
  });

  const next = jest.fn();

  const sub = toValueObservable(liveSet).subscribe(next);

  if (!controller) throw new Error();
  controller.add(7);

  expect(next.mock.calls.map(x => x[0].value)).toEqual([5,6]);
  await delay(0);
  expect(next.mock.calls.map(x => x[0].value)).toEqual([5,6,7]);
  controller.add(8);
  expect(next.mock.calls.map(x => x[0].value)).toEqual([5,6,7]);
  await delay(0);
  expect(next.mock.calls.map(x => x[0].value)).toEqual([5,6,7,8]);

  const removal6 = jest.fn();
  next.mock.calls[1][0].removal.then(removal6);

  controller.remove(6);
  controller.remove(7);

  await delay(0);
  expect(removal6.mock.calls).toEqual([[undefined]]);

  const removal7 = jest.fn();
  next.mock.calls[2][0].removal.then(removal7);

  await delay(0);
  expect(removal7.mock.calls).toEqual([[undefined]]);

  expect(sub.closed).toBe(false);
  expect(cleanup).toHaveBeenCalledTimes(0);
  sub.unsubscribe();
  expect(sub.closed).toBe(true);
  expect(cleanup).toHaveBeenCalledTimes(1);

  expect(next.mock.calls.map(x => x[0].value)).toEqual([5,6,7,8]);

  const removal8 = jest.fn();
  next.mock.calls[3][0].removal.then(removal8);

  await delay(0);
  expect(removal8.mock.calls).toEqual([[undefined]]);
});

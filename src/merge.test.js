/* @flow */

import merge from './merge';
import LiveSet from '.';
import delay from 'pdelay';

test('works', async () => {
  const ls1Cleanup = jest.fn();
  const ls1 = new LiveSet({
    read: () => new Set(['1', 'one']),
    listen(controller) {
      controller.add('uno');
      setTimeout(() => {
        controller.remove('1');
        controller.add('ten');
      }, 30);
      return ls1Cleanup;
    }
  });

  const ls2Cleanup = jest.fn();
  const ls2 = new LiveSet({
    read: () => new Set(['2', 'two']),
    listen(controller) {
      controller.add('dos');
      setTimeout(() => {
        controller.remove('2');
        controller.add('twenty');
      }, 90);
      return ls2Cleanup;
    }
  });

  const ls = merge([ls1, ls2]);

  expect(Array.from(ls.values())).toEqual(['1', 'one', '2', 'two']);

  const next = jest.fn(), error = jest.fn(), complete = jest.fn();
  const sub = ls.subscribe({next, error, complete});

  await delay(60);

  expect(Array.from(ls.values())).toEqual(['one', '2', 'two', 'uno', 'dos', 'ten']);

  await delay(60);

  expect(Array.from(ls.values())).toEqual(['one', 'two', 'uno', 'dos', 'ten', 'twenty']);

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

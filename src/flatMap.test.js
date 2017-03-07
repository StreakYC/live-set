/* @flow */

import flatMap from './flatMap';

import LiveSet from '.';

test('pullChanges count', async () => {
  const pullChanges = jest.fn();
  let controller;
  let ls = new LiveSet({
    read() {
      throw new Error();
    },
    listen(setValues, _controller) {
      setValues(new Set());
      controller = _controller;
      return {
        unsubscribe() {},
        pullChanges
      };
    }
  });
  for (let i=0; i<10; i++) {
    ls = flatMap(ls, x => LiveSet.constant(new Set([x])));
  }
  const next = jest.fn();
  const sub = ls.subscribe(next);
  if (!controller) throw new Error();

  expect(pullChanges).toHaveBeenCalledTimes(0);
  expect(next.mock.calls).toEqual([]);

  sub.pullChanges();
  expect(pullChanges).toHaveBeenCalledTimes(1);
  expect(next.mock.calls).toEqual([]);

  controller.add(5);
  expect(pullChanges).toHaveBeenCalledTimes(1);
  expect(next.mock.calls).toEqual([]);

  sub.pullChanges();
  expect(pullChanges).toHaveBeenCalledTimes(2);
  expect(next.mock.calls).toEqual([
    [[{type: 'add', value: 5}]]
  ]);
});

/* @flow */

import map from './map';
import LiveSet from '.';
import delay from 'pdelay';

test('works', async () => {
  let lsStep;
  const lsCleanup = jest.fn();
  const ls = new LiveSet({
    read: () => new Set([{ x: '1' }, { x: 'one' }]),
    listen(setValues, controller) {
      setValues(this.read());
      const originalValues = Array.from(ls.values());
      controller.add({ x: 'uno' });
      lsStep = () => {
        controller.remove(originalValues[0]);
        controller.add({ x: 'ten' });
      };
      return lsCleanup;
    }
  });

  const mapper = jest.fn(x => ({ m: x.x }));
  const mappedLs = map(ls, mapper);

  expect(Array.from(mappedLs.values())).toEqual([{ m: '1' }, { m: 'one' }]);
  expect(mapper.mock.calls).toEqual([[{ x: '1' }], [{ x: 'one' }]]);

  const next = jest.fn();
  const sub = mappedLs.subscribe(next);

  if (!lsStep) throw new Error('listen callback was not called');
  lsStep();
  await delay(0);

  expect(Array.from(mappedLs.values())).toEqual([
    { m: 'one' },
    { m: 'uno' },
    { m: 'ten' }
  ]);
  expect(mapper.mock.calls).toEqual([
    [{ x: '1' }],
    [{ x: 'one' }],
    [{ x: '1' }],
    [{ x: 'one' }],
    [{ x: 'uno' }],
    [{ x: 'ten' }]
  ]);
  expect(lsCleanup).toHaveBeenCalledTimes(0);

  sub.unsubscribe();
  await delay(0);

  expect(lsCleanup).toHaveBeenCalledTimes(1);
});

test('read behavior consistent while stream is active or inactive', async () => {
  const { liveSet, controller } = LiveSet.active(new Set([5, 6]));
  const mappedLs = map(liveSet, x => x * 10);

  expect(Array.from(mappedLs.values())).toEqual([50, 60]);
  controller.add(7);
  expect(Array.from(mappedLs.values())).toEqual([50, 60, 70]);
  mappedLs.subscribe({});
  controller.add(8);
  expect(Array.from(mappedLs.values())).toEqual([50, 60, 70, 80]);
  await delay(0);
  expect(Array.from(mappedLs.values())).toEqual([50, 60, 70, 80]);
});

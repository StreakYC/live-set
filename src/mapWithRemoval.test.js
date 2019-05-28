/* @flow */

import mapWithRemoval from './mapWithRemoval';
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
  const mappedLs = mapWithRemoval(ls, mapper);
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
  expect(mapper.mock.calls.map(([value]) => value)).toEqual([
    { x: '1' },
    { x: 'one' },
    { x: 'uno' },
    { x: 'ten' }
  ]);
  expect(lsCleanup).toHaveBeenCalledTimes(0);

  const removal1 = jest.fn();
  const removalTen = jest.fn();
  mapper.mock.calls[0][1].then(removal1);
  mapper.mock.calls[3][1].then(removalTen);

  await delay(0);
  expect(removal1).toHaveBeenCalledTimes(1);
  expect(removalTen).toHaveBeenCalledTimes(0);

  sub.unsubscribe();
  await delay(0);

  expect(removalTen).toHaveBeenCalledTimes(1);

  expect(lsCleanup).toHaveBeenCalledTimes(1);

  expect(() => mappedLs.values()).toThrowError();
});

test('read behavior consistent while stream is active or inactive', async () => {
  const { liveSet, controller } = LiveSet.active(new Set([5, 6]));
  const mappedLs = mapWithRemoval(liveSet, x => x * 10);
  mappedLs.subscribe({});

  expect(Array.from(mappedLs.values())).toEqual([50, 60]);
  controller.add(7);
  expect(Array.from(mappedLs.values())).toEqual([50, 60, 70]);
  mappedLs.subscribe({});
  controller.add(8);
  expect(Array.from(mappedLs.values())).toEqual([50, 60, 70, 80]);
  await delay(0);
  expect(Array.from(mappedLs.values())).toEqual([50, 60, 70, 80]);
});

/* @flow */

import Scheduler from './Scheduler';

import delay from 'pdelay';

test('schedule', async () => {
  let c = 0;
  const s = new Scheduler();
  s.schedule(() => {
    expect(c++).toBe(0);
  });
  s.schedule(() => {
    expect(c++).toBe(1);
  });
  expect(c).toBe(0);
  await delay(0);
  expect(c).toBe(2);
});

test('flush', () => {
  let c = 0;
  const s = new Scheduler();
  s.schedule(() => {
    expect(c++).toBe(0);
  });
  s.schedule(() => {
    expect(c++).toBe(1);
  });
  expect(c).toBe(0);
  s.flush();
  expect(c).toBe(2);
});

test('big queue', () => {
  let c = 0;
  const s = new Scheduler();
  for (let i=0; i<3000; i++) {
    s.schedule(() => {
      expect(c++).toBe(i);
    });
  }
  expect(c).toBe(0);
  s.flush();
  expect(c).toBe(3000);
});

test('recursive flush in big queue', () => {
  let c = 0;
  const s = new Scheduler();
  for (let i=0; i<5000; i++) {
    s.schedule(() => {
      expect(c++).toBe(i);
      s.flush();
    });
  }
  expect(c).toBe(0);
  s.flush();
  expect(c).toBe(5000);
});

#!/usr/bin/env babel-node
/* @flow */
/* eslint-disable no-console */

import LiveSet from '../src';
import flatMap from '../src/flatMap';
import benchmarkLiveSet from './lib/benchmarkLiveSet';

process.env.NODE_ENV = 'production';

let { liveSet, controller } = LiveSet.active(new Set([1, 2, 3, 4, 5]));

const flatMapFn = x => {
  const s = new Set([x + 1]);
  return LiveSet.constant(s);
};

console.time('setup');
for (let i = 0; i < 100; i++) {
  liveSet = flatMap(liveSet, flatMapFn);
}
console.timeEnd('setup');

benchmarkLiveSet(liveSet, controller, 5000);

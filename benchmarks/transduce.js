#!/usr/bin/env babel-node
/* @flow */
/* eslint-disable no-console */

import LiveSet from '../src';
import transduce from '../src/transduce';
import t from 'transducers.js';
import benchmarkLiveSet from './lib/benchmarkLiveSet';

process.env.NODE_ENV = 'production';

let { liveSet, controller } = LiveSet.active(new Set([1, 2, 3, 4, 5]));

const transducer = t.compose(
  t.filter(x => x % 2 === 0),
  t.map(x => x + 2)
);

console.time('setup');
for (let i = 0; i < 200; i++) {
  liveSet = transduce(liveSet, transducer);
}
console.timeEnd('setup');

benchmarkLiveSet(liveSet, controller);

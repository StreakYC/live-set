#!/usr/bin/env babel-node
/* @flow */
/* eslint-disable no-console */

import LiveSet from '../src';
import filter from '../src/filter';
import benchmarkLiveSet from './lib/benchmarkLiveSet';

process.env.NODE_ENV = 'production';

let {liveSet, controller} = LiveSet.active(new Set([1,2,3,4,5]));

console.time('filter setup');
for (let i=0; i<200; i++) {
  liveSet = filter(liveSet, x => x%2 === 0);
}
console.timeEnd('filter setup');

benchmarkLiveSet(liveSet, controller);

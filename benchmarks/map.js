#!/usr/bin/env babel-node
/* @flow */
/* eslint-disable no-console */

import LiveSet from '../src';
import map from '../src/map';
import benchmarkLiveSet from './lib/benchmarkLiveSet';

let {liveSet, controller} = LiveSet.active(new Set([1,2,3,4,5]));

console.time('map setup');
for (let i=0; i<200; i++) {
  liveSet = map(liveSet, x => x+1);
}
console.timeEnd('map setup');

benchmarkLiveSet(liveSet, controller);

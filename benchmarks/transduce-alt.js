#!/usr/bin/env babel-node
/* @flow */
/* eslint-disable no-console */

import LiveSet from '../src';
import filter from '../src/filter';
import map from '../src/map';
import benchmarkLiveSet from './lib/benchmarkLiveSet';

let {liveSet, controller} = LiveSet.active(new Set([1,2,3,4,5]));

const evens = x => x%2 === 0;
const mapper = x => x+2;

console.time('setup');
for (let i=0; i<200; i++) {
  liveSet = map(filter(liveSet, evens), mapper);
}
console.timeEnd('setup');

benchmarkLiveSet(liveSet, controller);

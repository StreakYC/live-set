#!/usr/bin/env babel-node
/* @flow */
/* eslint-disable no-console */

import LiveSet from '../src';
import mapWithRemoval from '../src/mapWithRemoval';
import benchmarkLiveSet from './lib/benchmarkLiveSet';

let {liveSet, controller} = LiveSet.active(new Set([1,2,3,4,5]));

const mapFn = (x, removal) => {
  const o = {
    x,
    removed: false
  };
  removal.then(() => {
    o.removed = true;
  });
  return o;
};

console.time('setup');
for (let i=0; i<100; i++) {
  liveSet = mapWithRemoval(liveSet, mapFn);
}
console.timeEnd('setup');

benchmarkLiveSet(liveSet, controller, 5000, true);

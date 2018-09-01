#!/usr/bin/env babel-node
/* @flow */
/* eslint-disable no-console */

import LiveSet from '../src';
import flatMap from '../src/flatMap';
import benchmarkLiveSet from './lib/benchmarkLiveSet';

process.env.NODE_ENV = 'production';

let {liveSet, controller} = LiveSet.active(new Set([1,2,3,4,5]));

const flatMapFn = x => {
  const o: any = {
    x,
    removed: false
  };
  const s = new Set([o]);
  return new LiveSet({
    read: () => s,
    listen(setValues) {
      setValues(s);
      return () => {
        o.removed = true;
      };
    }
  });
};

console.time('setup');
for (let i=0; i<100; i++) {
  liveSet = flatMap(liveSet, flatMapFn);
}
console.timeEnd('setup');

benchmarkLiveSet(liveSet, controller, 5000, true);

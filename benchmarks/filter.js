#!/usr/bin/env babel-node
/* @flow */
/* eslint-disable no-console */

import LiveSet from '../src';
import filter from '../src/filter';

let {liveSet: ls, controller} = LiveSet.active(new Set([1,2,3,4,5]));

console.time('filter setup');
for (let i=0; i<200; i++) {
  ls = filter(ls, x => x%2 === 0);
}
console.timeEnd('filter setup');

function read() {
  return ls.values();
}

for (let i=0; i<2000; i++) {
  read();
}

console.time('read');
for (let i=0; i<200; i++) {
  read();
}
console.timeEnd('read');

(async function() {
  for (let i=6; i<200; i++) {
    await new Promise(resolve => {
      ls.subscribe(() => {
        resolve();
      });
      controller.add(i*2);
      controller.add(i*2+1);
    });
  }

  console.time('changes');
  ls.subscribe(changes => {
    console.timeEnd('changes');
    console.log('change count', changes.length);
  });
  for (let i=1000; i<2000; i++) {
    controller.add(i);
  }
})();

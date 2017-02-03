#!/usr/bin/env babel-node
/* @flow */
/* eslint-disable no-console */

import LiveSet from '../src';
import map from '../src/map';

let {liveSet: ls, controller} = LiveSet.active(new Set([1,2,3,4,5]));

console.time('map setup');
for (let i=0; i<200; i++) {
  ls = map(ls, x => x+1);
}
console.timeEnd('map setup');

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
      controller.add(i);
    });
  }

  console.time('changes');
  ls.subscribe(changes => {
    console.timeEnd('changes');
    console.log('change count', changes.length);
  });
  for (let i=200; i<700; i++) {
    controller.add(i);
  }
})();

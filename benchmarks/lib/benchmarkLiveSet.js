/* @flow */
/* eslint-disable no-console */

import type LiveSet, {LiveSetController} from '../../src';

export default async function benchmarkLiveSet(liveSet: LiveSet<number>, controller: LiveSetController<number>, itemsToInsert: number=20000) {
  function read() {
    return liveSet.values();
  }

  // warm up
  for (let i=0; i<2000; i++) {
    read();
  }

  console.time('read');
  for (let i=0; i<1000; i++) {
    read();
  }
  console.timeEnd('read');

  // warm up
  for (let i=6; i<200; i++) {
    await new Promise(resolve => {
      liveSet.subscribe(() => {
        resolve();
      });
      controller.add(i*2);
      controller.add(i*2+1);
    });
  }

  await new Promise(resolve => {
    console.time('changes');
    liveSet.subscribe(changes => {
      console.timeEnd('changes');
      console.log('change count', changes.length);
      resolve();
    });
    for (let i=10000; i<10000+itemsToInsert; i++) {
      controller.add(i);
    }
    for (let i=10000; i<10000+itemsToInsert/2; i++) {
      controller.remove(i);
    }
  });
}

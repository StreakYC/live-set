/* @flow */
/* eslint-disable no-console */

import type LiveSet, {LiveSetController} from '../../src';

export default async function benchmarkLiveSet(liveSet: LiveSet<any>, controller: LiveSetController<number>, itemsToInsert: number=20000, skipReads: boolean=false) {
  function read() {
    return liveSet.values();
  }

  if (!skipReads) {
    // warm up
    for (let i=0; i<2000; i++) {
      read();
    }

    console.time('read');
    for (let i=0; i<1000; i++) {
      read();
    }
    console.timeEnd('read');
  }

  console.time('first sub');
  // warm up
  // Add a dummy listener so that we don't deactivate the stream every time a
  // new listener unsubscribes.
  liveSet.subscribe({});
  console.timeEnd('first sub');

  console.time('warm up first event');
  for (let i=6; i<200; i++) {
    await new Promise((resolve,reject) => {
      const sub = liveSet.subscribe(() => {
        if (i===6) {
          console.timeEnd('warm up first event');
          console.time('warm up finishing');
        }
        try {
          sub.unsubscribe();
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      controller.add(i*2);
      controller.add(i*2+1);
    });
  }
  console.timeEnd('warm up finishing');

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

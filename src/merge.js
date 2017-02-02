/* @flow */

import LiveSet from '.';

export default function merge<T>(liveSets: Array<LiveSet<T>>): LiveSet<T> {
  return new LiveSet({
    read() {
      const s = new Set();
      liveSets.forEach(liveSet => {
        liveSet.values().forEach(value => {
          s.add(value);
        });
      });
      return s;
    },
    listen(controller) {
      const subs = new Set();
      let doneSubscribing = false;
      liveSets.forEach(liveSet => {
        let sub;
        liveSet.subscribe({
          start(_sub) {
            sub = _sub;
            subs.add(sub);
          },
          next(changes) {
            changes.forEach(change => {
              if (change.type === 'add') {
                controller.add(change.value);
              } else if (change.type === 'remove') {
                controller.remove(change.value);
              }
            });
          },
          error(err) {
            controller.error(err);
          },
          complete() {
            subs.delete(sub);
            if (doneSubscribing && subs.size === 0) {
              controller.end();
            }
          }
        });
      });
      doneSubscribing = true;
      if (subs.size === 0) {
        controller.end();
      }
      return () => {
        subs.forEach(sub => {
          sub.unsubscribe();
        });
      };
    }
  });
}

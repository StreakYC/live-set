/* @flow */

import LiveSet from '.';

export default function filter<T>(liveSet: LiveSet<T>, cb: (value: T) => any): LiveSet<T> {
  return new LiveSet({
    read() {
      const ret = new Set();
      liveSet.values().forEach(value => {
        if (cb(value)) {
          ret.add(value);
        }
      });
      return ret;
    },
    listen(setValues, controller) {
      const sub = liveSet.subscribe({
        next(changes) {
          changes.forEach(change => {
            if (change.type === 'add') {
              if (cb(change.value)) {
                passedFilter.add(change.value);
                controller.add(change.value);
              }
            } else if (change.type === 'remove') {
              if (passedFilter.has(change.value)) {
                passedFilter.delete(change.value);
                controller.remove(change.value);
              }
            }
          });
        },
        error(err) {
          controller.error(err);
        },
        complete() {
          controller.end();
        }
      });

      const passedFilter = new Set();
      {
        const s = new Set();
        liveSet.values().forEach(value => {
          if (cb(value)) {
            passedFilter.add(value);
            s.add(value);
          }
        });
        setValues(s);
      }

      return sub;
    }
  });
}

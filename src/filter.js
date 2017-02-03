/* @flow */

import LiveSet from '.';

export default function filter<T>(liveSet: LiveSet<T>, cb: (value: T) => any): LiveSet<T> {
  const s: Set<T> = new Set();
  return new LiveSet({
    read: () => {
      s.clear();
      const ret = new Set();
      liveSet.values().forEach(value => {
        if (cb(value)) {
          s.add(value);
          ret.add(value);
        }
      });
      return ret;
    },
    listen: controller => liveSet.subscribe({
      next(changes) {
        changes.forEach(change => {
          if (change.type === 'add') {
            if (cb(change.value)) {
              s.add(change.value);
              controller.add(change.value);
            }
          } else if (change.type === 'remove') {
            if (s.has(change.value)) {
              s.delete(change.value);
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
    })
  });
}

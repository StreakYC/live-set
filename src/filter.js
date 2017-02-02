/* @flow */

import LiveSet from '.';

export default function filter<T>(liveSet: LiveSet<T>, cb: (value: T) => any): LiveSet<T> {
  const s: Set<T> = new Set();
  return new LiveSet({
    read: () => {
      s.clear();
      return new Set(Array.from(liveSet.values()).filter(value => {
        const keep = cb(value);
        if (keep) {
          s.add(value);
        }
        return keep;
      }));
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

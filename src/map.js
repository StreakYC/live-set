/* @flow */

import LiveSet from '.';

export default function map<T,U>(liveSet: LiveSet<T>, cb: (value: T) => U): LiveSet<U> {
  const m: Map<T,U> = new Map();
  return new LiveSet({
    read: () => {
      m.clear();
      const s = new Set();
      liveSet.values().forEach(value => {
        const newValue = cb(value);
        m.set(value, newValue);
        s.add(newValue);
      });
      return s;
    },
    listen: controller => liveSet.subscribe({
      next(changes) {
        changes.forEach(change => {
          if (change.type === 'add') {
            const newValue = cb(change.value);
            m.set(change.value, newValue);
            controller.add(newValue);
          } else if (change.type === 'remove') {
            const newValue = m.get(change.value);
            if (!newValue) throw new Error('removed item not in liveset');
            m.delete(change.value);
            controller.remove(newValue);
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

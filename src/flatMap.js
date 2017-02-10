/* @flow */

import LiveSet from '.';
import type {LiveSetSubscription} from '.';

export default function flatMap<T,U>(liveSet: LiveSet<T>, cb: (value: T) => LiveSet<U>): LiveSet<U> {
  return new LiveSet({
    read() {
      const s = new Set();
      liveSet.values().forEach(value => {
        const childSet = cb(value);
        childSet.values().forEach(value => {
          s.add(value);
        });
      });
      return s;
    },
    listen(setValues, controller) {
      let mainSubCompleted = false;
      const childSetSubs: Map<LiveSet<U>, LiveSetSubscription> = new Map();

      function childSetSubscribe(childSet: LiveSet<U>, value: T) {
        childSet.subscribe({
          start(sub) {
            childSetSubs.set(childSet, sub);
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
            childSetSubs.delete(childSet);
            childSets.delete(value);
            if (mainSubCompleted && childSetSubs.size === 0) {
              controller.end();
            }
          }
        });
      }

      const mainSub = liveSet.subscribe({
        next(changes) {
          changes.forEach(change => {
            if (change.type === 'add') {
              const childSet = cb(change.value);
              childSets.set(change.value, childSet);
              childSetSubscribe(childSet, change.value);
              childSet.values().forEach(value => {
                controller.add(value);
              });
            } else if (change.type === 'remove') {
              const childSet = childSets.get(change.value);
              if (!childSet) throw new Error('removed value not in liveset');
              const childSetSub = childSetSubs.get(childSet);
              if (!childSetSub) throw Error('childSet was not subscribed to');
              childSet.values().forEach(value => {
                controller.remove(value);
              });
              childSetSub.unsubscribe();
              childSetSubs.delete(childSet);
              childSets.delete(change.value);
            }
          });
        },
        error(err) {
          controller.error(err);
        },
        complete() {
          mainSubCompleted = true;
          if (childSetSubs.size === 0) {
            controller.end();
          }
        }
      });

      const childSets: Map<T, LiveSet<U>> = new Map();
      {
        const initialValues = new Set();
        liveSet.values().forEach(value => {
          const childSet = cb(value);
          childSets.set(value, childSet);
          childSetSubscribe(childSet, value);
          childSet.values().forEach(value => {
            initialValues.add(value);
          });
        });
        setValues(initialValues);
      }

      return {
        unsubscribe() {
          mainSub.unsubscribe();
          childSetSubs.forEach(sub => {
            sub.unsubscribe();
          });
          childSets.clear();
        },
        pullChanges() {
          mainSub.pullChanges();
          childSetSubs.forEach(sub => {
            sub.pullChanges();
          });
        }
      };
    }
  });
}

/* @flow */

import LiveSet from '.';

const arrayXf = {
  '@@transducer/init'() {
    return [];
  },
  '@@transducer/step'(res, input) {
    res.push(input);
    return res;
  },
  '@@transducer/result'(input) {
    return input;
  }
};

export default function transduce(liveSet: LiveSet<any>, transducer: Function): LiveSet<any> {
  let xform = transducer(arrayXf);
  let addsComplete = false;
  return new LiveSet({
    read() {
      xform = transducer(arrayXf);
      addsComplete = false;
      let result = xform['@@transducer/init']();
      for (let value of liveSet.values()) {
        const ret = xform['@@transducer/step'](result, value);
        if (ret && ret['@@transducer/reduced']) {
          result = ret['@@transducer/value'];
          addsComplete = true;
          break;
        }
        result = ret;
      }
      return new Set(xform['@@transducer/result'](result));
    },
    listen(controller) {
      const inputToOutputValues: Map<any, Array<any>> = new Map();
      return liveSet.subscribe({
        next(changes) {
          for (let i=0, len=changes.length; i<len; i++) {
            const change = changes[i];
            if (change.type === 'add') {
              if (!addsComplete) {
                const {value} = change;
                let ret = xform['@@transducer/step']([], value);
                if (ret && ret['@@transducer/reduced']) {
                  ret = ret['@@transducer/value'];
                  addsComplete = true;
                }
                ret.forEach(transformedValue => {
                  const list = inputToOutputValues.get(value);
                  if (list) {
                    list.push(transformedValue);
                  } else {
                    inputToOutputValues.set(value, [transformedValue]);
                  }
                  controller.add(transformedValue);
                });
                xform['@@transducer/result']([]).forEach(endValue => {
                  controller.add(endValue);
                });
              }
            } else if (change.type === 'remove') {
              const {value} = change;
              const list = inputToOutputValues.get(value);
              if (list) {
                list.forEach(transformedValue => {
                  controller.remove(transformedValue);
                });
                inputToOutputValues.delete(value);
              }
            }
          }
        },
        error(err) {
          controller.error(err);
        },
        complete() {
          controller.end();
        }
      });
    }
  });
}

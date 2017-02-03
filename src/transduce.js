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
  function step(xform: Object, inputValue: any): {
    outputValues: Array<any>;
    addsComplete: boolean;
  } {
    let addsComplete = false;
    let outputValues;
    const ret = xform['@@transducer/step']([], inputValue);
    if (ret && ret['@@transducer/reduced']) {
      outputValues = ret['@@transducer/value'];
      addsComplete = true;
    } else {
      outputValues = ret;
    }
    return {
      outputValues,
      addsComplete
    };
  }

  function valuesAndContext(): {
    values: Set<any>;
    inputToOutputValues: Map<any, Array<any>>;
    xform: Object;
    addsComplete: boolean;
  } {
    const inputToOutputValues = new Map();
    const xform = transducer(arrayXf);
    let addsComplete = false;
    const values = new Set(xform['@@transducer/init']());
    for (let value of liveSet.values()) {
      const {outputValues, addsComplete: _addsComplete} = step(xform, value);
      inputToOutputValues.set(value, outputValues);
      for (let i=0,len=outputValues.length; i<len; i++) {
        values.add(outputValues[i]);
      }
      if (_addsComplete) {
        addsComplete = true;
        xform['@@transducer/result']([]).forEach(value => {
          values.add(value);
        });
        break;
      }
    }
    return {
      values,
      inputToOutputValues,
      xform,
      addsComplete
    };
  }

  return new LiveSet({
    read: () => valuesAndContext().values,
    listen(setValues, controller) {
      const sub = liveSet.subscribe({
        next(changes) {
          for (let i=0,len=changes.length; i<len; i++) {
            const change = changes[i];
            if (change.type === 'add') {
              if (!addsComplete) {
                const {value} = change;
                const {outputValues, addsComplete: _addsComplete} = step(xform, value);
                inputToOutputValues.set(value, outputValues);
                for (let i=0,len=outputValues.length; i<len; i++) {
                  controller.add(outputValues[i]);
                }
                if (_addsComplete) {
                  addsComplete = true;
                  xform['@@transducer/result']([]).forEach(endValue => {
                    controller.add(endValue);
                  });
                }
              }
            } else if (change.type === 'remove') {
              const {value} = change;
              const list = inputToOutputValues.get(value);
              if (!list) throw new Error('value had not been added');
              list.forEach(transformedValue => {
                controller.remove(transformedValue);
              });
              inputToOutputValues.delete(value);
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

      let {values: initialValues, inputToOutputValues, xform, addsComplete} = valuesAndContext();
      setValues(initialValues);

      return sub;
    }
  });
}

/* @flow */

import asap from 'asap';
import $$observable from 'symbol-observable';

export type LiveSetChangeRecord<T> =
  {type: 'add', value: T} |
  {type: 'remove', value: T} |
  {type: 'end'};

export type LiveSetController<T> = {
  closed: boolean;
  add(item: T): void;
  remove(item: T): void;
  error(err: any): void;
  end(): void;
};

export type ListenHandler = {
  unsubscribe(): void;
  +pullChanges?: () => void;
};

export type LiveSetInit<T> = {
  read(): Set<T>;
  listen(
    setValues: { (values: Set<T>): void },
    controller: LiveSetController<T>
  ): ?ListenHandler|()=>void;
};

export type LiveSetSubscriber<T> = (changes: Array<LiveSetChangeRecord<T>>) => void;

export type LiveSetSubscription = {
  closed: boolean;
  unsubscribe(): void;
  pullChanges(): void;
};

export type LiveSetObserver<T> = {
  start?: ?(subscription: LiveSetSubscription) => void;
  next?: ?(changes: Array<LiveSetChangeRecord<T>>) => void;
  error?: ?(err: any) => void;
  complete?: ?() => void;
};

type LiveSetObserverRecord<T> = {
  ignore: number;
  observer: LiveSetObserver<T>;
};

export default class LiveSet<T> {
  _init: LiveSetInit<T>;

  _values: ?Set<T> = null;
  _active: ?{
    controller: LiveSetController<T>;
    listenHandler: ListenHandler;
  } = null;
  _ended: boolean = false;
  _endedWithError: boolean = false;
  _error: any = null;
  _queuedCall: boolean = false;
  _changeQueue: Array<LiveSetChangeRecord<T>> = [];
  _observers: Array<LiveSetObserverRecord<T>> = [];

  constructor(init: LiveSetInit<T>) {
    this._init = init;
  }

  static active<T>(initialValues: ?Set<T>): {liveSet: LiveSet<T>, controller: LiveSetController<T>} {
    const set = initialValues || new Set();
    let controller;
    const liveSet = new LiveSet({
      read: () => set,
      listen: (setValues, _controller) => {
        setValues(set);
        controller = _controller;
      }
    });
    liveSet.subscribe({});
    return {liveSet, controller: (controller: any)};
  }

  static constant<T>(values: Set<T>): LiveSet<T> {
    const {liveSet, controller} = LiveSet.active(values);
    controller.end();
    return liveSet;
  }

  _queueChange(record: ?LiveSetChangeRecord<T>) {
    if (record) {
      this._changeQueue.push(record);
    }
    if (!this._queuedCall) {
      this._queuedCall = true;
      asap(() => {
        this._queuedCall = false;
        const changes = this._changeQueue;
        this._changeQueue = [];
        let observersToCall;
        const ended = this._ended;
        if (ended) {
          observersToCall = this._observers;
          this._observers = [];
        } else {
          observersToCall = this._observers.slice();
        }
        observersToCall.forEach(record => {
          const {observer, ignore} = record;
          const observerNext = observer.next;
          if (observerNext) {
            if (ignore === 0) {
              observerNext.call(observer, changes);
            } else {
              record.ignore = 0;
              const changesToDeliver = changes.slice(ignore);
              if (changesToDeliver.length) {
                observerNext.call(observer, changes);
              }
            }
          }
          if (ended) {
            if (this._endedWithError) {
              if (observer.error) observer.error(this._error);
            } else {
              if (observer.complete) observer.complete();
            }
          }
        });
      });
    }
  }

  _deactivate() {
    if (!this._active) throw new Error('already inactive');
    const {listenHandler} = this._active;
    this._active = null;
    if (listenHandler) {
      listenHandler.unsubscribe();
    }
  }

  values(): Set<T> {
    if (this._values) {
      const values = this._values;
      if (this._active) {
        const {listenHandler} = this._active;
        if (listenHandler.pullChanges) {
          listenHandler.pullChanges();
        }
      }
      return new Set(values);
    } else {
      return this._init.read();
    }
  }

  isEnded(): boolean {
    return this._ended;
  }

  subscribe(observerOrOnNext: LiveSetObserver<T> | (changes: Array<LiveSetChangeRecord<T>>) => void, onError: ?(err: any) => void, onComplete: ?() => void): LiveSetSubscription {
    const liveSet = this;

    let observer;
    if (typeof observerOrOnNext === 'function') {
      observer = {
        next: observerOrOnNext,
        error: onError,
        complete: onComplete
      };
    } else {
      observer = observerOrOnNext;
    }

    (observer: LiveSetObserver<T>);

    if (this._ended) {
      const subscription = {
        closed: false,
        unsubscribe: () => {
          subscription.closed = true;
        },
        pullChanges: () => {}
      };
      if (observer.start) {
        observer.start(subscription);
      }
      if (!subscription.closed && observer.complete) {
        observer.complete();
      }
      subscription.closed = true;
      return subscription;
    }

    const observerRecord = {observer, ignore: this._changeQueue.length};
    this._observers.push(observerRecord);
    const subscription = {
      /*:: closed: false&&` */ get closed() {
        return liveSet._observers.indexOf(observerRecord) < 0;
      }/*:: ` */,
      unsubscribe: () => {
        const ix = this._observers.indexOf(observerRecord);
        if (ix >= 0) {
          this._observers.splice(ix, 1);
          if (!this._ended && this._observers.length === 0) {
            this._values = null;
            this._deactivate();
          }
        }
      },
      pullChanges: () => {
        const changeQueueLength = this._changeQueue.length;
        const originalNext = observer.next;
        if (changeQueueLength !== 0 && originalNext) {
          const changesToDeliver = this._changeQueue.slice(observerRecord.ignore);
          if (changesToDeliver.length !== 0) {
            observerRecord.ignore = changeQueueLength;
            originalNext.call(observer, changesToDeliver);
          }
        }
      }
    };
    if (observer.start) {
      observer.start(subscription);
    }
    // Check that they haven't immediately unsubscribed
    if (this._observers[this._observers.length-1] === observerRecord && !this._active) {
      const controller: LiveSetController<T> = {
        // Flow doesn't support getters and setters yet
        /*:: closed: false&&` */ get closed() {
          return !liveSet._active || liveSet._active.controller !== this;
        }/*:: ` */,
        add: value => {
          const values = this._values;
          if (!values) throw new Error('setValue must be called before controller is used');
          if (!this._ended && !values.has(value)) {
            values.add(value);
            this._queueChange({type: 'add', value});
          }
        },
        remove: value => {
          const values = this._values;
          if (!values) throw new Error('setValue must be called before controller is used');
          if (!this._ended && values.has(value)) {
            values.delete(value);
            this._queueChange({type: 'remove', value});
          }
        },
        error: err => {
          if (this._ended) return;
          this._ended = true;
          this._endedWithError = true;
          this._error = err;
          this._queueChange();
          this._deactivate();
        },
        end: () => {
          if (this._ended) return;
          this._ended = true;
          this._queueChange();
          this._deactivate();
        }
      };
      const active = this._active = {
        controller,
        listenHandler: {
          unsubscribe: () => {}
        }
      };
      const setValuesError = () => {
        throw new Error('setValues must be called once during listen');
      };
      let setValues = values => {
        setValues = setValuesError;
        this._values = values;
      };
      const listenHandlerOrFunction = this._init.listen(values => setValues(values), controller);
      if (!this._values) {
        setValuesError();
      }
      observerRecord.ignore = this._changeQueue.length;
      if (typeof listenHandlerOrFunction === 'function') {
        active.listenHandler = {
          unsubscribe: listenHandlerOrFunction
        };
      } else if (listenHandlerOrFunction != null && typeof listenHandlerOrFunction.unsubscribe === 'function') {
        active.listenHandler = listenHandlerOrFunction;
      } else if (listenHandlerOrFunction != null) {
        throw new TypeError('listen must return object with unsubscribe method, a function, or null');
      }
      if (controller.closed) {
        this._active = active;
        this._deactivate();
      }
    }

    return subscription;
  }
}

// Assign here because Flow doesn't support computed property keys on classes:
// https://github.com/facebook/flow/issues/2286
(LiveSet:any).prototype[$$observable] = function() {
  return this;
};

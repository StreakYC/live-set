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

export type LiveSetInit<T> = {
  read(): Set<T>;
  listen(
    setValues: { (values: Set<T>): void },
    controller: LiveSetController<T>
  ): ?{unsubscribe():void}|()=>void;
};

export type LiveSetSubscriber<T> = (changes: Array<LiveSetChangeRecord<T>>) => void;

export type LiveSetSubscription = {
  closed: boolean;
  unsubscribe(): void;
};

export type LiveSetObserver<T> = {
  start?: ?(subscription: LiveSetSubscription) => void;
  next?: ?(changes: Array<LiveSetChangeRecord<T>>) => void;
  error?: ?(err: any) => void;
  complete?: ?() => void;
};

export default class LiveSet<T> {
  _init: LiveSetInit<T>;

  _values: ?Set<T> = null;
  _activeController: ?LiveSetController<T> = null;
  _listenCleanup: ?()=>void = null;
  _ended: boolean = false;
  _endedWithError: boolean = false;
  _error: any = null;
  _queuedCall: boolean = false;
  _changeQueue: Array<LiveSetChangeRecord<T>> = [];
  _observers: Array<LiveSetObserver<T>> = [];

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
        observersToCall.forEach(observer => {
          if (observer.next) {
            observer.next(changes);
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
    this._activeController = null;
    const listenCleanup = this._listenCleanup;
    if (listenCleanup) {
      this._listenCleanup = null;
      listenCleanup();
    }
  }

  values(): Set<T> {
    if (this._values) {
      return new Set(this._values);
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
        }
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

    this._observers.push(observer);
    const subscription = {
      /*:: closed: false&&` */ get closed() {
        return liveSet._observers.indexOf(observer) < 0;
      }/*:: ` */,
      unsubscribe: () => {
        const ix = this._observers.indexOf(observer);
        if (ix >= 0) {
          this._observers.splice(ix, 1);
          if (this._observers.length === 0) {
            this._values = null;
            this._deactivate();
          }
        }
      }
    };
    if (observer.start) {
      observer.start(subscription);
    }
    // Check that they haven't immediately unsubscribed
    if (this._observers[this._observers.length-1] === observer && !this._activeController) {
      const controller: LiveSetController<T> = this._activeController = {
        // Flow doesn't support getters and setters yet
        /*:: closed: false&&` */ get closed() {
          return liveSet._activeController !== this;
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
      const setValuesError = () => {
        throw new Error('setValues must be called once during listen');
      };
      let setValues = values => {
        setValues = setValuesError;
        this._values = values;
      };
      const cleanup = this._init.listen(values => setValues(values), controller);
      if (!this._values) {
        setValuesError();
      }
      if (cleanup != null) {
        if (typeof cleanup.unsubscribe === 'function') {
          this._listenCleanup = () => {
            cleanup.unsubscribe();
          };
        } else if (typeof cleanup !== 'function') {
          throw new TypeError('listen must return null or a function');
        } else {
          this._listenCleanup = (cleanup:any);
        }
        if (controller.closed) {
          this._deactivate();
        }
      }
    }

    const changeQueueLength = this._changeQueue.length;
    const originalNext = observer.next;
    if (changeQueueLength !== 0 && originalNext) {
      observer.next = changes => {
        observer.next = originalNext;
        const newChanges = changes.slice(changeQueueLength);
        if (newChanges.length !== 0) {
          originalNext.call(observer, newChanges);
        }
      };
    }

    return subscription;
  }
}

// Assign here because Flow doesn't support computed property keys on classes:
// https://github.com/facebook/flow/issues/2286
(LiveSet:any).prototype[$$observable] = function() {
  return this;
};

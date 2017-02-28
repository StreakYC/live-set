# live-set

This class represents a set of values which may change over time or have
transformations applied to it, resulting in a new LiveSet. After modifications
are made, notifications will be delivered asynchronously, like Javascript
Promises or
[MutationObservers](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
do. This library is inspired by the [Kefir
library](http://rpominov.github.io/kefir/) and the [Observable
proposal](https://tc39.github.io/proposal-observable/), but represents a
changing set rather than a stream of individual values.

## API

### Core

#### LiveSet::constructor
`LiveSet<T>::constructor({read, listen})`

#### LiveSet.constant
`LiveSet.constant<T>(values: Set<T>): LiveSet<T>`

#### LiveSet.active
`LiveSet.active<T>(initialValues?: Set<T>): {liveSet: LiveSet<T>, controller: LiveSetController<T>}`

#### LiveSet::isEnded
`LiveSet<T>::isEnded(): boolean`

#### LiveSet::values
`LiveSet<T>::values(): Set<T>`

#### LiveSet::subscribe
`LiveSet<T>::subscribe(observer): LiveSetSubscription`

#### LiveSetSubscription::closed
`LiveSetSubscription::closed: boolean`

#### LiveSetSubscription::unsubscribe
`LiveSetSubscription::unsubscribe(): void`

#### LiveSetSubscription::pullChanges
`LiveSetSubscription::pullChanges(): void`

### Transformations

The following functions usually take a pre-existing LiveSet instance as input,
and return a new LiveSet instance. These functions are implemented in separate
modules rather than as methods of LiveSet in part so that only the functions
used have to be included in a javascript bundle built for browsers.

#### live-set/filter
`filter<T>(liveSet: LiveSet<T>, cb: (value: T) => any): LiveSet<T>`

#### live-set/map
`map<T,U>(liveSet: LiveSet<T>, cb: (value: T) => U): LiveSet<U>`

#### live-set/transduce
`transduce(liveSet: LiveSet<any>, transducer: Function): LiveSet<any>`

#### live-set/merge
`merge<T>(liveSets: Array<LiveSet<T>>): LiveSet<T>`

#### live-set/flatMap
`flatMap<T,U>(liveSet: LiveSet<T>, cb: (value: T) => LiveSet<U>): LiveSet<U>`

#### live-set/mapWithRemoval
`mapWithRemoval<T,U>(input: LiveSet<T>, cb: (value: T, removal: Promise<void>) => U): LiveSet<U>`

#### live-set/toValueObservable
`toValueObservable<T>(liveSet: LiveSet<T>): Observable<{value: T, removal: Promise<void>}>`

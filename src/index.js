const TASK_STACK = [];

const COMPLETE_STATE = Symbol('complete');
const ERROR_STATE = Symbol('error');
const RUNNING_STATE = Symbol('running');
const CANCEL_TOKEN = Symbol('cancel');

function defer() {
  const deferred = {};

  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });

  return deferred;
}

export class Runnable {
  constructor(generator) {
    this.generator = generator;
  }

  run(...argv) {
    return new Task(this.generator(...argv));
  }
}

export class Task {
  constructor(iterator = null) {
    this.parent = TASK_STACK[TASK_STACK.length - 1] || null;

    this.state = RUNNING_STATE;
    this.iterator = iterator;
    this.subscriptions = new Set();
    this.children = new Set();

    if (this.parent) {
      this.parent.children.add(this);
    }

    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });

    this.proceed(null);
  }

  subscribe(callback) {
    this.subscriptions.add(callback);

    return () => {
      this.subscriptions.delete(callback);

      delete this.unsubscribe;
    };
  }

  unsubscribe() {
    // noop
  }

  then(onResolve, onReject) {
    return this.promise.then(onResolve, onReject);
  }

  /** @private */
  tap(method, value) {
    try {
      TASK_STACK.push(this);

      return this.iterator[method](value);
    } finally {
      TASK_STACK.pop();
    }
  }

  /** @private */
  step(value, done, next) {
    try {
      if (value === CANCEL_TOKEN) {
        next(this.tap('return', value));
      } else if (value instanceof Task) {
        if (value.state === RUNNING_STATE) {
          this.unsubscribe();

          this.unsubscribe = value.subscribe((error, value) => {
            try {
              if (error === null) {
                next(this.iterator.next(value));
              } else {
                next(this.iterator.throw(error));
              }
            } catch (error) {
              next({
                error: true,
                value: error
              });
            }
          });
        } else {
          next({
            error: value.state === ERROR_STATE,
            value: value.value
          });
        }
      } else if (value && typeof value.then === 'function') {
        this.unsubscribe();

        this.unsubscribe = this.subscribe(value);

        value.then(
          resolved => {
            if (this.subscriptions.has(value)) {
              this.unsubscribe();

              this.step(resolved, done, next);
            }
          },
          rejected => {
            try {
              if (this.subscriptions.has(value)) {
                this.unsubscribe();

                next(this.tap('throw', rejected));
              }
            } catch (error) {
              next({
                error: true,
                value: error
              });
            }
          }
        );
      } else if (done) {
        next({ value });
      } else {
        next(this.tap('next', value));
      }
    } catch (error) {
      next({
        error: true,
        value: error
      });
    }
  }

  /** @private */
  proceed(previous) {
    this.step(previous, false, ({ value, done, error }) => {
      if (error) {
        this.error(value);
      } else if (done) {
        this.complete(value);
      } else {
        this.proceed(value);
      }
    });
  }

  terminate(state, value, promise, serr, sval) {
    this.state = state;
    this.value = value;

    promise(value);

    if (this.parent) {
      this.parent.children.delete(this);
      this.parent = null;
    }

    // notify children
    this.children.forEach(child => {
      child.interrupt();
    });

    // notify parent
    this.subscriptions.forEach(subscription => {
      if (typeof subscription === 'function') {
        subscription(serr, sval);
      }
    });
  }

  /** @private */
  error(previous) {
    this.step(previous, true, ({ value }) => {
      this.terminate(ERROR_STATE, value, this.reject, value, null);
    });
  }

  /** @private */
  complete(previous) {
    this.step(previous, true, ({ value }) => {
      if (value === CANCEL_TOKEN) {
        value = undefined;
      }

      this.terminate(COMPLETE_STATE, value, this.resolve, null, value);
    });
  }

  //
  // It's not a cancel.
  // Cancel implies the iterator goes into a terminal state.
  // But it doesn't. You can't force a generator to go into
  // a terminal state. The generator has to choose to go into
  // a terminal state.
  interrupt(reason) {
    this.unsubscribe(); // An interrupt should cause parent to unsubscribe from current wait

    this.proceed(CANCEL_TOKEN);
  }
}

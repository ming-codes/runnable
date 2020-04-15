const TASK_STACK = []; 

const COMPLETE_STATE = Symbol('complete');
const ERROR_STATE = Symbol('error');
const RUNNING_STATE = Symbol('running');
const CANCEL_TOKEN = Symbol('cancel');

let currentTask = null;
let interruptTask = null;

function createDeferred() {
  const deferred = {};

  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });

  return deferred;
}

export class Task {
  static get current() {
    return currentTask;
  }

  constructor(iterator = null) {
    this.parent = TASK_STACK[TASK_STACK.length - 1] || null;

    this.state = RUNNING_STATE;
    this.iterator = iterator;
    this.subscriptions = new Set();
    this.children = new Set();

    if (this.parent) {
      this.parent.children.add(this);
    }

    this.deferred = createDeferred();

    this.proceed(null);
  }

  get isRunning() {
    return this.state === RUNNING_STATE;
  }

  get isComplete() {
    return this.state === COMPLETE_STATE;
  }

  get isError() {
    return this.state === ERROR_STATE;
  }

  get isInterrupt() {
    return this === interruptTask;
  }

  subscribe(callback) {
    const unsubscribe = () => {
      this.subscriptions.delete(callback);

      delete this.unsubscribe;
    };

    try {
      this.subscriptions.add(callback);

      return unsubscribe;
    } finally {
      if (typeof callback === 'function') {
        if (this.state === ERROR_STATE) {
          callback(this.value, null);
        }
        if (this.state === COMPLETE_STATE) {
          callback(null, this.value);
        }
        if (this.state !== RUNNING_STATE) {
          unsubscribe();
        }
      }
    }
  }

  unsubscribe() {
    // noop
  }

  then(onResolve, onReject) {
    return this.deferred.promise.then(onResolve, onReject);
  }

  /** @private */
  tap(method, value) {
    try {
      TASK_STACK.push(this);

      currentTask = this;

      return this.iterator[method](value);
    } finally {
      currentTask = null;

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
                next(this.tap('next', value));
              } else {
                next(this.tap('throw', error));
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
    if (!this.isInterrupt) {
      interruptTask = null;
    }

    this.step(previous, false, ({ value, done, error }) => {
      if (error) {
        this.error(value);
      } else if (done) {
        this.complete(value);
      } else {
        if (this.isInterrupt) {
          interruptTask = null;
        }

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
      this.terminate(ERROR_STATE, value, this.deferred.reject, value, null);
    });
  }

  /** @private */
  complete(previous) {
    this.step(previous, true, ({ value }) => {
      if (value === CANCEL_TOKEN) {
        value = undefined;
      }

      this.terminate(COMPLETE_STATE, value, this.deferred.resolve, null, value);
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

    if (this.state === RUNNING_STATE) {
      if (!interruptTask) {
        interruptTask = this;
      }

      this.proceed(CANCEL_TOKEN);
    }
  }
}

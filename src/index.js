const TASK_STACK = [];

const COMPLETE_STATE = Symbol('complete');
const ERROR_STATE = Symbol('error');
const CANCEL_TOKEN = Symbol('cancel');

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

    this.iterator = iterator;
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
      } else if (value && typeof value.then === 'function') {
        value.then(
          (resolved => {
            this.step(resolved, done, next);
          }),
          (rejected => {
            try {
              next(this.tap('throw', rejected));
            } catch (error) {
              next({
                error: true,
                value: error
              });
            }
          }),
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

  /** @private */
  error(previous) {
    this.step(previous, true, ({ value }) => {
      this.state = ERROR_STATE;
      this.value = value;

      this.reject(value);

      if (this.parent) {
        this.parent.children.delete(this);
        this.parent = null;
      }
    });
  }

  /** @private */
  complete(previous) {
    this.step(previous, true, ({ value }) => {
      this.state = COMPLETE_STATE;
      this.value = value;

      this.resolve(value);

      if (this.parent) {
        this.parent.children.delete(this);
        this.parent = null;
      }
    });
  }

  //
  // It's not a cancel.
  // Cancel implies the iterator goes into a terminal state.
  // But it doesn't. You can't force a generator to go into
  // a terminal state. The generator has to choose to go into
  // a terminal state.
  interrupt() {
    this.proceed(CANCEL_TOKEN);

    return;
    //Task.canceled = this;
  //  this.children.forEach(child => {
  //    child.cancel();
  //  });
    debugger;
    // XXX
    // Cancel is a special case.
    // .return calls into finally block, but the block is still allowed to throw
    try {
      const cancel = Symbol();
      const { value, done } = this.iterator.return(cancel);
      // TODO
      // - [ ] it can throw
      // - [ ] it can return ""
      // - [ ] it can yield and just refuse to terminate
      //
      // So it's like a interrupt signal. The process can choose not to shut down.
      debugger;
    } catch (error) {
      debugger;
    }
    //Task.canceled = null;
  }
}

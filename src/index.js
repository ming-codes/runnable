const TASK_STACK = [];

const COMPLETE_STATE = 1;
const ERROR_STATE = 2;

let parent = null;

export class Runnable {
  constructor(generator) {
    this.generator = generator;
  }

  run(...argv) {
    return new Task(this.generator(...argv));
  }
}

export class Task {
  static canceled = null;

  constructor(iterator = null) {
    //const parent = TASK_STACK[TASK_STACK.length - 1] || null;

    this.iterator = iterator;
    //this.children = [];

    //if (parent) {
    //  parent.children.push(this);
    //}

    this.proceed(null);
  }

  step(value) {
    try {
      return this.iterator.next(value);
    } catch (error) {
      return {
        error: true,
        value: error
      };
    }
  }

  proceed(previous) {
    const { value, done, error } = this.step(previous);

    if (error) {
      this.throw(value);
    } else if (done) {
      this.finalize(value);
    } else {
      this.proceed(value);
    }
  }

  throw(previous) {
    this.state = ERROR_STATE;
    this.value = previous;
  }

  finalize(previous) {
    this.state = COMPLETE_STATE;
    this.value = previous;
  }

  //proceed(previous) {
  //  debugger;
  //  if (previous instanceof Task) {
  //    // do nothing?
  //    debugger;
  //  } if (previous && typeof previous.then === 'function') {
  //    previous
  //      .then(
  //        value => {
  //          this.proceed(value);
  //        },
  //        reason => {
  //          this.throw(reason);
  //        }
  //      );
  //  } else {
  //    try {
  //      TASK_STACK.push(this);
  //      const { value, done } = this.iterator.next(previous);
  //      TASK_STACK.pop();

  //      if (done) {
  //        this.finalize(value);
  //      } else {
  //        this.proceed(value);
  //      }
  //    } catch (error) {
  //      this.throw(error);
  //    }
  //  }
  //}

  //throw(error) {
  //  debugger;
  //}

  //finalize(value) {
  //  debugger;
  //  if (value && typeof value.then === 'function') {
  //    value.then(value => {
  //      this.finalize(value);
  //    });
  //  } else {
  //    // TODO notify done
  //    debugger;
  //  }
  //}

  ////async start() {
  ////  let value = null;
  ////  let done = false;

  ////  do {
  ////    try {
  ////      const prev = parent;

  ////      parent = this.children;

  ////      if (value instanceof Task) {
  ////        value = await value.promise;
  ////      } else {
  ////        value = await value;
  ////      }
  ////      // TODO there's some problem with waiting for another task
  ////      ({ value, done } = this.iterator.next(value));
  ////      parent = prev;

  ////      // TODO apparently parent/child linking is a big problem in EC too 
  ////      //TASK_STACK.slice(TASK_STACK.indexOf(this)); // This is descendents, not just children
  ////                                                  // The stack is really a tree
  ////    } finally {
  ////    }

  ////  } while (!done);

  ////  return value;
  ////}

  //cancel() {
  //  Task.canceled = this;
  //  this.children.forEach(child => {
  //    child.cancel();
  //  });
  //  this.iterator.return();
  //  Task.canceled = null;
  //}
}

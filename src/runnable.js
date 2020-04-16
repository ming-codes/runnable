import { Task } from './task';

export class Runnable {
  constructor(...argv) {
    this.generator = argv.pop();
    this.concurrency = argv.pop() || 1;
  }

  unsubscribe() {
    // noop
  }

  run(...argv) {
    return new Task(this.generator(...argv));
  }
}

export class RestartRunnable extends Runnable {
  run(...argv) {
    if (this.last) {
      this.unsubscribe();
      this.last.interupt();
    }

    this.last = super.run(...argv);
    this.unsubscribe = this.last.subscribe((error, value) => {
      this.last = null;
    });

    return this.last;
  }
}

export class DropRunnable extends Runnable {
  run(...argv) {
    if (this.last) {
      return this.last;
    }

    this.last = super.run(...argv);
    this.unsubscribe = this.last.subscribe((error, value) => {
      this.last = null;
    });

    return this.last;
  }
}

export class FetchRunnable extends Runnable {
}

// TODO
export class EnqueueRunnable extends Runnable {
  run(...argv) {
    return new Task(this.generator(...argv));
  }
}

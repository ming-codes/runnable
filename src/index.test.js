import { Runnable, Task } from './index';

/**
 * Symtax:
 *
 * ab#c#d|
 */
function marble(expr, fn) {
  return async function() {
    const stream = [];

    const init = fn(function emitter(ch) {
      stream.push(ch);
    });

    if (init instanceof Task) {
      const task = init;

      try {
        await task;

        stream.push('|', task.value);
      } catch (error) {
        stream.push('#', task.value);
      }
    }

    if (init instanceof Runnable) {
      const task = init.run();

      try {
        await task;

        stream.push('|', task.value);
      } catch (error) {
        stream.push('#', task.value);
      }
    }

    expect(stream.join('')).to.equal(expr);
  };
}

function waitForever() {
  return new Promise(Function.prototype);
};

function waitForMicroTaskQueue(value) {
  return Promise.resolve(value);
}

function waitForTaskQueue(value) {
  return new Promise(resolve => {
    setTimeout((() => resolve(value)), 0);
  });
}

describe(Runnable.name, function() {
  describe('synchronous usage', function() {
    it('should run with simple yield', marble('abc|d', function(emit) {
      return new Runnable(function* () {
        emit('a');

        yield 1;

        emit('b');

        yield 2;

        emit('c');

        return 'd';
      });
    }));

    it('should handle throw within simple runnable', marble('ab#c', function(emit) {
      return new Runnable(function* () {
        emit('a');

        yield 1;

        emit('b');

        throw 'c';
      });
    }));

    it('should allow thrown errors to be caught', marble('ab|d', function(emit) {
      return new Runnable(function* () {
        emit('a');

        yield 1;

        emit('b');

        try {
          throw 'c';
        } catch (error) {
          return 'd';
        }
      });
    }));

    it('should run with child', marble('a123b123c|d', function(emit) {
      const child = new Runnable(function* () {
        emit('1');

        yield 1;

        emit('2');

        yield 1;

        emit('3');
      });

      return new Runnable(function* () {
        emit('a');

        yield child.run();

        emit('b');

        yield child.run();

        emit('c');

        return 'd';
      });
    }));

    it('should establish parent / child relationship during task construction', function() {
      const children = [];

      const child = new Runnable(function* () {
        yield waitForever();
      });

      const parent = new Runnable(function* () {
        children.push(child.run());
        children.push(child.run());
        children.push(child.run());

        yield waitForever();
      });

      const inspect = [ ...parent.run().children ];

      expect(inspect[0]).to.equal(children[0]);
      expect(inspect[1]).to.equal(children[1]);
      expect(inspect[2]).to.equal(children[2]);
    });

    it.skip('should allow sync interrupt', function() {
    });
  });

  describe('asynchronous usage', function() {
    it('should run with simple yield', marble('abc|d', function(emit) {
      return new Runnable(function* () {
        emit('a');

        emit('b');

        yield waitForMicroTaskQueue();

        emit('c');

        return waitForMicroTaskQueue('d');
      });
    }));

    it('should handle rejected promise within simple runnable', marble('ab#c', function(emit) {
      return new Runnable(function* () {
        emit('a');

        yield 1;

        emit('b');

        yield Promise.reject('c');
      });
    }));

    it('should allow rejected promise to be caught', marble('ab|d', function(emit) {
      return new Runnable(function* () {
        emit('a');

        yield 1;

        emit('b');

        try {
          yield Promise.reject('c');
        } catch (error) {
          return 'd';
        }
      });
    }));

    it('should allow interupt async task with return', marble('ab|e', function(emit) {
      const runnable = new Runnable(function* () {
        emit('a');

        emit('b');

        try {
          yield waitForever();
        } finally {
          return 'e';
        }
      });

      const task = runnable.run();

      setTimeout(function() {
        task.interrupt();
      });

      return task;
    }));

    it('should allow interupt async task with throw', marble('ab#f', function(emit) {
      const runnable = new Runnable(function* () {
        emit('a');

        emit('b');

        try {
          yield waitForever();

          return 'g';
        } finally {
          throw 'f';
        }
      });

      const task = runnable.run();

      setTimeout(function() {
        task.interrupt();
      });

      return task;
    }));

    it('should allow interrupt async task with more yield', marble('abc|d', function(emit) {
      const runnable = new Runnable(function* () {
        emit('a');

        try {
          yield waitForever();
        } finally {
          emit('b');

          yield 1;

          emit('c');

          yield waitForMicroTaskQueue();

          return 'd';
        }
      });

      const task = runnable.run();

      setTimeout(function() {
        task.interrupt();
      });

      return task;
    }));

    it('should establish parent / child relationship during task construction', function() {
      const children = [];

      const child = new Runnable(function* () {
        yield waitForever();
      });

      const parent = new Runnable(function* () {
        children.push(child.run());

        yield waitForMicroTaskQueue();

        children.push(child.run());

        yield waitForMicroTaskQueue();

        children.push(child.run());

        yield waitForever();
      });

      const inspect = [ ...parent.run().children ];

      expect(inspect[0]).to.equal(children[0]);
      expect(inspect[1]).to.equal(children[1]);
      expect(inspect[2]).to.equal(children[2]);
    });

    it('should allow chaining tasks', marble('ab12cd12ef|aa', function(emit) {
      const child = new Runnable(function* () {
        emit('1');

        yield waitForMicroTaskQueue();

        emit('2');
        
        return 'a';
      });

      return new Runnable(function* () {
        emit('a');

        emit('b');

        const one = yield child.run();

        emit('c');

        emit('d');

        const two = yield child.run();

        emit('e');

        emit('f');

        return `${one}${two}`;
      });
    }));

    it.skip('should allow parant cancel to cancel children', marble('ab1cd2|e', function(emit) {
      const child = new Runnable(function* () {
        emit('1');

        try {
          yield waitForever();
        } finally {
          emit('2');
        }
      });
      const parent = new Runnable(function* () {
        emit('a');

        emit('b');

        try {
          // interrupt cause this to move on from here,
          // but parent .then is still subscribed to here
          // so an interrupt need to cause parent to unsubscribe
          //
          // When parent reaches a terminal state, then we want to 
          // interrupt / cancel children tasks.
          yield child.run();
        } finally {
          emit('c');

          yield waitForTaskQueue();

          emit('d');

          return 'e';
        }
      });

      const task = parent.run();

      setTimeout(function() {
        task.interrupt();
      });

      return task;
    }));
  });
});


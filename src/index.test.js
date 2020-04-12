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

function forever() {
  return new Promise(Function.prototype);
};

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
  });

  describe('asynchronous usage', function() {
    it('should run with simple yield', marble('abc|d', function(emit) {
      return new Runnable(function* () {
        emit('a');

        emit('b');

        yield Promise.resolve();

        emit('c');

        return Promise.resolve('d');
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
          yield forever();
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
          yield forever();
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

    it.skip('should allow interrupt async task with more yield');

    it.only('should establish parent / child relationship during task construction', function() {
      debugger;
      const tasks = { children: [] };

      tasks.parent = new Task({
        next() {
          const child = new Task({
            next() {
              return {
                done: true,
                value: forever()
              };
            }
          });

          tasks.children.push(child);

          return child;
        }
      });

      expect([ ...tasks.parent.children ][0]).to.equal(tasks.children[0]);
    });

    it.skip('should establish parent / child relationship through async operations', function() {
      const tasks = { children: [] };

      tasks.parent = new Task({
        next() {
          const child = new Task({
            next() {
              return {
                done: false,
                value: forever()
              };
            }
          });

          tasks.children.push(child);

          return child;
        }
      });

      expect([ ...tasks.parent.children ][0]).to.equal(tasks.children[0]);
    });

    it.skip('should allow chaining tasks', marble('ab12cd12ef', function(emit) {
      const child = new Runnable(function* () {
        emit('1');

        yield Promise.resolve();

        emit('2');
        
      });
      const parent = new Runnable(function* () {
        emit('a');

        emit('b');

        debugger;
        yield child.run();
        debugger;

        emit('c');

        emit('d');

        yield child.run();

        emit('e');

        emit('f');
      });

      return parent.run();
    }));

    it.skip('should allow parant cancel to cancel children', marble('ab12a', function(emit) {
      const child = new Runnable(function* () {
        emit('1');

        try {
          yield forever();
        } finally {
          if (Task.canceled) {
            emit('2a');
          } else {
            emit('2b');
          }
        }
      });
      const parent = new Runnable(function* () {
        emit('a');

        emit('b');

        yield child.run();

        emit('c');

        emit('d');
      });

      const task = parent.run();

      Promise.resolve();

      task.cancel();
    }));
  });
});


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

    if (init instanceof Runnable) {
      const { value, state } = await init.run();

      switch (state) {
        case 1: stream.push('|', value); break;
        case 2: stream.push('#', value); break;
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

  describe.only('asynchronous usage', function() {
    it('should run async task', marble('abc|d', async function(emit) {
      return new Runnable(function* () {
        emit('a');

        emit('b');

        yield Promise.resolve();

        emit('c');

        return 'd';
      });
    }));

    it('should cancel async task', marble('abc', async function(emit) {
      const runnable = new Runnable(function* () {
        emit('a');

        emit('b');

        try {
          yield forever();
        } finally {
          if (Task.canceled) {
            emit('c');
          } else {
            emit('d');
          }
        }
      });

      const task = runnable.run();

      await Promise.resolve();

      task.cancel();
    }));

    it('should allow chaining tasks', marble('ab12cd12ef', async function(emit) {
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

    it.skip('should allow parant cancel to cancel children', marble('ab12a', async function(emit) {
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

      await Promise.resolve();

      task.cancel();
    }));
  });
});


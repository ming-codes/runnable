
# runnable

`runnable` is a tiny library (3k) for handling async data flow.

# Install

# Usage

```
import { Runnable, fetch } from 'runnable';

const runnable = new Runnable(function* () {

  try {
    const response = yield fetch('http://example.com');

    return response.json();
  } finally {

  }
});


```

# API Reference

## `Runnable`

```
import { Runnable } from 'runnable';
```

The `Runnable` class is the base class of all runnables. It wraps a generator
function and exposes a `.run` method to start a `Task`.

## `Task`

```
import { Task } from 'runnable';
```

The `Task` class represents one unit of execution. Most methods on this class are private bars the following.

- `.interrupt`
- `.then`
- `get isRunning`
- `get isComplete`
- `get isError`
- `get isInterrupt`

class EventQueue {
  constructor({ concurrency = 4 } = {}) {
    this.concurrency = concurrency;
    this.active = 0;
    this.queue = [];
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ reject, resolve, task });
      this.runNext();
    });
  }

  runNext() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift();
      this.active += 1;

      Promise.resolve()
        .then(item.task)
        .then(item.resolve)
        .catch(item.reject)
        .finally(() => {
          this.active -= 1;
          this.runNext();
        });
    }
  }

  stats() {
    return {
      active: this.active,
      pending: this.queue.length,
      concurrency: this.concurrency
    };
  }
}

module.exports = {
  EventQueue
};

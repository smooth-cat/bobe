export class Log {
  order: string[] = [];

  fnMap = new Map<string, Function>();
  fn(name: string) {
    if (this.fnMap.has(name)) {
      return this.fnMap.get(name);
    }
    const fn = jest.fn(() => {
      this.order.push(name);
    });
    this.fnMap.set(name, fn);
    return fn;
  }

  call(name: string) {
    this.fn(name)?.();
  }

  toBe(...args: string[]) {
    expect(this.order).toEqual(args);
    this.order = []
  }

  clear() {
    this.order = [];
    this.fnMap.clear();
  }
}

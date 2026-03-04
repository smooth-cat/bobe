```ts
// 子 Store
class A extends Store {
  v: number;

  update(value: number) {
    this.v = value;
  }
}

// 父 Store
class B extends Store {
  foo = {
    baz: 10
  };
  a = A.new<A, B, 'a'>({ v: ['foo', 'baz'] });
  changeA() {
    this.a.update(4);
  }
}

const b = new B();
b.changeA();
expect(b.foo.baz).toBe(4);
```


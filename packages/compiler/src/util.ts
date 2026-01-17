/*
 * @Description: 实现队列
 */
export type QueueNode<T> = {
  value: T;
  __next?: QueueNode<T>;
  __prev?: QueueNode<T>;
};

export class Queue<T> {
  start: QueueNode<T> | undefined = undefined;
  end: QueueNode<T> | undefined = undefined;
  len = 0;

  constructor(initialArr?: T[]) {
    initialArr?.forEach((it) => {
      this.push(it);
    });
  }

  push(value: T) {
    // (inner) -> next ->  <- prev - (outer)
    this.add(value, 'end', '__prev', '__next');
  }
  pop() {
    // (inner) -> next ->  <- prev - (outer)
    return this.del('end', '__prev', '__next');
  }
  unshift(value: T) {
    // (outer) -> next ->  <- prev - ( inner)
    this.add(value, 'start', '__next', '__prev');
  }

  shift() {
    // (outer) -> next ->  <- prev - ( inner)
    return this.del('start', '__next', '__prev');
  }

  // 入队
  add(value: T, nodeKey = 'start', innerKey = '__next', outerKey = '__prev') {
    this.len++;
    const node = this[nodeKey];
    const item = { value };
    // 第一个节点
    if (!node) {
      this.start = item;
      this.end = item;
      return;
    }
    // 里 -> 外
    node[outerKey] = item;
    // 外 -> 里
    item[innerKey] = node;
    this[nodeKey] = item;
  }
  // 出队
  del(nodeKey = 'start', innerKey = '__next', outerKey = '__prev') {
    const node: QueueNode<T> = this[nodeKey];
    // 空队列
    if (!node) {
      return;
    }
    this.len--;

    // 把两个键都断开，然后指向靠内的节点
    const inner = node[innerKey];
    node[innerKey] = undefined;

    // 说明 node 是最后一个节点，删除了 start，end 都为空
    if (!inner) {
      this.start = undefined;
      this.end = undefined;
      return node.value;
    }

    // 两者都存在，断开键，指向 inner
    inner[outerKey] = undefined;
    this[nodeKey] = inner;
    return node.value;
  }

  array() {
    const arr: T[] = [];
    let point = this.start;
    while (point != null) {
      arr.push(point.value);
      point = point.__next;
    }
    console.log('arr', arr);

    return arr;
  }
}


export function isNum(char: string) {
  return char === '0' ||
    char === '1' ||
    char === '2' ||
    char === '3' ||
    char === '4' ||
    char === '5' ||
    char === '6' ||
    char === '7' ||
    char === '8' ||
    char === '9' 
}

// const queue = new Queue([1,2,3,4]);
// queue.shift()
// queue.pop()
// // @ts-ignore
// queue.unshift('a')
// // @ts-ignore
// queue.push('b')
// queue.shift()
// queue.pop()
// queue.shift()
// queue.pop()
// queue.shift()
// queue.pop()
// queue.push(10)
// queue.array();

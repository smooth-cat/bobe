export enum Dirty {
  Clean = 0b000,
  Unknown = 0b10,
  UpChanged = 0b01
}

type Getter<T = any> = () => T;

/** 原子 signal 更新次数 */
let time = 0;
let id = 0;

type Mix<T> = {
  (v: T): void;
  (): T;
};

const dirtyLeafs = new Set<Effect>();

export const markDirty = (signal: Signal) => {
  let level = 0;
  dfs(
    signal,
    false,
    (node: Effect) => {
      const isEffect = level > 0;
      const isLeaf = !node.emitEnd;
      if (isEffect) {
        if (level === 1) {
          node.dirty |= Dirty.UpChanged;
        } else {
          node.dirty |= Dirty.Unknown;
        }
      }

      if (isLeaf && isEffect) {
        dirtyLeafs.add(node);
      }
      level++;
    },
    () => {
      level--;
      const isEffect = level > 0;
      // 回到 source，此时完成了所有 effect 收集，可以进行调度了
      if (!isEffect) {
        dirtyLeafs.forEach(effect => {
          effect.scheduler(effect.dirty);
          dirtyLeafs.delete(effect);
        });
      }
    }
  );
};

export class Signal<T = any> implements Vertex {
  time = 0;
  id = id++;

  recEnd: Line;
  recStart: Line;
  emitStart: Line;
  emitEnd: Line;

  constructor(private value: T) {}

  #get() {
    Line.link(this, Effect.curr);
    return this.value;
  }
  #set(v: T) {
    if (this.value === v) {
      return;
    }
    this.value = v;
    this.time = ++time;
    markDirty(this as any);
  }

  mix: Mix<T> = (...args: any[]) => {
    if (args.length) {
      return this.#set(args[0]) as any;
    }
    return this.#get();
  };
}

export class Effect<T = any> implements Vertex {
  recEnd: Line;
  recStart: Line;
  emitStart: Line;
  emitEnd: Line;

  static curr: Effect;
  id = id++;
  memo: T;
  timeUpdate = -1;
  timeBeforeGet = -1;

  dirty: Dirty;

  constructor(private fn: Getter<T>) {}
  get = () => {
    // 脏状态检查
    if (this.dirty === Dirty.Clean) {
      return this.memo;
    }
    this.dirty = Dirty.Clean;

    // 与上次 get 时时相同
    if (this.timeBeforeGet === time) {
      return this.memo;
    }
    this.timeBeforeGet = time;

    let downstream = Effect.curr;

    // 由上游来修改 下游的依赖情况
    Line.link(this, downstream);
    // get 前指针复位，上游节点的 get 通过 recEnd 重新计算这个下游节点的 recEnd
    this.recEnd = undefined;
    Effect.curr = this;
    try {
      const res = this.fn();

      if (res !== this.memo) {
        this.memo = res;
        this.timeUpdate = time;
      }
    } finally {
      // 作为下游，执行完 get 上游节点已经完成了依赖更新，把 recEnd 后的依赖删除即可
      let toDel = this.recEnd?.nextRecLine;
      while (toDel) {
        const memoNext = toDel.nextRecLine;
        Line.unlink(toDel);
        toDel = memoNext;
      }
      Effect.curr = downstream;
      return this.memo;
    }
  };
  scheduler = (dirty: Dirty) => {
    dirty & (Dirty.Unknown | Dirty.UpChanged) && this.get();
  };
}

type Vertex = {
  /** 上游来的最后一条线 */
  recEnd: Line;
  recStart: Line;
  /** 向下游发出的最后一条线 */
  emitEnd: Line;
  emitStart: Line;
};

function dfs(v: Vertex, isUp = false, begin?: (v: Vertex) => any, complete?: (v: Vertex) => void) {
  let node: Vertex = v;
  let line: Line;
  const lineStack: Line[] = [];
  const listKey = isUp ? 'recStart' : 'emitStart';
  const nodeKey = isUp ? 'upstream' : 'downstream';
  // 向上意味着要找所有节点的入度
  const nextLineKey = isUp ? 'nextRecLine' : 'nextEmitLine';
  const reverseNodeKey = isUp ? 'downstream' : 'upstream';

  while (1) {
    const notGoDeep = begin(node);
    lineStack.push(line);
    line = node[listKey];
    if (line && !notGoDeep) {
      const firstChild = line[nodeKey];
      node = firstChild;
      continue;
    }

    while (1) {
      complete(node);
      line = lineStack.pop();
      // 递归出口，回到起点
      if (node === v) {
        return;
      }

      const nextLine = line[nextLineKey];
      // 有兄弟节点， 进入外循环，向下遍历兄弟节点
      if (nextLine) {
        // 外层循环后会把 sibling line 入栈，这里不需要处理
        line = nextLine;
        node = nextLine[nodeKey];
        break;
      }
      // 没有兄弟节点就上浮
      node = line[reverseNodeKey];
    }
  }
}

class Line {
  static link(v1: Vertex, v2: Vertex) {
    if (!v2) return;
    let { emitEnd } = v1,
      { recEnd, recStart } = v2,
      noRecEnd = !recEnd,
      /** 模拟头节点 */
      head = { nextRecLine: recStart } as Line,
      line: Line;
    recEnd = recEnd || head;

    const { nextRecLine } = recEnd || {};
    // 没有下一个收到的线
    if (!nextRecLine) {
      line = new Line();
      // 内部会处理空链表的情况，即同步头部
      Line.emit_line(v1, line);
      Line.rec_line(v2, line);
      emitEnd && Line.line_line_emit(emitEnd, line);
      !noRecEnd && Line.line_line_rec(recEnd, line);
    }
    // 复用
    else if (nextRecLine.upstream === v1) {
      v2.recEnd = nextRecLine;
      // TODO: link 版本标记
    }
    // 插入(这么做): v1 和 下一个 入度(订阅)节点不同
    // TODO: v2上次真依赖了 v1 只是没检查出来，需要删除原依赖
    else {
      line = new Line();
      Line.emit_line(v1, line);
      Line.rec_line(v2, line);
      emitEnd && Line.line_line_emit(emitEnd, line);
      Line.insert_line_rec(recEnd, nextRecLine, line);
    }
    // 消除 head
    for (const key in head) {
      head[key] = undefined;
    }
  }

  static unlink(line: Line) {
    let { prevEmitLine, nextEmitLine, prevRecLine, nextRecLine, upstream, downstream } = line;
    line.prevEmitLine = undefined;
    line.nextEmitLine = undefined;
    line.prevRecLine = undefined;
    line.nextRecLine = undefined;
    line.upstream = undefined;
    line.downstream = undefined;

    /** 上游节点发出的线 前一条 关联 后一条 */
    if (prevEmitLine) {
      prevEmitLine.nextEmitLine = nextEmitLine;
    } else {
      // 删除的是首个节点
      upstream.emitStart = nextEmitLine;
    }
    if (nextEmitLine) {
      nextEmitLine.prevEmitLine = prevEmitLine;
    } else {
      // 删除尾节点
      upstream.emitEnd = prevEmitLine;
    }

    /** 下游节点接收的线，我们从 recEnd 开始删除的，
     * 接收信息，不需要设置 recEnd ，
     * 因为 recStart ~ recEnd 是经过上级 get 确认的有用依赖
     * */
    if (prevRecLine) {
      prevRecLine.nextRecLine = nextRecLine;
    } else {
      // 删除的是首个节点，大概率不可能从有依赖 变成无依赖
      downstream.recStart = nextRecLine;
    }
    if (nextRecLine) {
      nextRecLine.prevRecLine = prevRecLine;
    }
  }

  /** 上游节点 连 link */
  static emit_line(upstream: Vertex, line: Line) {
    if (!upstream.emitStart) {
      upstream.emitStart = line;
    }
    upstream.emitEnd = line;
    line.upstream = upstream;
  }
  /** 下游节点 连 link */
  static rec_line(downstream: Vertex, line: Line) {
    if (!downstream.recStart) {
      downstream.recStart = line;
    }
    downstream.recEnd = line;
    line.downstream = downstream;
  }

  /** 同一节点发出的 两个条线 相连 */
  static line_line_emit(l1: Line, l2: Line) {
    if (!l1 || !l2) return;
    l1.nextEmitLine = l2;
    l2.prevEmitLine = l1;
  }

  /** 同一节点接收的 两个条线 相连 */
  static line_line_rec(l1: Line, l2: Line) {
    if (!l1 || !l2) return;
    l1.nextRecLine = l2;
    l2.prevRecLine = l1;
  }

  static insert_line_emit(l1: Line, l2: Line, ins: Line) {
    l1.nextEmitLine = ins;
    ins.prevEmitLine = l1;
    l2.prevEmitLine = ins;
    ins.nextEmitLine = l2;
  }

  static insert_line_rec(l1: Line, l2: Line, ins: Line) {
    l1.nextRecLine = ins;
    ins.prevRecLine = l1;
    l2.prevRecLine = ins;
    ins.nextRecLine = l2;
  }

  /** 上游顶点 */
  public upstream: Vertex;
  /** 上游节点 发出的上一条线 */
  public prevEmitLine: Line;
  /** 上游节点 发出的下一条线 */
  public nextEmitLine: Line;

  /** 下游顶点 */
  public downstream: Vertex;
  /** 下游节点 接收的上一条线 */
  public prevRecLine: Line;
  /** 下游节点 接收的下一条线 */
  public nextRecLine: Line;
  constructor() {}
}

const s = new Signal(1);
const s1 = new Signal(0);
const s2 = new Signal(10);

const ef3 = new Effect(() => {
  if (s.mix()) {
    return s1.mix();
  }
  return s2.mix() * 2;
});

const ef4 = new Effect(() => {
  const a = ef3.get();
  console.log({ a });
});

ef4.get();

s.mix(0);

console.log('good');

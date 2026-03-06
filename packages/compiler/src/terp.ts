import { Tokenizer } from './tokenizer';
import { $, effect, Keys, shareSignal, Signal, Store } from 'aoye';
import {
  BobeUI,
  ComponentNode,
  CustomRenderConf,
  FragmentNode,
  Hook,
  HookProps,
  HookType,
  IfNode,
  LogicNode,
  LogicType,
  ProgramCtx,
  StackItem,
  TerpConf,
  TerpEvt,
  TokenType
} from './type';
import { BaseEvent } from 'bobe-shared';
const tap = new BaseEvent();

export class Interpreter {
  /** 模板字符串动态节点的占位符 */
  HookId = '_h_o_o_k_';
  /** 用于渲染的数据 */
  data: Record<any, any> = {};
  /** 模板字符串动态节点索引 */
  hookI = 0;
  lastInserted;
  opt: TerpConf;
  constructor(private tokenizer: Tokenizer) {}
  // /** program 要挂载的父节点位置 */
  // root: any;
  // /** program 挂载的前置节点 */
  // anchor: any;

  program(root: any, before?: any) {
    const componentNode: ComponentNode = {
      __logicType: LogicType.Component,
      realParent: root,
      store: new Store()
    };
    this.tokenizer.consume();
    let prevSibling: any = null;
    let current: any;
    const stack: StackItem[] = [{ node: root, prev: prevSibling }];
    while (1) {
      if (this.tokenizer.isEof()) {
        this.handleInsert(root, current, prevSibling, componentNode);
        break;
      }

      const token = this.tokenizer.token;
      // 下沉，创建 child0
      if (token.type & TokenType.Indent) {
        const INDENT = this.tokenizer.consume();
        stack.push({
          node: current,
          prev: prevSibling
        });
        current = this.declaration({ stack, prevSibling });
        prevSibling = null;
        continue;
      }
      // token 不是 Indent ，就是 同级节点 或 Dedent
      // 将之前产生的 current 添加到父节点
      if (current) {
        if (stack.length > 1) {
          const { node: parent } = stack[stack.length - 1];
          // 子节点是逻辑节点，其会通过自身 program 进行元素挂载
          this.handleInsert(parent, current, prevSibling);
        }
        // 处理 root 下的子节点
        else {
          if (!prevSibling) {
            prevSibling = before;
          }
          this.handleInsert(root, current, prevSibling, componentNode);
        }
      }
      // 下一个 token 是 Dedent
      if (this.tokenizer.token.type & TokenType.Dedent) {
        const DEDENT = this.tokenizer.consume();
        const { node: parent, prev } = stack.pop();
        prevSibling = prev;
        current = parent;
      }
      // 下一个是 同级节点
      else {
        prevSibling = current;
        current = this.declaration({ stack, prevSibling });
      }
    }
    componentNode.lastInserted = this.lastInserted;
    this.lastInserted = null;
    return componentNode;
  }

  /** 处理
   *                    是逻辑                               是普通
   * 父节点       将子节点加入 directList         调用 insert 方法挨个插入子节点
   * 子节点           仅插入到父逻辑节点              将本节点插入父节点
   * 理论上父节点不能是一个 逻辑节点，遇到if 时 Terp 会重新执行 program 这种情况下，会指定 root 为真实 dom
   */
  handleInsert(parent: any, child: any, prev: any, parentComponent?: any) {
    // 父 是 逻辑节点
    if (parentComponent) {
      // parentComponent.directList.push(child);
    }
    // 子 不是 逻辑节点则加入
    if (!child.__logicType) {
      // 前置节点空 或 普通节点
      if (!prev || !prev.__logicType) {
        this.insertAfter(parent, child, prev);
      }
      // 前置节点是逻辑节点
      else {
        const before = prev.lastInserted;
        // const anchor = this.createAnchor();
        // // 逻辑 -> anchor -> child
        // this.insertAfter(parent, anchor, before);
        this.insertAfter(parent, child, before);
        prev.realAfter = child;
      }
    }
    // 子 是 逻辑节点
    else {
      const childCmp: LogicNode = child;
      childCmp.realParent = parent;
      // 前置节点空
      if (!prev) {
        const anchor = this.createAnchor();
        this.insertAfter(parent, anchor, prev);
        this.insertAfter(parent, child, anchor);
        childCmp.realBefore = anchor;
      }
      // 前置是逻辑节点
      else if (prev.__logicType) {
        const before = prev.lastInserted;
        const anchor = this.createAnchor();
        this.insertAfter(parent, anchor, before);
        this.insertAfter(parent, child, anchor);
        childCmp.realBefore = anchor;
        prev.realAfter = anchor;
      }
      // 前置节点普通
      else {
        childCmp.realBefore = prev;
      }
    }
  }

  /** 考虑到同级 逻辑模块 */
  getPrevRealSibling(prevSibling: any) {
    // 正常节点则直接返回
    if (!prevSibling || !prevSibling.__logicType) {
      return prevSibling;
    }
    let point = prevSibling;
    while (point != null) {
      if (point.lastChild) {
        return point.lastChild.value;
      }
      point = point.anchor;
    }
  }

  /**
   * 声明部分：
   * 包含首行定义和（可选的）多行属性扩展
   * <declaration> ::= <tagName=token> <headerLine> <extensionLines>
   *  */
  declaration(ctx: ProgramCtx) {
    const [hookType, value] = this._hook({});
    let _node: any;

    if (value === 'if') {
      return this.ifDeclaration();
    } else if (hookType) {
      // 静态 1. Component，2. bobe 返回的 render 方法
      if (hookType === 'static') {
        // 传组件 class
        if (typeof value === 'function' && value.prototype instanceof Store) {
          _node = this.componentDeclaration(value, ctx);
        }
        // 传组件片段
        else if (typeof value === 'function') {
          _node = this.fragmentDeclaration(value);
        }
        // 其余类型不允许静态插值
        else {
          throw new SyntaxError(`declaration 不支持 ${value} 类型的静态插值`);
        }
      }
      // 动态插值
      // 一定是 js 表达式
      // 1. 返回基础值，创建文本节点 createNode('text', String(value))
      // 2. 返回  组件，创建组件节点
      // 3. 返回  片段
      // TODO: 后续考虑动态组件
      else {
        const isKeyInsertion = Boolean(this.data[Keys.Raw][value]);

        const fn = new Function('data', `let v;with(data){v=(${value})};return v`);

        _node = this.createNode(value);
      }
    } else {
      _node = this.createNode(value);
    }
    this.tokenizer.consume();
    this.headerLine(_node);
    this.extensionLines(_node);
    if (_node.__logicType === LogicType.Component) {
      tap.once(TerpEvt.HandledComponentNode, node => (_node = node));
      tap.emit(TerpEvt.AllAttrGot);
    }
    return _node;
  }

  // TODO: 指定挂载位置
  fragmentDeclaration(renderFragment: BobeUI) {
    const fragmentNode: FragmentNode = {
      __logicType: LogicType.Fragment,
      realParent: null
    };
    renderFragment.call(this.data, this.opt, { data: this.data, root: '', anchor: '' });
    return fragmentNode;
  }

  /**
   * key 元素，组件的 key
   * value
   * 1. 静态类型值
   * 2. 插值计算 函数，可以考虑 使用 effect 或 computed 做处理
   *
   * mapKey 映射, 对应子组件的属性
   *  */
  onePropParsed(node: any, key: string, value: any, valueIsMapKey: boolean, hookI?: number) {
    if (typeof value === 'function') {
      effect(() => {
        const res = value();
        this.setProp(node, key, res, hookI);
      });
    } else if (valueIsMapKey) {
      effect(() => {
        const res = this.data[value];
        this.setProp(node, key, res, hookI);
      });
    }
    // 静态数据
    else {
      this.setProp(node, key, value, hookI);
    }
  }

  componentDeclaration(Component: typeof Store, ctx: ProgramCtx) {
    // 先进行 attr 映射，或建立 signal 连接，才能开始 render
    // 必须等待 attr 解析完毕
    const child = Component.new();
    const prevOnePropParsed = this.onePropParsed;
    this.onePropParsed = (node, key, value, valueIsMapKey, hookI) => {
      // key 映射
      if (valueIsMapKey) {
        shareSignal(this.data, value, child, key);
      }
      // 动态值内置 computed 处理
      else if (typeof value === 'function') {
        const meta = child[Keys.Meta];
        const cells: Map<string, Signal> = meta.cells;
        const computed = $(value);
        cells.set(key, computed);
      }
      // 静态值
      else {
        child[Keys.Raw][key] = value;
      }
    };

    tap.once(TerpEvt.AllAttrGot, () => {
      // 执行 program 时需要挂载到 parent
      const parent = ctx.stack[ctx.stack.length - 1].node;
      const prev = ctx.prevSibling;
      this.onePropParsed = prevOnePropParsed;
      const componentNode = (child['ui'] as BobeUI)(this.opt, { data: child }, parent, prev);
      tap.emit(TerpEvt.HandledComponentNode, componentNode);
    });
    return { __logicType: LogicType.Component };
  }

  ifDeclaration() {
    const ifIdentifier = this.tokenizer.consume();
    const [isHook, value] = this._hook({});
    const ifNode: IfNode = {
      __logicType: LogicType.If,
      condition: value,
      realParent: null,
      snapshot: this.tokenizer.snapshot(),
      isFirstRender: true,
      watcher: null,
      anchor: null
    };
    ifNode.watcher = effect(
      ({ val }) => {
        if (val) {
          const condition = this.tokenizer.consume();
          const newLine = this.tokenizer.consume();
        } else {
          const skipStr = this.tokenizer.skip();
        }
      },
      [value]
    );
    return ifNode;
  }

  /**
   * <extensionLines> ::= PIPE <attributeList> NEWLINE <extensionLines>
   *                    | ε
   */
  extensionLines(_node: any) {
    while (1) {
      //  终止条件，下一行不是 pipe
      if (!(this.tokenizer.token.type & TokenType.Pipe)) {
        return;
      }
      // 开始解析 attributeList
      const PIPE = this.tokenizer.consume();
      this.attributeList(_node);
      // 文件结束了，通常不会发生
      if (!(this.tokenizer.token.type & TokenType.NewLine)) {
        return;
      }
      // 换行
      const NEWLINE = this.tokenizer.consume();
    }
  }

  /**
   * 首行：
   * 节点名称 + 属性列表 + 换行
   * <headerLine> ::= <attributeList> NEWLINE
   */
  headerLine(_node: any) {
    this.attributeList(_node);
    const NEWLINE = this.tokenizer.consume();
  }

  /**
   * 属性列表：
   * 可以是空的，或者包含多个属性
   * <attributeList> ::= <attribute> <attributeList>
   *                    | ε
   *
   * <attribute> ::= <key> = <value>
   * 1. 普通节点 执行 setProps 🪝
   * 2. 组件节点 收集映射关系，或通过 effect 直接设值
   */
  attributeList(_node: any) {
    let key: string, eq: any;
    while (!(this.tokenizer.token.type & TokenType.NewLine)) {
      // 取 key
      if (key == null) {
        key = this.tokenizer.token.value as any;
      }
      // 取 =
      else if (eq == null) {
        eq = '=';
      }
      // 取 value
      else {
        const [hookType, value] = this._hook({});
        // 动态的要做成函数
        if (hookType === 'dynamic') {
          const valueIsMapKey = Reflect.has(this.data[Keys.Raw], value);
          const fn = valueIsMapKey
            ? value
            : new Function('data', `let v;with(data){v=${value}};return v;`).bind(undefined, this.data);
          this.onePropParsed(_node, key, fn, valueIsMapKey, this.hookI);
        }
        // 静态
        else if (hookType === 'static') {
          this.onePropParsed(_node, key, value, false, this.hookI);
        }
        // 基础数据字面量
        else {
          this.onePropParsed(_node, key, value, false, this.hookI);
        }
        key = null;
        eq = null;
      }
      this.tokenizer.consume();
    }
  }
  config(opt: TerpConf) {
    Object.assign(this, opt);
    this.opt = opt;
  }

  createNode(name: string) {
    return {
      name,
      props: {},
      nextSibling: null
    };
  }

  nextSib(node: any) {
    return node.nextSibling;
  }

  createAnchor() {
    return {
      name: 'anchor',
      nextSibling: null
    };
  }

  insertAfter(parent: any, node: any, prev: any) {
    this.lastInserted = node;
    return this.defaultInsert(parent, node, prev);
  }
  defaultInsert(parent: any, node: any, prev: any) {
    if (prev) {
      const next = prev.nextSibling;
      prev.nextSibling = node;
      node.nextSibling = next;
    } else {
      parent.firstChild = node;
    }
  }

  remove(parent: any, node: any, prevSibling: any) {
    return this.defaultRemove(parent, node, prevSibling);
  }
  // TODO: 默认改成 prevItem
  defaultRemove(parent: any, node: any, prevSibling: any) {
    const next = node.nextSibling;
    if (prevSibling) {
      prevSibling.nextSibling = next;
    }
    if (parent.firstChild === node) {
      parent.firstChild = next;
    }
  }

  setProp(node: any, key: string, value: any, hookI?: number) {
    node.props[key] = value;
  }

  init(fragments: string | string[]) {
    if (typeof fragments === 'string') {
      this.tokenizer.setCode(fragments);
    } else {
      let code = '';
      for (let i = 0; i < fragments.length - 1; i++) {
        const fragment = fragments[i];
        code += fragment + `${this.HookId}${i}`;
      }
      this.tokenizer.setCode(code + fragments[fragments.length - 1]);
    }
  }
  hook: Hook;
  _hook = (props: Partial<HookProps>): [HookType | undefined, any] => {
    const value = this.tokenizer.token.value;
    const isDynamicHook = this.tokenizer.token.type & TokenType.InsertionExp;
    const isStaticHook = typeof value === 'string' && value.indexOf(this.HookId) === 0;
    const hookType: HookType = isDynamicHook ? 'dynamic' : isStaticHook ? 'static' : undefined;
    // 静态插值 `${xxx}`
    if (this.hook && isStaticHook) {
      const hookI = Number(value.slice(this.HookId.length));
      const res = this.hook({
        ...props,
        HookId: this.HookId,
        i: hookI
      });
      this.hookI++;
      return [hookType, res];
    }
    // 动态插值 `{xxx}`
    else if (isDynamicHook) {
      return [hookType, value];
    }
    // 普通值
    return [hookType, value];
  };
}

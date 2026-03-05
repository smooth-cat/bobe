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
  StackItem,
  TerpConf,
  TerpEvt,
  TokenType
} from './type';
import { BaseEvent } from 'bobe-shared';
const tap = new BaseEvent();

export class Terp {
  /** 模板字符串动态节点的占位符 */
  HookId = '_h_o_o_k_';
  /** 用于渲染的数据 */
  data: Record<any, any> = {};
  /** 模板字符串动态节点索引 */
  hookI = 0;
  stack: StackItem[] = [];
  constructor(private tokenizer: Tokenizer) {}
  // /** program 要挂载的父节点位置 */
  // root: any;
  // /** program 挂载的前置节点 */
  // anchor: any;
  program() {
    const root: ComponentNode = {
      __logicType: LogicType.Component,
      store: this.data as any,
      realList: [],
      directList: []
    };
    this.tokenizer.consume();
    let current: any;
    let prevSibling: any;
    this.stack = [{ node: root, prevSibling }];
    while (1) {
      if (this.tokenizer.isEof()) {
        this.handleInsert(root, current, root.realList[root.realList.length - 1]);
        break;
      }

      const token = this.tokenizer.token;
      // 下沉，创建 child0
      if (token.type & TokenType.Indent) {
        const INDENT = this.tokenizer.consume();
        this.stack.push({
          prevSibling,
          node: current
        });
        // 第 0 个节点没有前置节点
        prevSibling = null;
        current = this.declaration();
        continue;
      }
      // token 不是 Indent ，就是 同级节点 或 Dedent
      // 将之前产生的 current 添加到父节点
      if (current) {
        if (this.stack.length > 1) {
          const parent = this.stack[this.stack.length - 1].node;
          this.handleInsert(parent, current, prevSibling);
        } else {
          this.handleInsert(root, current, prevSibling);
        }
      }
      // 下一个 token 是 Dedent
      if (this.tokenizer.token.type & TokenType.Dedent) {
        const DEDENT = this.tokenizer.consume();
        const { node: parent, prevSibling: prevParent } = this.stack.pop();
        prevSibling = prevParent;
        current = parent;
      }
      // 下一个是 同级节点
      else {
        prevSibling = current;
        current = this.declaration();
      }
    }
    return root;
  }

  /** 处理
   *                   是逻辑                         是普通
   * 父节点  将子节点们插入到 realList          调用 insert 方法挨个插入子节点
   * 子节点  将其下 realList 插入到父节点       将本节点插入父节点
   */
  handleInsert(parent: any, child: any, prevSibling: any) {
    let insertFn = this.insert.bind(this);
    if (parent.__logicType) {
      insertFn = (parent: any, child: any, prevSibling: any) => {
        parent.realList.splice(parent.realList.indexOf(prevSibling) + 1, 0, child);
      };
    }
    if (child.__logicType) {
      const realList = child.realList as any[];
      for (let i = realList.length; i--; ) {
        const item = realList[i];
        insertFn(parent, item, prevSibling);
      }
    } else {
      insertFn(parent, child, prevSibling);
    }
  }

  /**
   * @deprecated
   * 节点列表：
   * 可以是一个节点，也可以跟随更多节点
   * <nodeList> ::= <node> <nodeList> <EOF|Dedent>
   *               |
   */
  nodeList(parent: any) {
    let _node: any;
    let prevSibling: any;
    let prevItem: any;
    let anchor: any;
    while (1) {
      // 对于 Program    EOF 表示 list 遍历完成
      if (this.tokenizer.isEof()) {
        return;
      }

      // 对于 childList  Dedent 表示 childList 遍历完成
      if (this.tokenizer.token.type & TokenType.Dedent) {
        this.tokenizer.consume();
        return;
      }
      _node = this.node();

      // 父节点是 if 采用 if.children.push 的方式采集
      // 父节点不是 if 采用 insert 进行采集
      const insert = parent.__logicType ? this.defaultInsert : this.insert.bind(this);
      const remove = parent.__logicType ? this.defaultRemove : this.remove.bind(this);

      // 子节点不是 if，直接插入单个子节点
      if (!_node.__logicType) {
        const realPrev = this.getPrevRealSibling(prevSibling);
        const currItem = insert(parent, _node, realPrev, prevItem);
        prevItem = currItem;
        prevSibling = _node;
        continue;
      }

      if (prevSibling) {
        _node.anchor = prevSibling;
      }
      // 没有 prevSibling 且父是 logic
      else if (parent.__logicType) {
        _node.anchor = parent;
      }
      // 父节点是普通节点，确实前面没有东西，anchor => null
      else {
      }
      // 子节点是 if，将 child 插入到
      if (_node.child && _node.condition()) {
        let item = _node.child;
        while (item != null) {
          const { value: child } = item;
          const realPrev = this.getPrevRealSibling(prevSibling);
          const currItem = insert(parent, child, realPrev, prevItem);
          item = item.next;
          prevItem = currItem;
          prevSibling = child;
        }
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
   * 单个节点：
   * 由声明部分和（可选的）子节点块组成
   * <node> ::= <declaration> <childrenBlockOpt>
   *  */
  node() {
    const _declaration: any = this.declaration();
    // 条件为假时执行 skip 逻辑
    if (_declaration.__logicType & LogicType.If && !_declaration.condition()) {
      return _declaration;
    }
    this.childrenBlockOpt(_declaration);
    return _declaration;
  }

  /**
   * 声明部分：
   * 包含首行定义和（可选的）多行属性扩展
   * <declaration> ::= <tagName=token> <headerLine> <extensionLines>
   *  */
  declaration() {
    const [hookType, value] = this._hook({});
    let _node: any;

    if (value === 'if') {
      return this.ifDeclaration();
    } else if (hookType) {
      // 静态 1. Component，2. bobe 返回的 render 方法
      if (hookType === 'static') {
        // 传组件 class
        if (typeof value === 'function' && value.prototype instanceof Store) {
          _node = this.componentDeclaration(value);
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
      directList: [],
      realList: []
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

  componentDeclaration(Component: typeof Store) {
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
      this.onePropParsed = prevOnePropParsed;
      const root = (child['ui'] as BobeUI)(this.opt, { data: child });
      tap.emit(TerpEvt.HandledComponentNode, root);
    });
    return { __logicType: LogicType.Component };
  }

  ifDeclaration() {
    const ifIdentifier = this.tokenizer.consume();
    const [isHook, value] = this._hook({});
    const ifNode: IfNode = {
      __logicType: LogicType.If,
      condition: value,
      directList: [],
      realList: [],
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

  /** 子节点块：
   * 必须被缩进包裹
   * <childrenBlockOpt> ::= INDENT <nodeList>
   *                        | ε  /* 空（表示叶子节点，没有孩子）
   *  */
  childrenBlockOpt(parent: any) {
    // 无 children
    if (!(this.tokenizer.token.type & TokenType.Indent)) {
      return [];
    }
    const INDENT = this.tokenizer.consume();
    const list = this.nodeList(parent);
    return list;
  }

  opt: TerpConf;
  config(opt: TerpConf) {
    Object.assign(this, opt);
    this.opt = opt;
  }

  createNode(name: string) {
    return {
      name,
      props: {}
    };
  }

  insert(parent: any, node: any, prevSibling: any, prevItem?: any) {
    return this.defaultInsert(parent, node, prevSibling, prevItem);
  }
  defaultInsert(parent: any, node: any, prevSibling: any, prevItem: any) {
    if (prevSibling) {
      const children: any[] = parent.children;
      const insertI = children.findIndex(item => item === prevSibling);
      children.splice(insertI + 1, 0, node);
    } else {
      parent.children = [node];
    }
  }

  remove(parent: any, node: any, prevSibling: any, prevItem: any) {
    return this.defaultRemove(parent, node, prevSibling, prevItem);
  }
  // TODO: 默认改成 prevItem
  defaultRemove(parent: any, node: any, prevSibling: any, prevItem: any) {
    if (parent.children) {
      parent.children.splice(parent.children.indexOf(node), 1);
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

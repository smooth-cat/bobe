import { isNum, Queue } from '../../shared/util';

export enum TokenType {
  NewLine = 0b0000_0000_0000_0000_0000_0000_0000_0001,
  Indent = 0b0000_0000_0000_0000_0000_0000_0000_0010,
  Dedent = 0b0000_0000_0000_0000_0000_0000_0000_0100,
  Identifier = 0b0000_0000_0000_0000_0000_0000_0000_1000,
  Assign = 0b0000_0000_0000_0000_0000_0000_0001_0000,
  Pipe = 0b0000_0000_0000_0000_0000_0000_0010_0000,
  Eof = 0b0000_0000_0000_0000_0000_0000_0100_0000
}

export enum LogicType {
  If = 0b0000_0000_0000_0000_0000_0000_0000_0001,
  ElseIf = 0b0000_0000_0000_0000_0000_0000_0000_0010,
  Else = 0b0000_0000_0000_0000_0000_0000_0000_0100,
  For = 0b0000_0000_0000_0000_0000_0000_0000_1000
}

export type BaseType = string | number | boolean | undefined | null;

export type Token = {
  type: TokenType;
  typeName: string;
  value: BaseType;
};

export type HookProps = {
  /** 通过哪个 HookId 进入的 */
  HookId: string;
  /**  第几个 hook */
  i: number;
  /** 父节点 */
  parentNode?: any;
};
export type Hook = (props: HookProps) => any;

export class Compiler {
  /** 当前字符 index */
  i = 0;
  /** 当前 token */
  token!: Token;
  /** 缩进大小 默认 2 */
  TabSize = 2;
  /** 缩进字符 */
  Tab = Array.from({ length: this.TabSize }, () => ' ').join('');
  /** 匹配标识符 */
  IdExp = /[\d\w\/]/;
  /** Eof 标识符的值 */
  EofId = `__EOF__${Date.now()}`;
  /** 记录历史缩进的长度，相对于行首 */
  dentStack: number[] = [0];
  /** 回车后需要判断缩进 */
  needIndent = false;
  /** 用于跳过第一个节点前的空白字符串，以及生成基础缩进 */
  isFirstToken = true;
  /** 模板字符串动态节点的占位符 */
  HookId = '_h_o_o_k_';
  /** 用于渲染的数据 */
  data: Record<any, any> = {};
  /** 模板字符串动态节点索引 */
  hookI = 0;
  /** 代码 */
  public code: string;
  /**
   * 有些标识符能产生多个 token
   * 例如 dedent
   * parent1
   *   child
   *     subChild
   * parent2 <- 产生两个 dedent
   */
  waitingTokens = new Queue<Token>();
  get char() {
    return this.code[this.i];
  }
  get prev() {
    return this.code[this.i - 1];
  }
  get after() {
    return this.code[this.i + 1];
  }

  at(i: number) {
    return this.code[i];
  }

  next() {
    const prev = this.code[this.i];
    this.i++;
    const curr = this.code[this.i];
    return [prev, curr] as [prev: string, curr: string];
  }

  isEof = () => {
    // 刚开始时 token 不存在
    if (!this.token) return false;
    return this.token.type & TokenType.Identifier && this.token.value === this.EofId;
  };
  setToken = (type: TokenType, value: BaseType) => {
    this.token = {
      type,
      typeName: TokenType[type],
      value
    };
    this.isFirstToken = false;
  };

  testId = (value: string) => {
    if (typeof value !== 'string') return false;
    return this.IdExp.test(value);
  };

  nextToken() {
    // 已遍历到文件结尾
    if (this.isEof()) {
      return this.token;
    }

    this.token = undefined as any;
    if (this.waitingTokens.len) {
      const item = this.waitingTokens.shift()!;
      this.setToken(item.type, item.value);
      return this.token;
    }

    outer: while (1) {
      if (this.needIndent) {
        const indentHasLen = this.tokenCreator.dent();
        // 遍历到当前标识符非 空白为止
      } else {
        let { char } = this;
        switch (char) {
          case '\t':
          case ' ':
            // skip, 缩进通过 \n 匹配来激活 needIndent
            break;
          // 找后续所有 newLine
          case '\n':
            this.tokenCreator.newLine();
            // 回车后需要判断缩进
            this.needIndent = true;
            break;
          case '=':
            this.tokenCreator.assignment();
            break;
          case '|':
            this.tokenCreator.pipe();
            break;
          case "'":
          case '"':
            this.tokenCreator.str(char);
            break;
          case '$':
            const handled = this.tokenCreator.dynamic(char);
            if (handled) break;
          default:
            if (isNum(char)) {
              this.tokenCreator.number(char);
              break;
            }

            if (this.testId(char)) {
              this.tokenCreator.identifier(char);
            }
            break;
        }
        // 指向下一个字符
        this.next();
      }

      // 找到 token 即可停止
      if (this.token) {
        break;
      }
    }
    return this.token;
  }

  private consume() {
    const token = this.token;
    this.nextToken();
    return token;
  }

  tokenize() {
    do {
      this.nextToken();
      console.log('token:', TokenType[this.token?.type], JSON.stringify(this.token?.value || ''));
    } while (!this.isEof());
  }

  tokenCreator = {
    assignment: () => {
      this.setToken(TokenType.Assign, '=');
    },
    pipe: () => {
      this.setToken(TokenType.Pipe, '|');
    },
    dynamic: (char: string) => {
      let nextC = this.after;
      // 不是动态插值
      if (nextC !== '{') {
        return false;
      }
      this.next();
      let value = '${';
      let innerBrace = 0;
      while (1) {
        nextC = this.after;
        value += nextC;
        // 下一个属于本标识符再前进
        this.next();
        if (nextC === '{') {
          innerBrace++;
        }

        if (nextC === '}') {
          // 内部无左括号，说明完成匹配 TODO: 考虑js注释中的括号可能导致匹配错误
          if (!innerBrace) {
            break;
          }
          innerBrace--;
        }
      }
      this.setToken(TokenType.Identifier, value);
      return true;
    },
    newLine: () => {
      let value = '\n';
      let nextC;
      while (1) {
        nextC = this.after;
        if (nextC !== '\n') {
          break;
        }
        value += nextC;
        // 下一个属于本标识符再前进
        this.next();
      }
      // Program 希望第一个 token 一定是 node 节点
      if (this.isFirstToken) {
        return;
      }
      this.setToken(TokenType.NewLine, value);
    },
    dent: () => {
      const handleDent = (v: string) => {
        switch (v) {
          case '\t':
            return this.Tab;
          case ' ':
            return ' ';
          case '\n':
            return '\n';
          default:
            return '';
        }
      };
      let value = '';
      let nextC;
      // 构建缩进字符串
      while (1) {
        const nextChar = this.char;
        nextC = handleDent(nextChar);
        // \n 空白 \n 的情况，这行不算
        if (nextC === '\n') {
          this.needIndent = true;
          // 这种情况下需要 next ，即后续从 \n 重新开始匹配
          return true;
        }
        if (!nextC) {
          break;
        }
        value += nextC;
        this.next();
      }
      // 比较长度，比上个 indent 长，缩进，比上个 indent 短，dedent
      this.needIndent = false;
      // 期望 firstToken 是 node，所以这里只要修改第一个节点的基础偏移值即可
      if (this.isFirstToken) {
        this.dentStack[0] = value.length;
        return;
      }
      let currLen = value.length;
      const indentHasLen = currLen > 0;
      const prevLen = this.dentStack[this.dentStack.length - 1];
      if (currLen > prevLen) {
        this.dentStack.push(currLen);
        this.setToken(TokenType.Indent, String(currLen));
        return indentHasLen;
      }
      if (currLen < prevLen) {
        // 一直找到最小
        for (let i = this.dentStack.length - 2; i >= 0; i--) {
          const expLen = this.dentStack[i];
          const prevExpLen = this.dentStack[i + 1];
          // 夹在两者说明缩进大小有问题
          if (currLen > expLen && currLen < prevExpLen) {
            throw SyntaxError('缩进大小不统一');
          }
          // current <= expLen 反缩进
          this.dentStack.pop();
          if (!this.token) {
            this.setToken(TokenType.Dedent, String(expLen));
          }
          // 多余的 dent 缓存在 waitingTokens
          else {
            this.waitingTokens.push({
              type: TokenType.Dedent,
              typeName: TokenType[TokenType.Dedent],
              value: String(expLen)
            });
          }
          if (currLen === expLen) {
            break;
          }
        }
        return indentHasLen;
      }
      // 同级则无视
      return indentHasLen;
    },
    identifier: (char: string) => {
      let value = char;
      let nextC;
      while (1) {
        nextC = this.after;
        if (!this.testId(nextC)) {
          break;
        }
        value += nextC;
        this.next();
      }
      let realValue =
        value === 'null'
          ? null
          : value === 'undefined'
            ? undefined
            : value === 'false'
              ? false
              : value === 'true'
                ? true
                : value;
      this.setToken(TokenType.Identifier, realValue);
    },
    str: (char: string) => {
      let value = '"';
      let nextC;
      let continuousBackslashCount = 0;
      while (1) {
        nextC = this.after;
        value += nextC;
        const memoCount = continuousBackslashCount;
        if (nextC === '\\') {
          continuousBackslashCount++;
        } else {
          continuousBackslashCount = 0;
        }
        this.next();
        /**
         * 引号前 \ 为双数时，全都是字符 \
         *  */
        if (nextC === char && memoCount % 2 === 0) {
          break;
        }
      }
      this.setToken(TokenType.Identifier, JSON.parse(value.slice(0, -1) + '"'));
    },
    number: (char: string) => {
      let value = char;
      let nextC;
      while (1) {
        nextC = this.after;
        if (!isNum(nextC)) {
          break;
        }
        value += nextC;
        this.next();
      }
      this.setToken(TokenType.Identifier, Number(value));
    },
    eof: () => {
      this.setToken(TokenType.Eof, 'End Of File');
    }
  };

  constructor() {}

  preprocess() {
    // 保证开头能通过 换行进行 indent 计算
    this.code = '\n' + this.code;
    // 保证结尾 dedent 能正常配对
    this.code = this.code.trimEnd() + `\n${this.EofId}`;
    // console.log(this.code);
  }

  /**
   * 根节点：
   * 是 一个节点列表
   * <program> ::= <nodeList>
   */
  program() {
    // 初始化第一个 token
    this.consume();
    const _program = this.createRoot();
    this.nodeList(_program);
    return _program;
  }

  /**
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
      if (this.isEof()) {
        return;
      }

      // 对于 childList  Dedent 表示 childList 遍历完成
      if (this.token.type & TokenType.Dedent) {
        this.consume();
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
    this.childrenBlockOpt(_declaration);
    return _declaration;
  }

  /**
   * 声明部分：
   * 包含首行定义和（可选的）多行属性扩展
   * <declaration> ::= <tagName=token> <headerLine> <extensionLines>
   *  */
  declaration() {
    const [isHook, value] = this._hook({});
    let _node: any;
    if (isHook) {
      const { tree, data } = value();
      _node = tree;
    } else if (value === 'if') {

      return this.ifDeclaration();
    } else {
      _node = this.createNode(value);
    }
    this.consume();
    this.headerLine(_node);
    this.extensionLines(_node);
    return _node;
  }

  ifDeclaration() {
    const ifIdentifier = this.consume();
    const [isHook, value] = this._hook({});
    const ifNode = {
      __logicType: LogicType.If,
      condition: value,
      child: null,
      lastChild: null,
      anchor: null
    };
    const condition = this.consume();
    console.log('if内容：');
    console.log(this.code.slice(this.i));
    const newLine = this.consume();
    return ifNode;
  }

  /**
   * <extensionLines> ::= PIPE <attributeList> NEWLINE <extensionLines>
   *                    | ε
   */
  extensionLines(_node: any) {
    while (1) {
      //  终止条件，下一行不是 pipe
      if (!(this.token.type & TokenType.Pipe)) {
        return;
      }
      // 开始解析 attributeList
      const PIPE = this.consume();
      this.attributeList(_node);
      // 文件结束了，通常不会发生
      if (!(this.token.type & TokenType.NewLine)) {
        return;
      }
      // 换行
      const NEWLINE = this.consume();
    }
  }

  /**
   * 首行：
   * 节点名称 + 属性列表 + 换行
   * <headerLine> ::= <attributeList> NEWLINE
   */
  headerLine(_node: any) {
    this.attributeList(_node);
    const NEWLINE = this.consume();
  }

  /**
   * 属性列表：
   * 可以是空的，或者包含多个属性
   * <attributeList> ::= <attribute> <attributeList>
   *                    | ε
   *
   * <attribute> ::= <key> <=> <value or dataKey> <=> <value>
   *
   */
  attributeList(_node: any) {
    let values: any[] = [];
    let prevToken = undefined;
    while (1) {
      // 前者是 id ，后者不是 =，values 可以组成属性赋值
      if (prevToken?.type === TokenType.Identifier && this.token.type !== TokenType.Assign) {
        const [v1, v2, v3] = values;
        const key: any = v1;
        let dataKey, defaultVal;
        if (v3 !== undefined) {
          defaultVal = v3;
          dataKey = v2;
        }
        // v2 有值，要区分其是 dataKey，还是默认值
        else if (v2 !== undefined) {
          // 区分 p=$abc 和 p=${haha} (编译时态)
          if (typeof v2 === 'string' && v2[0] === '$' && v2[1] !== '{') {
            dataKey = v2.slice(1);
          } else {
            defaultVal = v2;
          }
        }
        // v2 没值
        else {
          dataKey = key;
        }
        let val = defaultVal;
        if (dataKey) {
          val = this.setDataProp(this.data, dataKey, defaultVal);
        }
        this.setProp(_node, key, val, this.hookI - 1);
        const [isHook, value] = this._hook({});
        values = [value];
      }
      // 先存储
      else if (this.token.type !== TokenType.Assign) {
        const [isHook, value] = this._hook({});
        values.push(value);
      }

      // 已经不是 attr 相关的字符了
      if (!(this.token.type & (TokenType.Identifier | TokenType.Assign))) {
        break;
      }
      prevToken = this.consume();
    }
  }

  /** 子节点块：
   * 必须被缩进包裹
   * <childrenBlockOpt> ::= INDENT <nodeList>
   *                        | ε  /* 空（表示叶子节点，没有孩子）
   *  */
  childrenBlockOpt(parent: any) {
    // 无 children
    if (!(this.token.type & TokenType.Indent)) {
      return [];
    }
    const INDENT = this.consume();
    const list = this.nodeList(parent);
    return list;
  }

  config(
    opt: Partial<
      Pick<Compiler, 'createRoot' | 'createNode' | 'setProp' | 'setDataProp' | 'setChildren' | 'hook' | 'HookId'>
    >
  ) {
    Object.assign(this, opt);
  }

  createData(data: Record<any, any>) {
    return data;
  }
  setDataProp(data: Record<any, any>, key: any, value: any) {
    return (data[key] = value);
  }

  setChildren(node: any, children: any[]) {
    node.children = children;
  }

  createNode(name: string) {
    return {
      name,
      props: {}
    };
  }
  createRoot() {
    return this.createNode('root');
  }

  insert(parent: any, node: any, prevSibling: any, prevItem: any) {
    return this.defaultInsert(parent, node, prevSibling, prevItem);
  }
  defaultInsert(parent: any, node: any, prevSibling: any, prevItem: any) {
    if (!parent.child) {
      return (parent.child = parent.lastChild =
        {
          value: node,
          next: null
        });
    }
    const nextItem = prevItem.next;
    const item = {
      value: node,
      next: nextItem
    };
    prevItem.next = item;
    if (!nextItem) {
      parent.lastChild = item;
    }
    return item;
  }

  remove(parent: any, node: any, prevSibling: any, prevItem: any) {
    return this.defaultRemove(parent, node, prevSibling, prevItem);
  }
  // TODO: 默认改成 prevItem
  defaultRemove(parent: any, node: any, prevSibling: any, prevItem: any) {
    const currItem = prevItem.next;
    const nextItem = currItem.next;
    if (prevItem) {
      if (nextItem) {
        prevItem.next = nextItem;
      } else {
        prevItem.next = null;
        parent.lastChild = prevItem;
      }
    } else {
      if (nextItem) {
        parent.child = nextItem;
      } else {
        parent.child = null;
        parent.lastChild = null;
      }
    }
    currItem.next = null;
  }

  setProp(node: any, key: string, value: any, hookI?: number) {
    node.props[key] = value;
  }

  init(fragments: string | string[]) {
    this.data = this.createData(this.data);
    if (typeof fragments === 'string') {
      this.code = fragments;
    } else {
      this.code = fragments.join(this.HookId);
    }
    return this.preprocess();
  }

  hook: Hook;
  _hook = (props: Partial<HookProps>): [boolean, any] => {
    const value = this.token.value;
    const isHook = value === this.HookId;
    if (this.hook && isHook) {
      const res = this.hook({
        ...props,
        HookId: this.HookId,
        i: this.hookI
      });
      this.hookI++;
      return [isHook, res];
    }
    return [isHook, value];
  };
}

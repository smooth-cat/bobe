import { Store } from 'aoye';
import type { Tokenizer } from './tokenizer';
import type { Interpreter } from './terp';

export enum TokenType {
  NewLine = 0b0000_0000_0000_0000_0000_0000_0000_0001,
  Indent = 0b0000_0000_0000_0000_0000_0000_0000_0010,
  Dedent = 0b0000_0000_0000_0000_0000_0000_0000_0100,
  Identifier = 0b0000_0000_0000_0000_0000_0000_0000_1000,
  Assign = 0b0000_0000_0000_0000_0000_0000_0001_0000,
  Pipe = 0b0000_0000_0000_0000_0000_0000_0010_0000,
  Eof = 0b0000_0000_0000_0000_0000_0000_0100_0000,
  InsertionExp = 0b0000_0000_0000_0000_0000_0000_1000_0000
}

export enum LogicType {
  If = 0b0000_0000_0000_0000_0000_0000_0000_0001,
  ElseIf = 0b0000_0000_0000_0000_0000_0000_0000_0010,
  Else = 0b0000_0000_0000_0000_0000_0000_0000_0100,
  For = 0b0000_0000_0000_0000_0000_0000_0000_1000,
  Component = 0b0000_0000_0000_0000_0000_0000_0001_0000,
  Fragment = 0b0000_0000_0000_0000_0000_0000_0010_0000,
  Root = 0b0000_0000_0000_0000_0000_0000_0100_0000
}

export enum TerpEvt {
  AllAttrGot = 'all-attr-got',
  HandledComponentNode = 'handled-component-node'
}

export type BaseType = string | number | boolean | undefined | null;

export const InsComputed = Symbol('insertion-computed-map-key');

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

export type TerpConf = Partial<
  Pick<Interpreter, 'createNode' | 'setProp' | 'nextSib' | 'createAnchor' | 'insertAfter' | 'hook' | 'HookId' | 'data'>
>;
export type CustomRenderConf = Pick<TerpConf, 'createNode' | 'setProp' | 'nextSib' | 'createAnchor' | 'insertAfter'>;

export type Hook = (props: HookProps) => any;

export type HookType = 'dynamic' | 'static';

export type ProgramCtx = { stack: StackItem[]; prevSibling: any };

/** 返回值是用户自定义的节点 */
export type BobeUI = (
  this: Store,
  options: CustomRenderConf,
  valOpt: TerpConf,
  root: any,
  after?: any
) => ComponentNode;

export type StackItem = {
  /** 插入到 prev 后 */
  prev: any;
  /** 当前节点*/
  node: any;
};

export type IfNode = LogicNode & {
  condition: () => any;
  anchor: any;
  isFirstRender: boolean;
  snapshot: ReturnType<Tokenizer['snapshot']>;
  watcher: { stop: () => void };
};

export type LogicNode = {
  __logicType: LogicType;
  realParent: any;
  realBefore?: any;
  realAfter?: any;
  lastInserted?: any;
};

export type FragmentNode = LogicNode & {};
export type ComponentNode = LogicNode & {
  store: Store;
};
export type RootNode = LogicNode & {
  store: Store;
};

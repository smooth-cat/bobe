import { Terp } from './index';
import { Store } from 'aoye';
import { Tokenizer } from './tokenizer';
import { BobeUI, CustomRenderConf } from './type';
type UpdateItem = {
  fn: (value: any) => any;
  old: any;
};

export function bobe(fragments: TemplateStringsArray, ...values: any[]) {
  const ui: BobeUI = function ui(options, valueOpt) {
    const tokenizer = new Tokenizer();
    const cmp = new Terp(tokenizer);
    Object.assign(cmp, valueOpt);
    // 初始化
    cmp.config({
      ...options,
      hook({ i }) {
        return values[i];
      },
      setProp(node: any, key: string, value: any, hookI?: number) {
        node.props[key] = value;
      }
    });
    cmp.init(Array.from(fragments));
    const root = cmp.program();
    return root;
  };
  return ui;
}

// render -> options
export function customRender(option: CustomRenderConf) {
  // 保存 options
  return function render<T>(Ctor: typeof Store) {
    const store = Ctor.new();
    // ui => bobe`` 返回的函数
    return [store['ui'](option, { data: store }), store];
  };
}
const render = customRender({});
class App extends Store {
  count = 10;
  updateCount = () => {
    this.count++;
  }
  ui = bobe`
    node1 k1={count}
      node1_1 k2=2 k3=3
        node1_1_1 k6=6
    node2
    | p1=1
    | p2=2 p3=3
      node2_1
      | p4=4 p5=5 p6=6
      node2_2
      | p7=7
    ${B} v=10
  `;
}
class B extends Store {
  readonly v = 1;
  name = '😁'
  updateName = () => {
    this.name = '🤡';
  }
  ui = bobe`
    bbb hello={v}
    nb name={name}
  `;
}

const [root, store] = render(App);
console.log(JSON.stringify(root, null, 2));
store.updateCount();
console.log('------------------------------------------------------');

console.log(JSON.stringify(root, null, 2));

function childToArray(node) {
  const newNode: any = {};
  const children = [];
  let point = node.child;

  while (point) {
    const item = childToArray(point.value);
    children.push(item);
    point = point.next;
  }

  for (const key in node) {
    if (key === 'child' || key === 'lastChild' || key === 'next') {
      continue;
    }
    newNode[key] = node[key];
  }
  newNode.children = children;
  return newNode;
}

import { Interpreter } from './index';
import { $, Scheduler } from 'aoye';
import { Tokenizer } from './tokenizer';
type UpdateItem = {
  fn: (value: any) => any;
  old: any;
};

export function bobe(fragments: TemplateStringsArray, ...values: any[]) {
  const tokenizer = new Tokenizer();
  const cmp = new Interpreter(tokenizer);

  // 初始化
  cmp.config({
    hook({ i }) {
      return values[i];
    },
    setDataProp(data, key, value) {
      return (data[key] = $(value));
    },
    setProp(node: any, key: string, value: any, hookI?: number) {
      // TODO: signal 提供一个判断是 signal getter 的方式
      if (value instanceof Function) {
        $(
          () => {
            node.props[key] = value();
          }
          // { scheduler: Scheduler.Micro }
        )();
      } else {
        node.props[key] = value;
      }
    }
  });
  cmp.init(Array.from(fragments));
  const ast = cmp.program();
  console.log(JSON.stringify(childToArray(ast), undefined, 2));
  return { ast, data: cmp.data };
}

const { ast, data } = bobe`
  node1 k1=1
    node1_1 k2=false k3=$a=10
      node1_1_1 k6=null
  node2
  | p1=$b='嘿嘿'
  | p2=2 p3='你好'
    node2_1
    | p4=4 p5=${{ v: '🤡' }} p6=6
    node2_2
    | p7=7 p8=\${{ v: '🤡' }} p9=aaa
  node3 v1=1  v2=2 v3=undefined
  if ${() => false}
    node4 greet='成功'
`;
data.a.v = 20;
data.b.v = '哈哈';
Promise.resolve().then(() => {
  console.log(JSON.stringify(childToArray(ast), undefined, 2));
});

// function replace(key: any, value: any) {
//   if (key === 'child') {
//     const list = [];
//     let point = value;
//     while (point) {
//       list.push(point.value);
//       point = point.next;
//     }
//     return list;
//   }
//   if (key === 'lastChild') {
//     return undefined;
//   }
//   return value;
// }

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

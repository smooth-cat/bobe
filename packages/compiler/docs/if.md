## if 节点

首屏

begin

1. 如果条件是 true ，
   1. `ifDeclaration`
   2. `node` 直接解析
   3. 子节点的 `nodeList` 记录直接子节点到 if 节点
   4. 父节点的  `nodeList`   消费 if 节点中所有节点，添加到其名下
2. 如果条件是 false，
   1. `ifDeclaration`
   2. `node` 不解析 通过 skip 跳过 if 的 tokens
   3. `nodeList` 
3. 公共逻辑
   1. `ifDeclaration` 初始化 if 节点的 `Interpreter`
   2. `node` 解析前  snapshot 保存当前 token 位置

重新渲染

1. true -> false 递归删除 if 下的子节点
2. false -> true 基于 fragments 或 tokens + values 重新渲染



如果子 if 被父 if 删除了，那么父 if 要重新解析来生成了
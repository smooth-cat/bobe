## if 节点

首屏

begin

1. 如果条件是 true ，
   1. 直接解析，
   2. 并记录 tokens 和 values 到子 compiler，
   3. 记录直接子节点到 if 节点
2. 如果条件是 false，截取 fragments 和 values，初始化 compiler

重新渲染

1. true -> false 递归删除 if 下的子节点
2. false -> true 基于 fragments 或 tokens + values 重新渲染



如果子 if 被父 if 删除了，那么父 if 要重新解析来生成了
## Set 数组原地 增删移（sort因为有回调因此不包含，靠 set 触发）

只触发 iterator 更新

- pop 
- push 
- shift 
- splice
- unshift 
- copyWithin
- reverse 
- fill 

## Get 增删并产生新数组的方法

追加 iterator 收集、确保返回项是代理类型

- concat
- filter
- slice
- toReversed
- toSorted
- toSpliced
- with 将其中一项改为目标值并返回新数组

## Get 根据值查询

追加 iterator 收集、分别用原始值 和 代理值都查询一遍

- includes
- indexOf
- lastIndexOf

## 无需代理的方法

- at
- flat （内部 proxy 化不太好处理），否则可以归类到
- flatMap
- sort  原地操作，由于有回调，不好归类到 只触发 iterator 范围

## Get 额外追加 Iterator 收集的方法

### 迭代器相关

- Symbol.iterator
- entries
- keys
- values

### 循环与遍历相关

- every
- find
- findIndex
- findLast
- findLastIndex
- forEach
- map
- reduce
- reduceRight
- some

### 转换与副本相关

- join
- toString
- toLocaleString
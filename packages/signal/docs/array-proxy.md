## Set  增删移（sort因为有回调因此不包含，靠 set 触发）✅

只触发 iterator 更新

- pop 
- push 
- shift 
- splice
- unshift 
- copyWithin
- reverse 
- fill 

## Get 全等匹配 ✅

仅收集 __Iterator, 分别用原始值 和 代理值都查询一遍

- includes
- indexOf
- lastIndexOf

## Get 迭代器 ✅

仅收集 __Iterator，将其中的值转为 proxy 类型

- Symbol.iterator
- entries
- values

## Get 需重写 增删并产生新数组的方法 ✅

仅 iterator 收集、确保返回项是代理类型

- filter ✅
- slice ✅
- toReversed  ✅
- toSpliced  ✅ 
- with 将其中一项改为目标值并返回新数组 ✅
- concat ✅

## Get 具有回调函数的 ✅

仅 iterator 收集、

### 回调参数需要转换，函数！！ 返回值需要转换 ✅

- every
- find         结果需要转换
- findLast  结果需要转换
- findIndex
- findLastIndex
- forEach
- map
- some
- reduce           第二个参数需要转换
- reduceRight   第二个参数需要转换

### 回调参数需要转换，回调！！ 返回值需要转换 ✅

- toSorted

## Get 仅收集 ✅

- join
- toString
- toLocaleString

## TODO 

- flat 内部 proxy 化不太好处理），否则可以归类到
- flatMap
- sort  原地操作，由于有回调，不好归类到 只触发 iterator 范围

## 无需代理的方法

- at
- keys 和 length 对等

## 
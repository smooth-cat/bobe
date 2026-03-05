data、props 声明和使用

```ts
class DebounceStore extends Store<> {
  raw: T;
  value: T;
}

const a = 10;

class Component extends Store {
  a = 10;
  debounced = DebounceStore.new({ raw: 'a' })
  
  ui = bobe`
  	div textContent={a}
  	div textContent={'debounced:' + debounced}
  `
}

const a = '123'
// abc
new DebounceStore()

function bobe(fragments: TemplateStringsArray, ...values: any[]) {
  return function(option) {
    const that = this;
    // 解析 fragments，values
    // 碰到
    const tokenizer = new Tokenizer();
  	const itp = new Terp(tokenizer);

    itp.config(option);
    itp.init();
    const treeList = itp.program();
    
    return treeList;
    // 碰到 prop={ 生成 如下函数
		const fn = new Function('that', `with(that){${ userCode }}`);
  }
}
// render -> options
function customRender(option) {
  // 保存 options
	function render(Ctor: new () => Store) {
		const ins = Ctor.new();
    const treeList = ins.ui(option);
	}
}


```

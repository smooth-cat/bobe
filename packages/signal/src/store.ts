import { G } from './global';
import { deepSignal, shareSignal } from './deep-signal';
import { DeepOmitPath, DeepPath, IsStore, Keys, MatchValue, PRecord, StoreIgnoreKeys } from './type';
import { effect } from '.';

export class Store {
  static [IsStore] = true;
  static [StoreIgnoreKeys] = ['ui', 'raw'];
  static Current: Store = null;
  constructor() {
    const proxy = deepSignal(this, G.PullingSignal, true);
    Store.Current = proxy;
    return proxy;
  }

  static new<T extends Store = any, P extends Store = any, O extends string = ''>(
    this: new (...args: any[]) => T,
    keyMap: PRecord<keyof T, keyof Omit<P, O> | DeepOmitPath<P, O>> = {}
  ): T {
    const parentStore = Store.Current;
    const child = new (this as any)();
    if (parentStore) {
      for (const childKey in keyMap) {
        const parentKey: string = keyMap[childKey] as any;
        shareSignal(parentStore, parentKey, child, childKey);
      }
    }
    Store.Current = parentStore;
    return child;
  }

  set(fn: () => Partial<this>) {
    effect(() => {
      const props = fn();
      Object.assign(this, props);
    });
  }
}

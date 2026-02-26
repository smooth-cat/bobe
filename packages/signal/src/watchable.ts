import { Scheduler } from './schedule';
import { runWithPulling } from './scope';
import { Signal } from './signal';
import { Keys } from './type';

const proxyMap = new WeakMap();

export const deepSignal = <T>(target: T, deep = true) => {
  const isObj = typeof target === 'object' && target !== null;
  // 1. 不是对象则返回原始值
  if (!isObj) return target;
  // 2. 返回已有代理
  if (proxyMap.has(target)) return proxyMap.get(target);

  // 每个对象维护自己的 cells 闭包
  const cells = new Map<any, Signal>();

  const proxy = new Proxy(target, {
    get(obj, prop, receiver) {
      if (prop === Keys.Raw) {
        return target;
      }

      // 已有对应 Signal
      if (cells.has(prop)) {
        return cells.get(prop).v;
      }

      // 创建 Signal
      const value = Reflect.get(obj, prop, receiver);
      const wrappedValue = deep ? deepSignal(value) : value;
      const s = Signal.create(wrappedValue, {
        scheduler: Scheduler.Sync,
        isScope: false
      });
      cells.set(prop, s);
      return s.v;
    },

    set(obj, prop, value, receiver) {
      // 已有对应 Signal，更新 signal 值
      if (cells.has(prop)) {
        const cell = cells.get(prop);
        cell.v = deep ? deepSignal(value) : value;
      }
      return Reflect.set(obj, prop, value, receiver);
    },

    // 【核心修改】拦截 delete 操作
    deleteProperty(obj, prop) {
      if (cells.has(prop)) {
        // 2. 从 Map 中移除，切断引用，允许 GC 回收这个 $() 实例
        cells.delete(prop);
      }
      return Reflect.deleteProperty(obj, prop);
    }
  });

  proxyMap.set(target, proxy);
  return proxy;
};

const arrayGetterReWrites: any = {};

/*----------------- 原地操作方法除了 sort 仅触发 Iterator -----------------*/
['pop', 'push', 'shift', 'unshift', 'splice', 'reverse', 'fill', 'copyWithin'].forEach(key => {
  arrayGetterReWrites[key] = function (...args: any[]) {
    const raw = Array.prototype[key];
    runWithPulling(() => {
      raw.call(this, ...args);
    }, null);
    this[Keys.Iterator] = this[Keys.Raw][Keys.Iterator] + 1;
  };
});

/*----------------- 额外增加 __Iterator 的方法 -----------------*/
[
  'forEach',
  'every',
  'some',
  'map',
  'filter',
  'reduce',
  'reduceRight',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex'
].forEach(key => {
  arrayGetterReWrites[key] = function (...args: any[]) {
    const raw = Array.prototype[key];
    runWithPulling(() => {
      raw.call(this, ...args);
    }, null);
    this.__Iterator;
  };
});

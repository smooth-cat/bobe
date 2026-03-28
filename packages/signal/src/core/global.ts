import { SignalNode } from './type';

let _execId = 0;
let currentExecId = 0;

export const execIdInc = () => ++_execId;
/** effect、computed 回调执行的唯一 id
 * 用于判断重复依赖属于同一 effect、effect、computed
 */
export const execId = () => currentExecId;
export const setExecId = (v: number) => (currentExecId = v);

let pulling: SignalNode = null;
export const setPulling = (v: SignalNode) => (pulling = v);
export const getPulling = () => pulling as any;

export function runWithPulling<T extends (...args: any[]) => any>(fn: T, scope: any): ReturnType<T> {
  const oldPulling = pulling;
  pulling = scope;
  const ret = fn();
  pulling = oldPulling;
  return ret;
}

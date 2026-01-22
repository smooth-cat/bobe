import { $ } from '../index';
import { CallOrder } from '../../../shared/__test__/call-order';
import { DepStr } from './dep-str';

describe('特殊情况', () => {
  it('菱形依赖, 依赖链重建', () => {
    const order = new CallOrder();

    const s0 = $(0);
    const s1 = $(1);
    const s2 = $(2);

    const s3 = $(() => {
      if (!s0.v) {
        order.call('s3执行, s0不存在,获取s1');
        return s1.v;
      }
      order.call('s3执行, s0不存,返回S2');
      return s2.v;
    });

    const s4 = $(() => {
      order.call('s4执行');
      return s0.v + 4;
    });

    const s5 = $(() => {
      order.call('s5执行');
      return s3.v + s4.v;
    });

    const s6 = $(() => {
      order.call('s6执行');
      return s5.v;
    });

    const depStr = new DepStr({
      s0,
      s1,
      s2,
      s3,
      s4,
      s5,
      s6
    });

    s6();
    order.toBe('s6执行', 's5执行', 's3执行, s0不存在,获取s1', 's4执行');
    depStr.dep(`
      s0 -> s3 -> s5 -> s6
      s1 -> s3
      s0 -> s4 -> s5
      `);
    // s0(1);
    // order.toBe('s3执行, s0不存,返回S2', 's4执行', 's5执行', 's6执行');
    // expect(s6.v).toBe(7);

    // depStr.dep(`
    //   s0 -> s3 -> s5 -> s6
    //   s2 -> s3
    //   s0 -> s4 -> s5
    //   `);
  });
});

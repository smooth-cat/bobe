import { macInc } from '#/util';

describe('maxInc', () => {
  it('基础测试', () => {
    const inc = macInc([1, 2, 7, 8, 3, 4, 5]);
    expect(inc).toEqual([0,1,4,5,6]);
  });

  it('纯递增', () => {
    const inc = macInc([0, 1, 2, 3, 4]);
    expect(inc).toEqual([0, 1, 2, 3, 4]);
  });

  it('空数组', () => {
    const inc = macInc([]);
    expect(inc).toEqual([]);
  });

  it('一个元素的数组', () => {
    const inc = macInc([0]);
    expect(inc).toEqual([0]);
  });

  it('包含-1的数组', () => {
    const inc = macInc([-1, 0, 1, 2, 3]);
    expect(inc).toEqual([1, 2, 3, 4]);
  });

  it('倒序数组', () => {
    const inc = macInc([5, 4, 3, 2, 1]);
    // 因为 1  是最小的，所以是 4(索引)
    expect(inc).toEqual([4]);
  });
});

export const base = {
  preset: 'ts-jest',
  testMatch: ['<rootDir>/src/__test__/*.+(ts|tsx|js)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  watchPathIgnorePatterns: ['<rootDir>/test/', '<rootDir>/test copy/'],
  moduleNameMapper: {
    // 这里的 ^ 代表开头，$1 代表匹配到的 (.*) 部分
    '^#/(.*)$': '<rootDir>/src/$1',
    '^#test/(.*)$': '../../../../test-shared/$1'
  }
};
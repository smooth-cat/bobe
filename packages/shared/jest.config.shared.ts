export const base = {
  preset: 'ts-jest',
  testMatch: ['<rootDir>/src/__test__/*.+(ts|tsx|js)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  watchPathIgnorePatterns: ['<rootDir>/test/', '<rootDir>/test copy/']
};
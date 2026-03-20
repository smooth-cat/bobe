// /scripts/rollup.config.base.mjs
import esbuild from 'rollup-plugin-esbuild';
import dts from 'rollup-plugin-dts';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import path from 'path';
import alias from '@rollup/plugin-alias';
import babel from '@rollup/plugin-babel';

const bigCamel = name =>
  name
    .split('-')
    .map(it => it[0].toUpperCase() + it.slice(1))
    .join('');

export function createConfig(pkg, dir) {
  // 提取 external，确保不打包依赖
  const external = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})];
  const umdGlobals = external.reduce((obj, pkgName) => {
    const globalName = bigCamel(pkgName);
    return { ...obj, [pkgName]: globalName };
  }, {});

  return [
    // 1. 代码构建
    {
      input: 'src/index.ts',
      output: [
        { file: pkg.main, format: 'cjs', sourcemap: true },
        { file: pkg.module, format: 'esm', sourcemap: true },
        {
          file: 'dist/index.umd.js',
          format: 'umd',
          name: bigCamel(pkg.name), // 自动处理包名为变量名
          sourcemap: true,
          globals: umdGlobals
        }
      ],
      plugins: [
        alias({
          entries: [{ find: '#', replacement: path.resolve(dir, './src') }]
        }),
        nodeResolve(),
        commonjs(),
        esbuild({
          target: 'esnext',
          tsconfig: path.resolve(dir, 'tsconfig.json'),
          minify: process.env.NODE_ENV === 'production'
        }),
        babel({
          babelHelpers: 'bundled',
          babelrc: false, // 禁用外部文件，防止干扰
          configFile: false, // 禁用外部文件
          extensions: ['.js', '.jsx', '.es6', '.es', '.mjs', '.ts', '.tsx'],
          plugins: ['@babel/plugin-transform-destructuring']
        })
      ],
      external
    },
    // 2. 类型构建
    {
      input: 'src/index.ts',
      output: { file: pkg.types || 'dist/index.d.ts', format: 'es' },
      plugins: [alias(), dts()],
      external
    }
  ];
}

import babel            from '@rollup/plugin-babel';
import { nodeResolve }  from '@rollup/plugin-node-resolve';
import copy             from 'rollup-plugin-copy-assets';
//import typescript       from '@rollup/plugin-typescript';
//import compiler         from '@ampproject/rollup-plugin-closure-compiler';

const config = {
  input: 'src/index.js',
  external: [],
  output: {
    file: 'lib/index.js',
    format: 'umd',
    name: 'fastify_dsl',
    sourcemap: false
  },

  plugins: [
    nodeResolve(),
    //typescript(),
    babel({
      presets: [
        ['@babel/preset-env',
        {
          targets: {
            esmodules: true,
          },
        }]
      ],
      exclude: '**/node_modules/**',
      babelHelpers: 'bundled',
    }),
    copy({
      assets: [
        'src/assets',
        'src/templates',
        'src/commands.js'
      ]
    }),
    //compiler()
  ]
};

export default config;
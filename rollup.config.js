import copy from 'rollup-plugin-copy'

export default {
  input: {
    index: 'src/index.js',
    worker: 'src/worker.js'
  },
  output: {
    dir: 'build',
    format: 'cjs'
  }
}
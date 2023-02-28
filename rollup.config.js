export default {
  input: require('path').join(__dirname, 'index.js'),
  output: {
    file: 'build/index.js',
    format: 'cjs'
  }
}
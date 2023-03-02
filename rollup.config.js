module.exports = {
  input: require('path').join(__dirname, 'src/index.js'),
  output: {
    file: 'build/index.js',
    format: 'cjs'
  }
}
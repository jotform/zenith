module.exports = {
  "ignore": [
    "node_modules",
    ".gitignore",
    "build",
    "lib",
    "dist",
    "webpack.sock",
    ".DS_Store",
    "test-results",
    "playwright/.cache"
  ],
  "buildConfig": {
    "cachePath": ".customCache",
    "appConfig": {
      "build": {
        "script": "build",
        "input": "",
        "outputs": [
          "build"
        ]
      }
    }
  },
  "projects": {
    "@jotforminc/zenith": "."
  }
}
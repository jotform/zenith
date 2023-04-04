# Zenith: New way of JS monorepo builds <!-- omit in toc -->
## Table of contents <!-- omit in toc -->
- [What is Zenith? What is its aim?](#what-is-zenith-what-is-its-aim)
- [Installation](#installation)
- [zenith.json: What is it, and why it is required?](#zenithjson-what-is-it-and-why-it-is-required)
- [Required Parameters](#required-parameters)
  - [Environment Variables](#environment-variables)
  - [Params](#params)
- [Optional Parameters](#optional-parameters)
- [Debugging](#debugging)

## What is Zenith? What is its aim?

Zenith is a fast build tool used for both remote and local caching. Its speed comes from the ability to cache files remotely, which makes zenith a good choice when developing monorepos with teams. It provides build cache and test cache functionalities, which can be used to deploy a large application much quicker than its competitors.

## Installation
```
npm i @jotforminc/zenith
yarn add @jotforminc/zenith
pnpm add @jotforminc/zenith
```

From the terminal, run:

```
pnpm/yarn/npm zenith --target=("build" | "test") --project=("all" | <project_name>)
```
Target and project arguments are required for now. Without them the tool will not work.
## zenith.json: What is it, and why it is required?
Zenith looks for a file named "zenith.json" in the same folder where your root package.json file is in. This file is used to determine the behavior of zenith. It MUST include 'projects' and 'buildConfig' keys, and MAY include 'ignore' and 'appDirectories' keys. An example of usage is as follows.
```
//zenith.json
{
  "projects": {
    "@jotforminc/<app1>":"projects/applications/<app1>",
    "@jotforminc/<app2>":"projects/applications/<app2>",
    "@jotforminc/<lib1>":"projects/libraries/<lib1>"
  },
  "buildConfig": {
    "cachePath": ".customCache",
    "appConfig": {
      "build": {
        "script": "build",
        "outputs": ["build"]
      },
      "lint:js": {
        "script": "lint:js",
        "outputs": ["stdout"],
        "constantDependencies": ["@jotforminc/lib1"]
      }
    },
    "mainConfig": {
      "build": {
        "script": "build",
        "outputs": ["build"]
      },
      "lint:js": {
        "script": "lint:js",
        "outputs": ["stdout"],
        "constantDependencies": ["@jotforminc/lib1", "@jotforminc/lib2"]
      }
    },
  },
  "ignore": [
    "node_modules",
    ".gitignore",
    "build",
    "lib",
    "dist",
    ".DS_Store",
    "test-results",
  ],
  "appDirectories": ["/apps/"],
}
```
## Required Parameters
The project uses several required environment variables and params. Without them, the tool will not work as intended.
### Environment Variables
```
- USE_REMOTE_CACHE (bool): If true, remote cache is used. Local cache feature is unstable for now, so this variable should be set to true.
- S3_ACCESS_KEY (string): Access key to be used to get object from and write objects to the buckets.
- S3_SECRET_KEY (string): Secret key to be used to get object from and write objects to the buckets.
- S3_BUCKET_NAME (string): Bucket name to be written and read from.
- S3_REGION (string): AWS S3 region to connect to.
```
### Params
```
-t, --target <"build" | "test">: Target command to be used.
-p, --project <"all" | [string]>: Project to be built. "all" value builds every project the tool finds in the subfolders.
```

## Optional Parameters
Below parameters are not required to work, but can be used to modify the tool's behavior.
```
-h, --help: Show parameter information.
-d, --debug: If given, enters debug mode. Usage is provided in the [debugging](#debugging) section.

-c, --compareWith <string>: Compares and calculates the difference between a given json file and the current build.

-dl, --debugLocation <string>: Debug Location: sets the prefix of the debug location. By default, it is "debug/", and it's usage is as follows: \n {target}/{debugLocation}debug.{hash}.json

-w, --worker <number>: Worker Number (default = 6): sets the maximum number of workers that run concurrently.

-l, --logLevel <1 | 2 | 3>: Sets the log level. 1=silent mode. 2=default mode, only shows errors and stats after completion. 3=verbose mode, logs cache hits, misses, recoveries.

-ch, --noCompareHash: default: false. If false, will compare remote folders\' and local folders\' hash and execute target if hashes are not the same.

-la, --logAffected: default: false. If true, will log outputs of ONLY missed caches\' executes.
```


## Debugging
If -d param is given, the tool outputs a file named "debug.{hash}.json". This file will contain hashes of every file that is used in hashing. It can be used to see if the tool is working as intended, and which folders are being hashed. By also setting -c param, you can compare builds and see which files are new, and changed or removed.

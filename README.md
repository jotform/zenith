# Zenith: New way of JS monorepo builds <!-- omit in toc -->
## Table of contents <!-- omit in toc -->
- [What is Zenith? What is its aim?](#what-is-zenith-what-is-its-aim)
- [Installation](#installation)
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
-d, --debug: If given, enters debug mode. Usage is provided in the [debugging](#debugging) section.
-c, --compareWith <string>: Compares and calculates the difference between a given json file and the current build.
-l, --logLevel <1 | 2 | 3>: Sets the log level. 1=silent mode. 2=default mode, only shows errors and stats after completion. 3=verbose mode, logs cache hits, misses, recoveries.
```


## Debugging
If -d param is given, the tool outputs which files are uploaded. It can be used to see if the tool is working as intended. By also setting -c param, you can compare builds and see which files are new, and changed or removed.

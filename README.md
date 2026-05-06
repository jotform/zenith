# Zenith: Lightning-Fast JavaScript Monorepo Build Tool <!-- omit in toc -->

**Zenith** transforms the complexity of managing JavaScript monorepos into a simple, fast, and productive experience. By smartly caching without .git reliance, Zenith slashes CI pipeline times, letting you focus solely on coding.

## Quick Start

-   **Install:** `pnpm add @jotforminc/zenith`
-   **Use:** `pnpm zenith --target=<command> --project=<name>`

## Configuration with `zenith.json`

Create a `zenith.json` in your project root including `projects` and `buildConfig` to guide Zenith's operation.

## Features

-   **Local & Remote Caching:** Deploy faster using less bandwidth.
-   **No .git Required:** Ideal for team-based monorepo development.
-   **Versatile Commands:** Supports `build`, `test`, and more.

------
#### Detailed Setup

## Table of contents <!-- omit in toc -->
- [What is Zenith? What is its aim?](#what-is-zenith-what-is-its-aim)
- [Installation](#installation)
- [zenith.json: What is it and why is it required?](#zenithjson-what-is-it-and-why-is-it-required)
- [Required Parameters](#required-parameters)
  - [Environment Variables](#environment-variables)
  - [Params](#params)
- [Optional Parameters](#optional-parameters)
- [Debugging](#debugging)


## What is Zenith? What is its aim?


Zenith is a fast build tool used for both remote and local caching. Its speed comes from the ability to cache files remotely while not using .git files, which makes Zenith a good choice when developing monorepos with teams. It provides build cache and test cache functionalities, which can be used to deploy a large application much quicker than its competitors.

Zenith requires pnpm as the node package manager.

## Installation
```
pnpm add @jotforminc/zenith
```


From the terminal, run:


```
pnpm zenith --target=("build" | "test") --project=("all" | <project_name>)
```
Target and project arguments are required for now. Without them, the tool will not work.
## zenith.json: What is it and why is it required?
Zenith looks for a file named "zenith.json" in the same folder where your root package.json file is. This file is used to determine the behavior of Zenith. It MUST include 'projects' and 'buildConfig' keys, and MAY include 'ignore' and 'appDirectories' keys. An example of usage is as follows.
```json
{
    "projects": {
        "@jotforminc/app1": "projects/applications/app1",
        "@jotforminc/app2": "projects/applications/app2",
        "@jotforminc/lib1": "projects/libraries/lib1"
    },
    "buildConfig": {
        "cachePath": ".customCache",
        "appConfig": {
            "build": {
                "script": "build",
                "outputs": [
                    "build"
                ]
            },
            "lint:js": {
                "script": "lint:js",
                "outputs": [
                    "stdout"
                ],
                "constantDependencies": [
                    "@jotforminc/lib1"
                ]
            }
        }
    },
    "mainConfig": {
        "build": {
            "script": "build",
            "outputs": [
                "build"
            ]
        },
        "lint:js": {
            "script": "lint:js",
            "outputs": [
                "stdout"
            ],
            "constantDependencies": [
                "@jotforminc/lib1",
                "@jotforminc/lib2"
            ]
        }
    },
    "ignore": [
        "node_modules",
        ".gitignore",
        "build",
        "lib",
        "dist",
        ".DS_Store",
        "test-results"
    ],
    "appDirectories": [
        "/apps/"
    ]
}
```
## Required Parameters
The project uses several required environment variables and params. Without them, the tool will not work as intended.
### Environment Variables
```
- CACHE_TYPE (string): One of ['local', 'remote', 'local-first', 'remote-first'], 'local' by default. If 'remote', S3 environment variables are required.
- S3_ACCESS_KEY (string): Access key to be used to get objects from and write objects to the buckets.
- S3_SECRET_KEY (string): Secret key to be used to get objects from and write objects to the buckets.
- S3_BUCKET_NAME (string): Bucket name to be written and read from.
- S3_REGION (string): AWS S3 region to connect to.
- ZENITH_DEBUG_ID (string): A string that will be used to determine the debug file name.
```
Optional for remote cache when not using default AWS endpoints:
```
- S3_ENDPOINT (string): Custom S3 API base URL (e.g. MinIO, GCS interoperable S3). Omit for AWS.
- S3_FORCE_PATH_STYLE (1 | true | yes): Use path-style URLs (`http://host/bucket/key`). Required for most MinIO setups with the AWS SDK.
```

### Local S3 with MinIO
1. Start MinIO and create the `zenith-cache` bucket: `yarn minio:up` (uses local `minio` binary and starts a server on `127.0.0.1:9000`).
   - If you prefer Docker, use `docker compose -f docker-compose.minio.yml up -d`.
2. Console UI: http://127.0.0.1:9001 (user `minioadmin`, password `minioadmin` — local dev only).
3. Point Zenith at MinIO, for example:
```
export CACHE_TYPE=remote
export S3_ENDPOINT=http://127.0.0.1:9000
export S3_FORCE_PATH_STYLE=1
export S3_ACCESS_KEY=minioadmin
export S3_SECRET_KEY=minioadmin
export S3_BUCKET_NAME=zenith-cache
export S3_REGION=us-east-1
```
Stop MinIO: `yarn minio:down`.

### Cache format benchmark (local MinIO)

After `yarn build` and `yarn minio:up`, with remote S3 env vars set:

`node scripts/benchmark-cache-formats.cjs`

This prints cache/recover timings for `zip`, `files`, `tar`, `blobs`, and `auto` on synthetic trees (many small files, few large binaries, mixed content).

**Note:** True incremental “delta” caching (upload only changes vs a prior snapshot) is not implemented; `blobs` deduplicates identical content within one manifest, and `auto` only chooses a storage shape.

### Params
```
-t, --target <"build" | "test">: Target command to be used.
-p, --project <"all" | [string]>: Project to be built. "all" value builds every project the tool finds in the subfolders.
```


## Optional Parameters
The following parameters are not required to work, but can be used to modify the tool's behavior.
```
-h, --help: Show parameter information.
-d, --debug: If given, enters debug mode. Usage is provided in the [debugging](#debugging) section.


-c, --compareWith <string>: Compares and calculates the difference between a given json file and the current build.


-dl, --debugLocation <string>: Debug Location: sets the prefix of the debug location. By default, it is "debug/", and its usage is as follows: \n {target}/{debugLocation}debug.{ZENITH_DEBUG_ID}.json


-w, --worker <number>: Worker Number (default = 6): sets the maximum number of workers that run concurrently.


-l, --logLevel <1 | 2 | 3>: Sets the log level. 1=silent mode. 2=default mode, which only shows errors and statistics after completion. 3=verbose mode, logs cache hits, misses, and recoveries.


-ch, --noCompareHash: default: false. If false, will compare remote folders\' and local folders\' hash and execute target if hashes are not the same.


-la, --logAffected: default: false. If true, will log outputs of ONLY missed caches\' executes.


--cache-format <zip | files | tar | blobs | auto>: Cache object layout for this run. Default is `zip` (see `--help`). Values: `zip` — single archive per output; `files` — one object per file plus manifest (many small files can be slow remotely); `tar` — single uncompressed tar per output; `blobs` — content-addressed `blobs/<sha256>` plus manifest; `auto` — heuristic choice among those. **Cache key layout:** The build/content hash is unchanged; directory outputs use `target/layoutHash/projectRoot/…` where `layoutHash` mixes that hash with the concrete format so e.g. zip and tar never share a prefix. Stdout caches use `target/contentHash/projectRoot/`. Older buckets without `layoutHash` still work via a legacy prefix. Pass this flag only when you want to override the default; omitting it keeps `zip`.
```



## Debugging
If -d param is given, the tool outputs a file named "debug.{ZENITH_DEBUG_ID}.json". This file will contain hashes of every file that is used in hashing. It can be used to see if the tool is working as intended, and which folders are being hashed. By also setting -c param, you can compare builds and see which files are new, and changed or removed.


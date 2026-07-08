# Zenith: Lightning-Fast JavaScript Monorepo Build Tool <!-- omit in toc -->

**Zenith** transforms the complexity of managing JavaScript monorepos into a simple, fast, and productive experience. By smartly caching without .git reliance, Zenith slashes CI pipeline times, letting you focus solely on coding.

## Quick Start

-   **Install:** `pnpm add @jotforminc/zenith`
-   **Use:** `pnpm zenith --target=<command> --project=<name>`

## Configuration with `zenith.json`

Create a `zenith.json` in your project root including `projects` and `buildConfig` to guide Zenith's operation.

## Features

-   **Local & Remote Caching:** Deploy faster using less bandwidth. Supports local disk, S3-compatible remote storage, and Redis.
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
  - [Cache types (usage)](#cache-types-usage)
  - [Params](#params)
- [Optional Parameters](#optional-parameters)
- [Build statistics output](#build-statistics-output)
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

### Usage examples

Local cache (default — artifacts stored under `.cache` on disk):

```
CACHE_TYPE=local pnpm zenith --target=build --project=all
```

Remote S3 cache (requires S3 credentials; see [Local S3 with MinIO](#local-s3-with-minio) for a local setup):

```
CACHE_TYPE=remote \
S3_ACCESS_KEY=... \
S3_SECRET_KEY=... \
S3_BUCKET_NAME=... \
S3_REGION=us-east-1 \
pnpm zenith --target=build --project=all
```

Redis cache (requires a running Redis server; see [Redis cache](#redis-cache)):

```
CACHE_TYPE=redis \
REDIS_URL=redis://127.0.0.1:6379 \
pnpm zenith --target=build --project=all
```

Hybrid modes (write to both backends; read from the first that hits):

```
CACHE_TYPE=local-first pnpm zenith --target=build --project=all   # local, then remote S3
CACHE_TYPE=remote-first pnpm zenith --target=build --project=all  # remote S3, then local
```

Optional flags used often in CI or debugging:

```
pnpm zenith --target=build --project=all --logLevel=3 --cache-format=zip
```

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
- CACHE_TYPE (string): One of ['local', 'remote', 'redis', 'local-first', 'remote-first'], 'local' by default. If 'remote' or hybrid modes that include remote, S3 environment variables are required. If 'redis', REDIS_URL is required (defaults to redis://127.0.0.1:6379).
- REDIS_URL (string): Redis connection URL when CACHE_TYPE=redis. Default: redis://127.0.0.1:6379.
- REDIS_KEY_PREFIX (string): Prefix for all Redis cache keys when CACHE_TYPE=redis. Default: zenith:.
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

If you see `SignatureDoesNotMatch: Invalid argument` against a non-AWS S3 endpoint after upgrading Zenith, ensure you are on a build that sets `requestChecksumCalculation: WHEN_REQUIRED` on the S3 client (3.3.0+), or set `AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED` and `AWS_RESPONSE_CHECKSUM_VALIDATION=WHEN_REQUIRED` in the environment as a workaround.

### Redis cache

1. Install Redis if needed: `brew install redis`
2. Start a local server: `yarn redis:up` (uses the `redis-server` binary on `127.0.0.1:6379`).
   - If you prefer Docker, use `docker run -d --name zenith-redis -p 6379:6379 redis:7-alpine` (requires Docker Desktop to be running).
3. Point Zenith at Redis:

```
export CACHE_TYPE=redis
export REDIS_URL=redis://127.0.0.1:6379
export REDIS_KEY_PREFIX=zenith:
pnpm zenith --target=build --project=all
```

Stop Redis: `yarn redis:down`.

Redis stores cache blobs as binary values keyed by the same paths used for S3/local storage (`zenith:` + `target/layoutHash/projectRoot/...`). Use a dedicated Redis instance or database index in shared environments.

### Cache types (usage)

| CACHE_TYPE | Where artifacts go | When to use |
|------------|-------------------|-------------|
| `local` | `.cache/` on disk (or `LOCAL_CACHE_PATH`) | Solo development, no shared cache needed |
| `remote` | S3-compatible bucket | CI/CD teams sharing cache across machines |
| `redis` | Redis server | Fast shared cache when you already run Redis; good for smaller/medium artifacts |
| `local-first` | Local disk + S3 (read local first) | Dev machines with optional remote fallback |
| `remote-first` | S3 + local disk (read remote first) | CI agents that also keep a local copy |

For `remote`, `local-first`, and `remote-first`, set the S3 variables listed above. For `redis`, set `REDIS_URL` (and optionally `REDIS_KEY_PREFIX`).

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


-l, --logLevel <1 | 2 | 3>: Sets the log level for operational logs. 1=silent mode. 2=default mode (errors only). 3=verbose mode, logs cache hits, misses, and recoveries. Note: the end-of-run statistics block is controlled separately by --stats, independently of this flag.


-ch, --noCompareHash: default: false. If false, will compare remote folders\' and local folders\' hash and execute target if hashes are not the same.


-la, --logAffected: default: false. If true, will log outputs of ONLY missed caches\' executes.


--cache-format <zip | files | tar | blobs | auto>: Cache object layout for this run. Default is `zip` (see `--help`). Values: `zip` — single archive per output; `files` — one object per file plus manifest (many small files can be slow remotely); `tar` — single uncompressed tar per output; `blobs` — content-addressed `blobs/<sha256>` plus manifest; `auto` — heuristic choice among those. **Cache key layout:** The build/content hash is unchanged; directory outputs use `target/layoutHash/projectRoot/…` where `layoutHash` mixes that hash with the concrete format so e.g. zip and tar never share a prefix. Stdout caches use `target/contentHash/projectRoot/`. Older buckets without `layoutHash` still work via a legacy prefix. Pass this flag only when you want to override the default; omitting it keeps `zip`.


--stats <silent | default | full>: Controls the end-of-run statistics block, independently of --logLevel. `silent` prints only the summary block (no tables). `default` prints both tables limited to projects that were built this run (cache hits excluded), with no row cap. `full` prints both tables for all projects including cache hits, with no row cap. Default: `default`.
```


## Build statistics output

At the end of each run, Zenith prints — unless `--stats silent` — two per-project stats tables (a `Build — by time` table sorted by total time, and a `Largest Artifacts` table sorted by uncompressed output size) followed by a summary block. Row counts are not capped. In the default `--stats default` mode the tables list only projects built this run; `--stats full` also includes cache-hit rows. `SKIP` rows are always omitted; full status counts always appear in the summary. Because raw output size is measured only when a project is built, cache-hit rows show `-` for `Out Size`/`Files`, and `Largest Artifacts` therefore lists only built projects. See `--stats` under [Optional Parameters](#optional-parameters).

```
Zenith completed command: build.

Build — by time
 Project   Source  Exec    Hash   Arch   Up     Down   Extr     Total   Out Size  Files  Cache Size
 --------  ------  ------  -----  -----  -----  -----  -------  ------  --------  -----  ----------
 @jf/app1  built   42.10s  0.31s  2.10s  1.10s  -      -        45.61s  18.4 MB   312    5.9 MB
 @jf/app2  built   12.00s  0.09s  0.80s  0.30s  -      -        13.19s  5.0 MB    88     1.7 MB
 @jf/lib2  remote  -       0.12s  -      -      9.80s  2.50s !  12.42s  -         -      36.3 MB
 @jf/lib1  local   -       0.05s  -      -      0.60s  0.20s    0.85s   -         -      918.0 KB

Largest Artifacts
 Project   Out Size  Files  Cache Size  Total
 --------  --------  -----  ----------  ------
 @jf/app1  18.4 MB   312    5.9 MB      45.61s
 @jf/app2  5.0 MB    88     1.7 MB      13.19s

Total of 5 projects are finished.
2 projects used from cache,
2 projects used without cache.

Total process took 46.000s. (parallelism 1.6x)
```

Controlled by `--stats` (default `default`), independently of `--logLevel`. Use `--stats silent` to print only the summary block, or `--stats full` to add cache-hit rows.

### Summary block

Below the tables, Zenith prints:

- `Total of <N> projects are finished.` — every project that ran, `SKIP` included.
- `<X> projects used from cache,` — `HIT` count.
- `<Y> projects used without cache.` — built count (`MISS` + `STALE` + `--noCache` `BUILT`); `SKIP` projects appear in neither line.
- `Total process took <wall>. (parallelism <p>x)` — wall-clock run time, and `parallelism` = Σ per-project time ÷ wall.

### Column glossary

The `Build — by time` table carries every column below. The `Largest Artifacts` table repeats `Out Size`, `Files`, `Cache Size`, and `Total`.

| Column | Meaning |
|--------|---------|
| `Source` | Where the result came from: `local` or `remote` for a cache hit (the backend that served it), or `built` when the project was run (miss / stale / `--noCache`). Full status counts still appear in the summary |
| `Exec` | Script run time |
| `Hash` | Input hashing time |
| `Arch` | Archive/compress — cache-write remainder (non-network portion of the write phase) |
| `Up` | Upload transfer time to the cache backend |
| `Down` | Download transfer time from the cache backend |
| `Extr` | Extract — recovery remainder (`recover total − download`, clamped ≥ 0); approximate for streamed formats because extraction overlaps the download. A `!` suffix marks recoveries where `download + extract > 10 s` |
| `Out Size` | Raw uncompressed output directory size. Only measured when the project is built, so cache-hit rows show `-` |
| `Files` | Number of output files. Same measurement caveat as `Out Size` — `-` on cache hits |
| `Cache Size` | Bytes moved to/from cache backends (upload + download); in hybrid modes (`local-first`, `remote-first`) each backend is counted separately so the total reflects real bandwidth |
| `Total` | That project's total time — `Exec + Hash + Arch + Up + Down + Extr` |

### Status glossary

| Status | Meaning |
|--------|---------|
| `HIT` | Artifact recovered from cache; no build ran |
| `MISS` | Not found in cache; project was built and the result was cached |
| `STALE` | Hash mismatch — recovered artifact hash did not match the stored hash; project was rebuilt |
| `SKIP` | Dummy script (`true`) or missing script with `--skipPackageJson`; not built or cached. Counted in the summary but not shown as a table row |
| `BUILT` | Executed with `--noCache`; cache was bypassed entirely |


## Debugging
If -d param is given, the tool outputs a file named "debug.{ZENITH_DEBUG_ID}.json". This file will contain hashes of every file that is used in hashing. It can be used to see if the tool is working as intended, and which folders are being hashed. By also setting -c param, you can compare builds and see which files are new, and changed or removed.


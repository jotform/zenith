# Changelog

All notable changes are grouped by **git tag** (newest releases first). Within each section, commits are in chronological order for that tag range.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

Commits after the newest tag will be listed here until the next release.

---

## [v3.1.0] - 2026-05-13

- (`52ab324`) perf(builder): faster cyclic dependency check (memoized reachability, Set-based DFS); tests for explicit two-node cycle and acyclic dummy graph

---

## [v3.0.0] - 2026-05-06

- (`68b7ac8`) chore(deps): add tar and @aws-sdk/lib-storage
- (`14be943`) chore(minio): add node MinIO helpers and cache format benchmark
- (`f0ecc28`) feat(cache): pluggable zip/files/tar/blobs/auto formats and layout keys
- (`706d795`) fix(remote): multipart Upload for large streamed S3 puts
- (`01f8637`) test(cache): round-trip specs for zip, tar, files, and blobs
- (`cb32c78`) docs(readme): cache formats, --cache-format, MinIO and benchmark
- (`5df1491`) docs: add CHANGELOG with full commit history
- (`832d184`) chore(release): 3.0.0
- (`7cd62c0`) docs(changelog): regenerate from git tags
- (`9aa1393`) docs(changelog): align v3.0.0 section with tagged revision

## [v2.9.1] - 2026-05-05

- (`36348ee`) chore(publish): new npm token variable

## [v2.9.0] - 2026-05-05

- (`48226a2`) perf(hasher): async hashing and faster empty-directory checks
- (`84ecd5d`) fix(cache): stream zip artifacts, harden remote S3 client, path-style option
- (`0214ae3`) docs(dev): document S3 endpoint options and add MinIO compose stack
- (`a985c7a`) chore(release): 2.9.0

## [v2.8.1] - 2025-10-08

- (`f1d526d`) feat: callback function invoke added to after get hash function

## [v2.7.1 / v2.8.0] - 2025-07-23

- (`230d8c0`) fix: add projects from constant dependencies during first initialization (#75)

## [v2.7.0] - 2025-07-21

- (`c3dfc10`) Feat additional files config (#74)

## [v2.6.1] - 2025-03-25

- (`dbe1166`) feat: add onlyDependencies option (#72)

## [v2.5.1] - 2024-11-05

- (`ebea2eb`) feat(graph): zenith graph initial (#64)
- (`e71ce9c`) chore: v2.5.0
- (`eed3635`) chore: change zenith config extension
- (`ac6a00e`) chore(deps): bump micromatch from 4.0.5 to 4.0.8 (#68)
- (`d019785`) feat: correct timing for cache mismatches
- (`3f7ea5f`) feat: table output on execution summary
- (`1272d80`) chore: bump version

## [v2.4.0] - 2024-05-13

- (`9c2822d`) chore: fix wrong versioning

## [v2.3.4] - 2024-05-13

- (`8956063`) chore: delete pnpm lock
- (`4909397`) chore(deps): bump @babel/traverse from 7.23.0 to 7.24.5 (#60)
- (`00b1908`) fix: single build does not cache correctly (#61)
- (`59c1f18`) fix: single build log errors

## [v2.3.0-alpha.3] - 2024-03-28

- (`b25d861`) fix(package.json): version fixed

## [v2.3.0-alpha.2] - 2024-03-28

- (`6865f9c`) fix(worker): process.env fixed

## [v2.3.0-alpha.1] - 2024-03-28

- (`caea246`) feat(worker): run execution with zenith_parallel_runner

## [v2.2.3] - 2024-05-09

- (`8956063`) chore: delete pnpm lock
- (`4909397`) chore(deps): bump @babel/traverse from 7.23.0 to 7.24.5 (#60)
- (`00b1908`) fix: single build does not cache correctly (#61)

## [v2.2.2] - 2024-03-14

- (`a3b4e09`) fix: use build config single cache

## [v2.2.1] - 2024-02-20

- (`71fc24a`) refactor: single or project-by-project builder
- (`f80fada`) feat: run single command
- (`bfaa8b2`) chore: version up

## [v2.1.1] - 2024-01-03

- (`1ef70a0`) fix: send more details for onFail

## [v2.1.0] - 2024-01-03

- (`9738b5c`) feat: read js config and add onFail to config (#57)

## [v2.0.2] - 2023-12-28

- (`9c01697`) fix: remove unreadable text color

## [v2.0.1] - 2023-12-28

- (`9085465`) feat: enable different config files

## [v2.0.0] - 2023-12-28

- (`e8ed01b`) feat: piping (#56)
- (`d932dc3`) fix(cacher): dont skip stdouts

## [v1.5.3] - 2023-12-05

- (`65f0cb2`) fix: update hash before skipping projects

## [v1.5.2] - 2023-11-30

- (`2662d93`) feat: add .gitignore to ignored files
- (`9becbcb`) chore: update version
- (`933c0ae`) fix: package manager in package.json

## [v1.5.1] - 2023-11-15

- (`899ac55`) doc: update readme
- (`d34a6db`) feat: skip dummy commands (#54)

## [v1.5.0] - 2023-10-19

- (`298e960`) feat: add no cache option (#53)

## [v1.4.0] - 2023-10-03

- (`aa15984`) feat: skip on script not found at package json flag added (#50)
- (`0206bb2`) fix: images being corrupted on zip (#51)
- (`4c80c1d`) v1.4.0

## [v1.3.1] - 2023-10-02

- (`9daaebd`) style: add error on console log

## [v1.3.0] - 2023-10-02

- (`31a39d7`) perf: do not recover caches when output is stdout and log affected is on

## [v1.2.3] - 2023-09-29

- (`7eba098`) fix: error when root lib or build does not exist

## [v1.2.2] - 2023-09-29

- (`6113ed4`) fix: remove console log

## [v1.2.1] - 2023-09-29

- (`be75fc1`) perf: increase zipper performance

## [v1.2.0] - 2023-09-29

- (`b6000c9`) fix: zipper performance and bug fixes

## [v1.1.3] - 2023-09-28

- (`a7ff4b3`) feat: remove unzipper package and fix unzipping bugs and performance improvements (#48)

## [v1.0.3] - 2023-09-28

- (`73f551e`) debug: add cache debug checks temporarily

## [v1.0.2] - 2023-09-28

- (`ad3d9e6`) fix: minor log fix

## [v1.0.1] - 2023-09-28

- (`7e44740`) chore: minor version bump to publish package

## [v1.0.0] - 2023-09-27

- (`a78cb88`) Revert "fix: set package version to minor change"
- (`2b4e669`) security: update mock repo dependency

## [v0.12.0] - 2023-09-27

- (`5b12585`) refactor: remove zip-local package (#45)
- (`1e7eba9`) feat: local caching (#46)
- (`937268a`) feat: hybrid caching (#47)
- (`6f72286`) fix: set package version to minor change

## [v0.11.0-beta] - 2023-09-20

- (`2e06a06`) remove zip-local

## [v0.11.0] - 2023-09-20

- (`5b12585`) refactor: remove zip-local package (#45)

## [v0.10.2] - 2023-09-18

- (`251c647`) fix: add root package.json to hash if exists

## [v0.10.1] - 2023-09-18

- (`1310bec`) fix: remove redundant console log

## [v0.10.0] - 2023-09-14

- (`c428468`) chore(deps): bump word-wrap from 1.2.3 to 1.2.4 (#41)
- (`f1cfc33`) chore(deps): bump semver from 6.3.0 to 6.3.1 (#39)
- (`3e3cc75`) chore(deps): bump tough-cookie from 4.1.2 to 4.1.3 (#38)
- (`1f397bc`) test: add mock repo and circular dependency tests
- (`3e2da35`) feat: skip dependencies command flag (#42)

## [v0.9.3] - 2023-07-19

- (`ffed19f`) fix: throw error for circular dependencies (#40)

## [v0.9.2] - 2023-05-17

- (`eed478a`) version up (0.9.2)

## [v0.9.1] - 2023-05-17

- (`908b304`) fix: dont log for scripts with no command (#37)
- (`1b3959a`) fix: put missing projects if command is not dummy

## [v0.9.0] - 2023-05-04

- (`a7b8198`) fix: jest revert update
- (`d6db516`) chore: fix semver version for package.json

## [v0.9] - 2023-05-04

- (`860361d`) chore: update package dependencies

## [v0.8.9] - 2023-04-26

- (`578579e`) fix: add requiredFiles option to targets in zenith.json
- (`1a5e082`) style: linter fix
- (`314e18f`) fix: build helper test arg

## [v0.8.8-latest] - 2023-04-26

- (`a89da5d`) fix: npm publish

## [v0.8.8] - 2023-04-26

- (`069cd65`) test: add randomized hashing test (#33)
- (`512f3ea`) test: missing package json (#35)
- (`4fd3085`) fix: lint error in error handling at worker (#36)

## [v0.8.5] - 2023-04-24

- (`a4337bc`) fix: make sure program does not exit with 0 after error is thrown

## [v0.8.4] - 2023-04-24

- (`387c96c`) chore: add readme to package files
- (`0c0a50e`) refactor: initiate config manager
- (`0b49d70`) Style/typescript eslint (#34)

## [v0.8.3] - 2023-04-13

- (`e1af803`) Fix/hashing empty folders (#31)

## [v0.8.2-hashfix] - 2023-04-13

- (`c2936f2`) fix: dependencies and script is hashed on every recursive call

## [v0.8.2] - 2023-04-13

- (`2aa9841`) chore(zenith): typescript packages added to dev dependencies (#28)
- (`ad51154`) fix: ignore empty files when hashing

## [v0.8.1] - 2023-04-11

- (`d16a7b9`) Update package.json
- (`1379c0c`) Update package.json

## [v0.8.0] - 2023-04-11

- (`8523801`) chore: update json file
- (`5a5bacb`) docs: add pnpm part
- (`733acdd`) chore: make it ready to public publish
- (`4716b21`) Update README.md
- (`1093e59`) migration: convert to ts (#27)
- (`a23a80d`) Update package.json

## [v0.7.5] - 2023-04-06

- (`49dbc83`) fix: @swc/core added for tests

## [v0.7.4] - 2023-04-06

_No commits in this range (tag points to same revision as the previous boundary)._

## [v0.7.3] - 2023-04-06

- (`6c93a04`) feat: added unit test for Hasher (#26)
- (`ad54f7f`) chore: changed unit test script for gh actions
- (`df48546`) chore: version bump
- (`03300fc`) fix: jest config moved to zenith
- (`c711c19`) fix: removed @jotforminc/jest-preset-base as its private
- (`c621f61`) fix: lockfile update
- (`49dbc83`) fix: @swc/core added for tests

## [v0.7.2-noconsole] - 2023-04-05

- (`265033d`) fix: remove console log

## [v0.7.2] - 2023-04-05

- (`729dfc3`) feat: log slow projects

## [v0.7.1] - 2023-04-04

- (`4f9e90f`) fix: zenith not throwing errors

## [v0.7.0] - 2023-04-04

- (`70a601e`) chore: update build folders
- (`e3ccc8b`) chore: try new build folder
- (`5338399`) chore: update build system
- (`fc06364`) chore: version up
- (`1c42c20`) chore: try without files
- (`63d73f2`) chore: up version
- (`581f799`) chore: update version
- (`cf3df54`) chore: update workflow
- (`d013a00`) chore: updated file names and folder structure (#2)
- (`d6f5331`) chore: update build system
- (`672a16e`) fix: file path issues (#3)
- (`c6395bf`) chore: build system updates
- (`3b1ab48`) chore: version 2.0
- (`1282b71`) chore: v.0.2.1
- (`bf9c1c7`) chore: v0.2.2
- (`53dd7d1`) fix: worker path corrected & errors throwed
- (`dafe1e4`) feat(zenith): add log level, add execution time to projects with missed cache (#4)
- (`b22f415`) style: singleton logger created and replaced console logs
- (`6a6a076`) Merge pull request #6 from hmdoganjf/style/log-singleton
- (`d4aa8e5`) style: optimize flag usage
- (`878bfa6`) style: delete unnecessary variables and logs
- (`c94fbcb`) docs: update readme
- (`fba3deb`) fix: buildHelper completed ascii art fixed (#10)
- (`67de0c4`) feat: test caching (#11)
- (`46580c1`) chore: update yarn files
- (`0c49856`) fix: change filter name
- (`0c8f8f5`) Fix/filter name (#13)
- (`a1db3e6`) Fix/filter name (#14)
- (`2ec7596`) Feat/log affected (#15)
- (`a98f3b3`) fix: remove unnecessary log
- (`e2e5659`) fix previous release
- (`fa59c88`) feat: log hash mismatched projects at the end
- (`8ad9456`) fix: await async logic in send output hash
- (`c35b979`) Update RemoteCacher.js
- (`7b0b18e`) feat: log error output
- (`a19a4ea`) fix: default log level added
- (`4b56128`) feat: add .zenithignore file (#16)
- (`8e1b591`) fix: output and remote hashes not matching
- (`d8c7d74`) test: increase max workers to 10 instead of 6
- (`e43ba55`) chore: version up
- (`4d147ea`) chore: version up (#18)
- (`28770a3`) feat: worker parametrization (#19)
- (`5b4a4f8`) Feat/version/up (#20)
- (`5d68668`) feat: dependency ignoring
- (`13aaabd`) feat: add debug location flag (#17)
- (`bc55101`) docs: update readme (#21)
- (`e7a35ce`) fix: if one of the execution fails terminate all the workers
- (`92604c1`) docs: introduction to zenith
- (`f272bda`) ui: completed stats (#22)

## [v0.7] - 2023-03-02

_No commits in this range (tag points to same revision as the previous boundary)._

## [v0.6.4] - 2023-04-04

- (`13aaabd`) feat: add debug location flag (#17)
- (`bc55101`) docs: update readme (#21)
- (`e7a35ce`) fix: if one of the execution fails terminate all the workers

## [v0.6.3] - 2023-04-03

- (`5d68668`) feat: dependency ignoring

## [v0.6.2-workers] - 2023-03-31

- (`e43ba55`) chore: version up
- (`4d147ea`) chore: version up (#18)
- (`28770a3`) feat: worker parametrization (#19)
- (`5b4a4f8`) Feat/version/up (#20)

## [v0.6.1-workers / v0.6.2] - 2023-03-31

_No commits in this range (tag points to same revision as the previous boundary)._

## [v0.6.1-alpha] - 2023-03-31

- (`d8c7d74`) test: increase max workers to 10 instead of 6
- (`e43ba55`) chore: version up
- (`4d147ea`) chore: version up (#18)

## [v0.6.1] - 2023-03-30

- (`8e1b591`) fix: output and remote hashes not matching

## [v0.6.0] - 2023-03-30

- (`02540d8`) chore: publish first alpha version
- (`70a601e`) chore: update build folders
- (`e3ccc8b`) chore: try new build folder
- (`5338399`) chore: update build system
- (`fc06364`) chore: version up
- (`1c42c20`) chore: try without files
- (`63d73f2`) chore: up version
- (`581f799`) chore: update version
- (`cf3df54`) chore: update workflow
- (`d013a00`) chore: updated file names and folder structure (#2)
- (`d6f5331`) chore: update build system
- (`672a16e`) fix: file path issues (#3)
- (`c6395bf`) chore: build system updates
- (`3b1ab48`) chore: version 2.0
- (`1282b71`) chore: v.0.2.1
- (`bf9c1c7`) chore: v0.2.2
- (`53dd7d1`) fix: worker path corrected & errors throwed
- (`dafe1e4`) feat(zenith): add log level, add execution time to projects with missed cache (#4)
- (`b22f415`) style: singleton logger created and replaced console logs
- (`6a6a076`) Merge pull request #6 from hmdoganjf/style/log-singleton
- (`d4aa8e5`) style: optimize flag usage
- (`878bfa6`) style: delete unnecessary variables and logs
- (`c94fbcb`) docs: update readme
- (`fba3deb`) fix: buildHelper completed ascii art fixed (#10)
- (`67de0c4`) feat: test caching (#11)
- (`46580c1`) chore: update yarn files
- (`0c49856`) fix: change filter name
- (`0c8f8f5`) Fix/filter name (#13)
- (`a1db3e6`) Fix/filter name (#14)
- (`2ec7596`) Feat/log affected (#15)
- (`a98f3b3`) fix: remove unnecessary log
- (`e2e5659`) fix previous release
- (`fa59c88`) feat: log hash mismatched projects at the end
- (`8ad9456`) fix: await async logic in send output hash
- (`c35b979`) Update RemoteCacher.js
- (`7b0b18e`) feat: log error output
- (`a19a4ea`) fix: default log level added
- (`4b56128`) feat: add .zenithignore file (#16)

## [v0.6] - 2023-03-02

- (`9134cf9`) chore: publish first alpha version

## [v0.5.10] - 2023-03-29

- (`a19a4ea`) fix: default log level added

## [v0.5.9] - 2023-03-24

- (`7b0b18e`) feat: log error output

## [v0.5.8] - 2023-03-23

- (`8ad9456`) fix: await async logic in send output hash
- (`c35b979`) Update RemoteCacher.js

## [v0.5.7] - 2023-03-23

- (`fa59c88`) feat: log hash mismatched projects at the end

## [v0.5.6] - 2023-03-23

- (`e2e5659`) fix previous release

## [v0.5.5] - 2023-03-23

- (`a98f3b3`) fix: remove unnecessary log

## [v0.5.4] - 2023-03-23

- (`2ec7596`) Feat/log affected (#15)

## [v0.5.3] - 2023-03-22

- (`a1db3e6`) Fix/filter name (#14)

## [v0.5.2] - 2023-03-22

- (`0c49856`) fix: change filter name
- (`0c8f8f5`) Fix/filter name (#13)

## [v0.5.1] - 2023-03-21

- (`46580c1`) chore: update yarn files

## [v0.5.0] - 2023-03-21

- (`4769775`) chore: update workflow
- (`02540d8`) chore: publish first alpha version
- (`70a601e`) chore: update build folders
- (`e3ccc8b`) chore: try new build folder
- (`5338399`) chore: update build system
- (`fc06364`) chore: version up
- (`1c42c20`) chore: try without files
- (`63d73f2`) chore: up version
- (`581f799`) chore: update version
- (`cf3df54`) chore: update workflow
- (`d013a00`) chore: updated file names and folder structure (#2)
- (`d6f5331`) chore: update build system
- (`672a16e`) fix: file path issues (#3)
- (`c6395bf`) chore: build system updates
- (`3b1ab48`) chore: version 2.0
- (`1282b71`) chore: v.0.2.1
- (`bf9c1c7`) chore: v0.2.2
- (`53dd7d1`) fix: worker path corrected & errors throwed
- (`dafe1e4`) feat(zenith): add log level, add execution time to projects with missed cache (#4)
- (`b22f415`) style: singleton logger created and replaced console logs
- (`6a6a076`) Merge pull request #6 from hmdoganjf/style/log-singleton
- (`d4aa8e5`) style: optimize flag usage
- (`878bfa6`) style: delete unnecessary variables and logs
- (`c94fbcb`) docs: update readme
- (`fba3deb`) fix: buildHelper completed ascii art fixed (#10)
- (`67de0c4`) feat: test caching (#11)

## [v0.5] - 2023-03-02

_No commits in this range (tag points to same revision as the previous boundary)._

## [v0.4.1] - 2023-03-14

- (`b22f415`) style: singleton logger created and replaced console logs
- (`6a6a076`) Merge pull request #6 from hmdoganjf/style/log-singleton

## [v0.4.0] - 2023-03-14

- (`ff5620b`) Chore (#1)
- (`b7e188e`) chore: build system updates
- (`4769775`) chore: update workflow
- (`02540d8`) chore: publish first alpha version
- (`70a601e`) chore: update build folders
- (`e3ccc8b`) chore: try new build folder
- (`5338399`) chore: update build system
- (`fc06364`) chore: version up
- (`1c42c20`) chore: try without files
- (`63d73f2`) chore: up version
- (`581f799`) chore: update version
- (`cf3df54`) chore: update workflow
- (`d013a00`) chore: updated file names and folder structure (#2)
- (`d6f5331`) chore: update build system
- (`672a16e`) fix: file path issues (#3)
- (`c6395bf`) chore: build system updates
- (`3b1ab48`) chore: version 2.0
- (`1282b71`) chore: v.0.2.1
- (`bf9c1c7`) chore: v0.2.2
- (`53dd7d1`) fix: worker path corrected & errors throwed
- (`dafe1e4`) feat(zenith): add log level, add execution time to projects with missed cache (#4)

## [v0.4] - 2023-03-02

_No commits in this range (tag points to same revision as the previous boundary)._

## [v0.3.0] - 2023-03-06

- (`ca71850`) chore: build system demo
- (`ff5620b`) Chore (#1)
- (`b7e188e`) chore: build system updates
- (`4769775`) chore: update workflow
- (`02540d8`) chore: publish first alpha version
- (`70a601e`) chore: update build folders
- (`e3ccc8b`) chore: try new build folder
- (`5338399`) chore: update build system
- (`fc06364`) chore: version up
- (`1c42c20`) chore: try without files
- (`63d73f2`) chore: up version
- (`581f799`) chore: update version
- (`cf3df54`) chore: update workflow
- (`d013a00`) chore: updated file names and folder structure (#2)
- (`d6f5331`) chore: update build system
- (`672a16e`) fix: file path issues (#3)
- (`c6395bf`) chore: build system updates
- (`3b1ab48`) chore: version 2.0
- (`1282b71`) chore: v.0.2.1
- (`bf9c1c7`) chore: v0.2.2
- (`53dd7d1`) fix: worker path corrected & errors throwed

## [v0.3] - 2023-03-02

_No commits in this range (tag points to same revision as the previous boundary)._

## [v0.2.2] - 2023-03-06

- (`bf9c1c7`) chore: v0.2.2

## [v0.2.1] - 2023-03-06

- (`1282b71`) chore: v.0.2.1

## [v0.2.0] - 2023-03-06

- (`d013a00`) chore: updated file names and folder structure (#2)
- (`d6f5331`) chore: update build system
- (`672a16e`) fix: file path issues (#3)
- (`c6395bf`) chore: build system updates
- (`3b1ab48`) chore: version 2.0

## [v0.1.5] - 2023-03-02

- (`cf3df54`) chore: update workflow

## [v0.1.4] - 2023-03-02

- (`581f799`) chore: update version

## [v0.1.3] - 2023-03-02

- (`1c42c20`) chore: try without files
- (`63d73f2`) chore: up version

## [v0.1.2] - 2023-03-02

- (`5338399`) chore: update build system
- (`fc06364`) chore: version up

## [v0.1.1] - 2023-03-02

- (`a400cab`) chore(deployment): try with yarn tmp
- (`ca71850`) chore: build system demo
- (`ff5620b`) Chore (#1)
- (`b7e188e`) chore: build system updates
- (`4769775`) chore: update workflow
- (`02540d8`) chore: publish first alpha version
- (`70a601e`) chore: update build folders
- (`e3ccc8b`) chore: try new build folder

## [v0.1] - 2023-03-02

- (`9a9e92d`) chore: file structure updated
- (`03c7ef8`) chore: update package manager
- (`a7d4a09`) chore(deployment): initial action

---

## Earlier history

Older tags excluded from the automated list above (e.g. `typescript-migration*`, malformed `v.*`) are still available via `git tag -l` and `git log`.

_Regenerate tag sections (after adding tags):_

```bash
git tag -l 'v*' --sort=v:refname
```

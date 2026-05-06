# Changelog

All notable changes to this project are documented here. This file includes **every commit** from the repository’s first commit through `HEAD`, in chronological order (oldest first), grouped by calendar year.

Curated summaries by version appear in git tags and release notes; for a tag-to-commit mapping run `git tag -l` and `git log <tag>`.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

Add new work here when cutting a release. The section below lists **all** commits on the default branch through the last update of this file (see footer).

## Full commit history

### 2023
- **2023-02-28** (`1114af5`) initial commit
- **2023-03-02** (`9a9e92d`) chore: file structure updated
- **2023-03-02** (`03c7ef8`) chore: update package manager
- **2023-03-02** (`a7d4a09`) chore(deployment): initial action
- **2023-03-02** (`a400cab`) chore(deployment): try with yarn tmp
- **2023-03-02** (`ca71850`) chore: build system demo
- **2023-03-02** (`ff5620b`) Chore (#1)
- **2023-03-02** (`b7e188e`) chore: build system updates
- **2023-03-02** (`4769775`) chore: update workflow
- **2023-03-02** (`02540d8`) chore: publish first alpha version
- **2023-03-02** (`70a601e`) chore: update build folders
- **2023-03-02** (`e3ccc8b`) chore: try new build folder
- **2023-03-02** (`5338399`) chore: update build system
- **2023-03-02** (`fc06364`) chore: version up
- **2023-03-02** (`1c42c20`) chore: try without files
- **2023-03-02** (`63d73f2`) chore: up version
- **2023-03-02** (`581f799`) chore: update version
- **2023-03-02** (`cf3df54`) chore: update workflow
- **2023-03-02** (`d013a00`) chore: updated file names and folder structure (#2)
- **2023-03-02** (`d6f5331`) chore: update build system
- **2023-03-06** (`672a16e`) fix: file path issues (#3)
- **2023-03-06** (`c6395bf`) chore: build system updates
- **2023-03-06** (`3b1ab48`) chore: version 2.0
- **2023-03-06** (`1282b71`) chore: v.0.2.1
- **2023-03-06** (`bf9c1c7`) chore: v0.2.2
- **2023-03-06** (`53dd7d1`) fix: worker path corrected & errors throwed
- **2023-03-14** (`dafe1e4`) feat(zenith): add log level, add execution time to projects with missed cache (#4)
- **2023-03-14** (`b22f415`) style: singleton logger created and replaced console logs
- **2023-03-14** (`6a6a076`) Merge pull request #6 from hmdoganjf/style/log-singleton
- **2023-03-14** (`d4aa8e5`) style: optimize flag usage
- **2023-03-14** (`878bfa6`) style: delete unnecessary variables and logs
- **2023-03-14** (`c94fbcb`) docs: update readme
- **2023-03-16** (`fba3deb`) fix: buildHelper completed ascii art fixed (#10)
- **2023-03-21** (`67de0c4`) feat: test caching (#11)
- **2023-03-21** (`46580c1`) chore: update yarn files
- **2023-03-22** (`0c49856`) fix: change filter name
- **2023-03-22** (`0c8f8f5`) Fix/filter name (#13)
- **2023-03-22** (`a1db3e6`) Fix/filter name (#14)
- **2023-03-23** (`2ec7596`) Feat/log affected (#15)
- **2023-03-23** (`a98f3b3`) fix: remove unnecessary log
- **2023-03-23** (`e2e5659`) fix previous release
- **2023-03-23** (`fa59c88`) feat: log hash mismatched projects at the end
- **2023-03-23** (`8ad9456`) fix: await async logic in send output hash
- **2023-03-23** (`c35b979`) Update RemoteCacher.js
- **2023-03-24** (`7b0b18e`) feat: log error output
- **2023-03-29** (`a19a4ea`) fix: default log level added
- **2023-03-30** (`4b56128`) feat: add .zenithignore file (#16)
- **2023-03-30** (`8e1b591`) fix: output and remote hashes not matching
- **2023-03-31** (`d8c7d74`) test: increase max workers to 10 instead of 6
- **2023-03-31** (`e43ba55`) chore: version up
- **2023-03-31** (`4d147ea`) chore: version up (#18)
- **2023-03-31** (`28770a3`) feat: worker parametrization (#19)
- **2023-03-31** (`5b4a4f8`) Feat/version/up (#20)
- **2023-04-03** (`5d68668`) feat: dependency ignoring
- **2023-04-03** (`13aaabd`) feat: add debug location flag (#17)
- **2023-04-04** (`bc55101`) docs: update readme (#21)
- **2023-04-04** (`e7a35ce`) fix: if one of the execution fails terminate all the workers
- **2023-04-04** (`92604c1`) docs: introduction to zenith
- **2023-04-04** (`f272bda`) ui: completed stats (#22)
- **2023-04-04** (`4f9e90f`) fix: zenith not throwing errors
- **2023-04-05** (`729dfc3`) feat: log slow projects
- **2023-04-05** (`265033d`) fix: remove console log
- **2023-04-06** (`6c93a04`) feat: added unit test for Hasher (#26)
- **2023-04-06** (`ad54f7f`) chore: changed unit test script for gh actions
- **2023-04-06** (`df48546`) chore: version bump
- **2023-04-06** (`03300fc`) fix: jest config moved to zenith
- **2023-04-06** (`c711c19`) fix: removed @jotforminc/jest-preset-base as its private
- **2023-04-06** (`c621f61`) fix: lockfile update
- **2023-04-06** (`49dbc83`) fix: @swc/core added for tests
- **2023-04-06** (`8523801`) chore: update json file
- **2023-04-06** (`5a5bacb`) docs: add pnpm part
- **2023-04-06** (`733acdd`) chore: make it ready to public publish
- **2023-04-10** (`4716b21`) Update README.md
- **2023-04-11** (`1093e59`) migration: convert to ts (#27)
- **2023-04-11** (`d16a7b9`) Update package.json
- **2023-04-11** (`1379c0c`) Update package.json
- **2023-04-12** (`2aa9841`) chore(zenith): typescript packages added to dev dependencies (#28)
- **2023-04-13** (`ad51154`) fix: ignore empty files when hashing
- **2023-04-13** (`e1af803`) Fix/hashing empty folders (#31)
- **2023-04-14** (`387c96c`) chore: add readme to package files
- **2023-04-14** (`0c0a50e`) refactor: initiate config manager
- **2023-04-24** (`0b49d70`) Style/typescript eslint (#34)
- **2023-04-24** (`a4337bc`) fix: make sure program does not exit with 0 after error is thrown
- **2023-04-25** (`069cd65`) test: add randomized hashing test (#33)
- **2023-04-26** (`512f3ea`) test: missing package json (#35)
- **2023-04-26** (`4fd3085`) fix: lint error in error handling at worker (#36)
- **2023-04-26** (`a89da5d`) fix: npm publish
- **2023-04-26** (`578579e`) fix: add requiredFiles option to targets in zenith.json
- **2023-04-26** (`1a5e082`) style: linter fix
- **2023-04-26** (`314e18f`) fix: build helper test arg
- **2023-05-04** (`860361d`) chore: update package dependencies
- **2023-05-04** (`a7b8198`) fix: jest revert update
- **2023-05-04** (`d6db516`) chore: fix semver version for package.json
- **2023-05-17** (`908b304`) fix: dont log for scripts with no command (#37)
- **2023-05-17** (`1b3959a`) fix: put missing projects if command is not dummy
- **2023-05-17** (`eed478a`) version up (0.9.2)
- **2023-07-19** (`ffed19f`) fix: throw error for circular dependencies (#40)
- **2023-07-19** (`c428468`) chore(deps): bump word-wrap from 1.2.3 to 1.2.4 (#41)
- **2023-07-19** (`f1cfc33`) chore(deps): bump semver from 6.3.0 to 6.3.1 (#39)
- **2023-07-19** (`3e3cc75`) chore(deps): bump tough-cookie from 4.1.2 to 4.1.3 (#38)
- **2023-07-19** (`1f397bc`) test: add mock repo and circular dependency tests
- **2023-09-14** (`3e2da35`) feat: skip dependencies command flag (#42)
- **2023-09-18** (`1310bec`) fix: remove redundant console log
- **2023-09-18** (`251c647`) fix: add root package.json to hash if exists
- **2023-09-20** (`5b12585`) refactor: remove zip-local package (#45)
- **2023-09-26** (`1e7eba9`) feat: local caching (#46)
- **2023-09-27** (`937268a`) feat: hybrid caching (#47)
- **2023-09-27** (`6f72286`) fix: set package version to minor change
- **2023-09-27** (`a78cb88`) Revert "fix: set package version to minor change"
- **2023-09-27** (`2b4e669`) security: update mock repo dependency
- **2023-09-28** (`7e44740`) chore: minor version bump to publish package
- **2023-09-28** (`ad3d9e6`) fix: minor log fix
- **2023-09-28** (`73f551e`) debug: add cache debug checks temporarily
- **2023-09-28** (`a7ff4b3`) feat: remove unzipper package and fix unzipping bugs and performance improvements (#48)
- **2023-09-29** (`b6000c9`) fix: zipper performance and bug fixes
- **2023-09-29** (`be75fc1`) perf: increase zipper performance
- **2023-09-29** (`6113ed4`) fix: remove console log
- **2023-09-29** (`7eba098`) fix: error when root lib or build does not exist
- **2023-10-02** (`31a39d7`) perf: do not recover caches when output is stdout and log affected is on
- **2023-10-02** (`9daaebd`) style: add error on console log
- **2023-10-03** (`aa15984`) feat: skip on script not found at package json flag added (#50)
- **2023-10-03** (`0206bb2`) fix: images being corrupted on zip (#51)
- **2023-10-03** (`4c80c1d`) v1.4.0
- **2023-10-19** (`298e960`) feat: add no cache option (#53)
- **2023-11-13** (`899ac55`) doc: update readme
- **2023-11-15** (`d34a6db`) feat: skip dummy commands (#54)
- **2023-11-30** (`2662d93`) feat: add .gitignore to ignored files
- **2023-11-30** (`9becbcb`) chore: update version
- **2023-11-30** (`933c0ae`) fix: package manager in package.json
- **2023-12-05** (`65f0cb2`) fix: update hash before skipping projects
- **2023-12-28** (`e8ed01b`) feat: piping (#56)
- **2023-12-28** (`d932dc3`) fix(cacher): dont skip stdouts
- **2023-12-28** (`9085465`) feat: enable different config files
- **2023-12-28** (`9c01697`) fix: remove unreadable text color

### 2024
- **2024-01-03** (`9738b5c`) feat: read js config and add onFail to config (#57)
- **2024-01-03** (`1ef70a0`) fix: send more details for onFail
- **2024-02-20** (`71fc24a`) refactor: single or project-by-project builder
- **2024-02-20** (`f80fada`) feat: run single command
- **2024-02-20** (`bfaa8b2`) chore: version up
- **2024-03-14** (`a3b4e09`) fix: use build config single cache
- **2024-05-08** (`8956063`) chore: delete pnpm lock
- **2024-05-08** (`4909397`) chore(deps): bump @babel/traverse from 7.23.0 to 7.24.5 (#60)
- **2024-05-09** (`00b1908`) fix: single build does not cache correctly (#61)
- **2024-05-13** (`59c1f18`) fix: single build log errors
- **2024-05-13** (`9c2822d`) chore: fix wrong versioning
- **2024-07-08** (`ebea2eb`) feat(graph): zenith graph initial (#64)
- **2024-07-08** (`e71ce9c`) chore: v2.5.0
- **2024-07-08** (`eed3635`) chore: change zenith config extension
- **2024-09-03** (`ac6a00e`) chore(deps): bump micromatch from 4.0.5 to 4.0.8 (#68)
- **2024-11-05** (`d019785`) feat: correct timing for cache mismatches
- **2024-11-05** (`3f7ea5f`) feat: table output on execution summary
- **2024-11-05** (`1272d80`) chore: bump version

### 2025
- **2025-03-25** (`dbe1166`) feat: add onlyDependencies option (#72)
- **2025-07-21** (`c3dfc10`) Feat additional files config (#74)
- **2025-07-23** (`230d8c0`) fix: add projects from constant dependencies during first initialization (#75)
- **2025-10-08** (`f1d526d`) feat: callback function invoke added to after get hash function

### 2026
- **2026-05-05** (`48226a2`) perf(hasher): async hashing and faster empty-directory checks
- **2026-05-05** (`84ecd5d`) fix(cache): stream zip artifacts, harden remote S3 client, path-style option
- **2026-05-05** (`0214ae3`) docs(dev): document S3 endpoint options and add MinIO compose stack
- **2026-05-05** (`dd41c51`) chore(release): 2.9.0
- **2026-05-05** (`533f39e`) chore(publish): new npm token variable
- **2026-05-06** (`876c8e6`) chore(deps): add tar and @aws-sdk/lib-storage
- **2026-05-06** (`be1b718`) chore(minio): add node MinIO helpers and cache format benchmark
- **2026-05-06** (`15570cc`) feat(cache): pluggable zip/files/tar/blobs/auto formats and layout keys
- **2026-05-06** (`189149e`) fix(remote): multipart Upload for large streamed S3 puts
- **2026-05-06** (`11b8d50`) test(cache): round-trip specs for zip, tar, files, and blobs
- **2026-05-06** (`4c161cd`) docs(readme): cache formats, --cache-format, MinIO and benchmark

---

_To regenerate this section:_

```bash
git log --reverse --format='%ad|%h|%s' --date=short
```


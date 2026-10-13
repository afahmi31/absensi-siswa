# LAB002-REL-CLEAN-001 — Local release preparation report

Date: 2026-10-13

## Result

The isolated runtime tree installed and built successfully with Node.js 24.19.0 and npm 10.9.3. The generated Vercel function metadata reports `nodejs24.x`.

## Release files

- Prepared tree: `D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa\app\.data\release-prepared\release-2026-10-13T09-33-28-122Z-18e5a923-d9d2-42e4-adca-23eaacbd11ee\site`
- File manifest: `D:\ayaa-wae-studio\Labs\LAB-002-website-absensi-siswa\app\.data\release-prepared\release-2026-10-13T09-33-28-122Z-18e5a923-d9d2-42e4-adca-23eaacbd11ee\release-manifest.json`
- Manifest covers 64 source/config/package files before install and build outputs were generated.

The generator copies tracked website files and required build configuration into a new ignored `.data` directory. It excludes development docs, test and top-level script trees, migration files and migration tooling, local data, credentials, and generated/cache directories. It rejects untracked files inside the website source directories and audits relative imports against the prepared tree. `h3` is used by application code and is recorded as a lockfile-backed production transitive dependency; no dependency was added.

## Changes in the develop source tree

- Added `vercel.json` with install and build commands that invoke npm 10.9.3 through `npx`.
- Added `scripts/prepare-release.mjs` to build an isolated, tracked-file-only release tree and its SHA-256 manifest.

No application behavior, package manifest, lockfile, branch, deployment, cloud database, local teacher data, or running application output was changed.

## Verification

- Generator syntax check: passed.
- Release generator: passed; 64 files, two external imports.
- Pinned npm resolution: npm 10.9.3.
- Clean install: `npm ci` passed; 628 packages installed and Nuxt generated `.nuxt` types. npm emitted a deprecation warning for transitive `glob@10.5.0`.
- Vercel build: `nuxt build --preset vercel` passed; Nitro generated `.vercel/output` (about 3.03 MB, 787 kB gzip) and the function metadata reports `nodejs24.x`.
- `vercel.json` parsing and `git diff --check`: passed.
- The parent PM independently checked the manifest hashes and confirmed its inventory did not contain docs, tests, or credential matches.

## Verification limits

This verifies a local isolated install and build only. It does not verify a Vercel project link, remote Vercel build, deployment, live HTTP behavior, or production environment configuration. Type checking and the application test suites were not run as part of this release packaging task. The generated `.nuxt`, `.vercel`, and `node_modules` directories are local verification output under the ignored `.data` release tree; they are not listed in the source-file manifest.

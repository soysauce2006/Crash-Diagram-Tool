#!/usr/bin/env node
    /**
    * validate-release.mjs
    *
    * Usage:  pnpm run validate-release 1.2.0
    *
    * Checks that artifacts/accident-diagram/package.json version matches the
    * supplied version string so you catch mismatches before tagging.
    */

    import { readFileSync } from 'fs';
    import { fileURLToPath } from 'url';
    import { join, dirname } from 'path';

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(__dirname, '..', 'package.json');

    const expectedVersion = process.argv[2];

    if (!expectedVersion) {
    console.error('Usage: pnpm run validate-release <version>  (e.g. 1.2.0)');
    process.exit(1);
    }

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

    if (pkg.version !== expectedVersion) {
    console.error(`❌  Version mismatch:`);
    console.error(`    package.json has:  "${pkg.version}"`);
    console.error(`    Expected:          "${expectedVersion}"`);
    console.error('');
    console.error('    Update the version field in artifacts/accident-diagram/package.json');
    console.error('    and commit the change before tagging.');
    process.exit(1);
    }

    console.log(`✅  package.json version matches: ${pkg.version}`);
    console.log('');
    console.log('Ready to tag:');
    console.log(`  git tag v${pkg.version}`);
    console.log(`  git push origin v${pkg.version}`);
    
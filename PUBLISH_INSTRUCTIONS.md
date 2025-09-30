# Publishing V2.0.0 to npm

## Prerequisites
1. Make sure you are logged in to npm: `npm whoami`
2. If not logged in, run: `npm login`
3. Ensure you have publish permissions for the `node-red-contrib-acepro` package

## Steps to Publish

1. **Verify the package is ready:**
   ```bash
   npm pack --dry-run
   ```
   This should show version 2.0.0 and all expected files.

2. **Run tests to ensure everything works:**
   ```bash
   npm test
   ```
   All tests should pass.

3. **Publish to npm:**
   ```bash
   npm publish
   ```

4. **Verify publication:**
   ```bash
   npm info node-red-contrib-acepro
   ```
   This should show version 2.0.0 as the latest version.

## What was Changed

- Updated `aceprolib.js` version from "1.3.7" to "2.0.0" to match `package.json`
- Updated test file to expect version "2.0.0"
- Fixed repository URL in `package.json` to use the git+ format
- All tests pass and the package is ready for publication

## Current Status
✅ Package version: 2.0.0
✅ Tests: All passing
✅ Package validation: Ready for npm publish
✅ No breaking changes in the codebase
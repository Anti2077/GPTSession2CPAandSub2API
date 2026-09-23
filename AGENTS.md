# Repository Guidelines

## Project Structure & Module Organization

This repository is a static browser tool for converting OpenAI/Codex session data into Sub2API account JSON.

- `docs/` contains the deployable Cloudflare Pages site. `docs/index.html` is the entry point; JavaScript lives in `docs/js/`, and styles in `docs/css/`.
- `docs/js/sub2api.js` contains pure conversion and validation policy shared with Node tests.
- `docs/js/converter.js` handles session parsing and output generation; `docs/js/settings-ui.js` renders the configuration and template editor.
- `tests/` contains Node unit tests, Playwright browser tests, and disposable integration-test assets.
- `scripts/serve.js` serves `docs/` locally. `README.md` and `VERIFICATION.md` document deployment and verification details.

## Build, Test, and Development Commands

Run these commands from the repository root:

- `npm test` runs session-conversion tests and Node unit tests.
- `npm run test:browser` runs the Playwright UI suite.
- `npm run serve` starts the local static server for manual inspection.
- `npm run format` formats source, tests, and configuration with Prettier.
- `npm run format:check` verifies formatting without changing files.

The site is deployed as static files from `docs/`; there is no application build step.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons, double quotes, and Prettier formatting. Keep browser code dependency-free and preserve the pure-policy boundary in `docs/js/sub2api.js`. Use descriptive lower-case filenames, camelCase JavaScript identifiers, and `SCREAMING_SNAKE_CASE` only for constants such as storage keys. Do not add real account tokens, proxy passwords, or private exports to fixtures, logs, screenshots, or commits.

## Testing Guidelines

Node tests use the built-in `node:test` module; browser tests use Playwright and are located in `tests/browser/`. Name tests after observable behavior, for example `group IDs can be set...`. When changing conversion rules, update both unit and browser coverage. Run `npm test`, `npm run test:browser`, `npm run format:check`, and `git diff --check` before submitting.

## Commit & Pull Request Guidelines

Use imperative, specific commit subjects such as `Add Sub2API account group configuration` or `Verify empty account groups in integration import`. Keep commits focused. Pull requests should explain the user-visible behavior, list validation commands and results, describe any compatibility implications for Sub2API JSON, and include screenshots for UI changes. Mention Cloudflare Pages impact when deployment files or `docs/` behavior changes.

## Security & Configuration Tips

Treat imported JSON as sensitive input. Keep credentials local, avoid network requests from the converter, and validate every user-editable field before generating output. Group IDs belong to the target Sub2API instance and may not match across installations.

# Contributing

Thanks for your interest in improving Leveza! Before opening a pull request, please follow these steps to keep the workspace healthy and consistent.

## Local setup

- Install the repository's canonical toolchain:

  ```bash
  nvm install
  npm install --global --ignore-scripts --allow-remote=all npm@12.0.1
  ```

  Normal development commands accept any npm 12 release. Use npm 12.0.1 when changing `package.json` or `package-lock.json`, or when reproducing CI locally.

- Install dependencies from the lockfile: `npm ci`
- Copy `.env.example` (and `apps/server/.env.example` / `apps/mobile/.env.example` if needed) and fill in any local values.

## Development workflow

- Start the backend: `npm run start` (Next.js dev server)
- Start the Expo app: `npm run dev:mobile`
- Run lint checks: `npm run lint`
- Run type checks: `npm run typecheck`
- Run tests: `npm run test`
- Build for release (server + mobile): `npm run build`

## Local CI verification

Run the validation job locally without provider, billing, or production secrets:

```bash
test "$(node --version)" = "v24.16.0"
test "$(npm --version)" = "12.0.1"
npm ci
npm install-scripts ls
npx nx sync:check
npm run validate:nx-targets
npm run validate:openspec -- --all
npx nx run-many -t lint,typecheck,test,build --outputStyle=static
```

When an active OpenSpec change is modified, validate it by name:

```bash
npm run validate:openspec -- <change-name>
```

Run the Docker image-build job locally with:

```bash
docker build -f docker/Dockerfile.server -t leveza-server:ci .
docker build -f docker/Dockerfile.migrate -t leveza-migrate:ci .
```

## Pull requests

- Keep changes focused and avoid committing generated artifacts (build output, platform-specific binaries, etc.).
- Ensure lint and test commands pass locally before opening a PR.
- If you touch documentation, keep instructions concise and up to date with the current scripts.

## Legal & License

By contributing to this project, you agree that your contributions will be licensed under the project's [AGPLv3 License](./LICENSE). However, you also grant **OpenVibe Labs LLC** a non-exclusive, irrevocable, worldwide, royalty-free, sublicensable, transferable license to use, reproduce, prepare derivative works of, distribute, publicly perform, and publicly display your contributions.

This grant allows OpenVibe Labs LLC to include your contributions in future versions of the software, including proprietary or commercial editions, without restriction.

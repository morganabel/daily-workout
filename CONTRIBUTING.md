# Contributing

Thanks for your interest in improving Workout Agent CE! Before opening a pull request, please follow these steps to keep the workspace healthy and consistent.

## Local setup
- Install dependencies: `npm install`
- Copy `.env.example` (and `apps/server/.env.example` / `apps/mobile/.env.example` if needed) and fill in any local values.

## Development workflow
- Start the backend: `npm run start` (Next.js dev server)
- Start the Expo app: `npm run dev:mobile`
- Run lint checks: `npm run lint`
- Run tests: `npm run test`
- Build for release (server + mobile): `npm run build`

## Pull requests
- Keep changes focused and avoid committing generated artifacts (build output, platform-specific binaries, etc.).
- Ensure lint and test commands pass locally before opening a PR.
- If you touch documentation, keep instructions concise and up to date with the current scripts.

## Legal & License
By contributing to this project, you agree that your contributions will be licensed under the project's [AGPLv3 License](./LICENSE). However, you also grant **OpenVibe Labs LLC** a non-exclusive, irrevocable, worldwide, royalty-free, sublicensable, transferable license to use, reproduce, prepare derivative works of, distribute, publicly perform, and publicly display your contributions.

This grant allows OpenVibe Labs LLC to include your contributions in future versions of the software, including proprietary or commercial editions, without restriction.

// Runs before `npm run build` (via the "prebuild" script). Render's build command for this service is
// just `npm run build`, so it reuses the node_modules cached from the last successful deploy and never
// installs newly added dependencies, which fails the build with "failed to resolve import". On Render
// (RENDER=true) install from the lockfile first; locally this does nothing.
import { execSync } from 'node:child_process';

if (process.env.RENDER) {
  console.log('[prebuild] Render detected: installing dependencies from package-lock.json');
  execSync('npm ci --include=dev --no-audit --no-fund', { stdio: 'inherit' });
}

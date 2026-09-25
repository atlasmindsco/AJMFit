/**
 * Resolves the project's "@/..." path alias for the tools/verify-*.ts scripts.
 *
 * Those scripts run the real library modules under node's type stripping so
 * the logic under test is the logic that ships. Node does not read tsconfig
 * paths, so without this a verifier can only test modules that happen to have
 * no aliased imports -- which would quietly push the source towards being
 * shaped by the test runner rather than by what the app needs.
 *
 * Usage: node --experimental-strip-types --import ./tools/_alias-hook.mjs <script>
 */
import { registerHooks } from 'node:module'

const root = new URL('../', import.meta.url)

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      let url = new URL(specifier.slice(2), root).href
      if (!/\.[a-zA-Z0-9]+$/.test(url)) url += '.ts'
      return { url, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})

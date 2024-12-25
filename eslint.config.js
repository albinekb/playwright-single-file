import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import { includeIgnoreFile } from '@eslint/compat'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const gitignorePath = path.resolve(__dirname, '.gitignore')

const bundleIgnores = [
  '**/single-file-bundle.js',
  '**/test/**/*',
  '**/dist/**/*',
]

const ignoreFileIgnores = includeIgnoreFile(gitignorePath)
const ignores = [...bundleIgnores, ...ignoreFileIgnores.ignores]

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores,
  },

  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended.map((config) =>
    config.files ? { ...config, ignores } : config,
  ),
  {
    rules: {
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]

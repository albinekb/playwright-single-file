import { build } from 'esbuild'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

async function main() {
  const __dirname = fileURLToPath(new URL('.', import.meta.url))
  const rootDir = path.join(__dirname, '..')
  const nodeModulesPath = path.join(rootDir, 'node_modules')
  const outDir = path.join(rootDir, 'src/lib/vendor')

  const singlefileCorePath = path.join(
    nodeModulesPath,
    'single-file-core',
    'single-file.js',
  )
  const copyrightNotice = await getCopyrightNotice(singlefileCorePath)

  await build({
    entryPoints: [singlefileCorePath],
    bundle: true,
    globalName: 'singlefile',
    outdir: outDir,
    platform: 'browser',
    sourcemap: false,
    minify: true,
    format: 'iife',
    plugins: [],
  })

  await build({
    entryPoints: [
      path.join(
        nodeModulesPath,
        'single-file-core',
        'single-file-bootstrap.js',
      ),
    ],
    bundle: true,
    globalName: 'singlefileBootstrap',
    outdir: outDir,
    platform: 'browser',
    sourcemap: false,
    minify: true,
    format: 'iife',
    plugins: [],
  })

  await build({
    entryPoints: [
      path.join(
        nodeModulesPath,
        'single-file-core',
        'single-file-hooks-frames.js',
      ),
    ],
    bundle: true,
    outdir: outDir,
    platform: 'browser',
    sourcemap: false,
    minify: true,
    format: 'iife',
    plugins: [],
  })

  await build({
    entryPoints: [
      path.join(
        nodeModulesPath,
        'single-file-core',
        'vendor',
        'zip',
        'zip.min.js',
      ),
    ],
    bundle: true,
    globalName: 'zip',
    outdir: outDir,
    platform: 'browser',
    sourcemap: false,
    minify: true,
    format: 'iife',
    plugins: [],
  })

  const SCRIPTS = [
    path.join(outDir, 'single-file.js'),
    path.join(outDir, 'single-file-bootstrap.js'),
    path.join(outDir, 'zip.min.js'),
  ]

  let script = ''
  const sources = await Promise.all(
    SCRIPTS.map((script) => fs.readFile(script, 'utf8')),
  )
  script += '\nconst script = ' + JSON.stringify(sources.join(';')) + ';'
  const hookScript = await fs.readFile(
    path.join(outDir, 'single-file-hooks-frames.js'),
    'utf8',
  )
  script += '\nconst hookScript = ' + JSON.stringify(hookScript) + ';'
  const zipScript = await fs.readFile(path.join(outDir, 'zip.min.js'), 'utf8')
  script += '\nconst zipScript = ' + JSON.stringify(zipScript) + ';'
  script += '\nexport { script, zipScript, hookScript };'

  script = copyrightNotice + '\n' + script

  await fs.writeFile(path.join(outDir, 'single-file-bundle.js'), script)
  await Promise.all(SCRIPTS.map((script) => fs.unlink(script)))
  await fs.unlink(path.join(outDir, 'single-file-hooks-frames.js'))
}

main().catch(console.error)

async function getCopyrightNotice(filePath: string) {
  const content = await fs.readFile(filePath, 'utf8')
  // Read the first comment block
  const match = content.match(/^\s*\/\*([\s\S]*?)\*\//)
  if (!match) {
    throw new Error('No copyright notice found')
  }
  return match[0]
}

#!/usr/bin/env node
import { execSync, spawn } from 'node:child_process'
import { readdir, readdirSync, readFile, readFileSync, rm, writeFile } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, promisify } from 'node:util'

const readdirAsync = promisify(readdir)
const readFileAsync = promisify(readFile)
const rmAsync = promisify(rm)
const writeFileAsync = promisify(writeFile)

type PackageSpec = {
  sourceName: string
  targetName: string
  packageDir: string
}

type PublishContext = {
  dryRun: boolean
  keepStaging: boolean
  otp?: string
  registry?: string
  stageRoot: string
  tag: string
  targetVersion?: string
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const { values } = parseArgs({
  allowPositionals: false,
  options: {
    version: {
      type: 'string',
    },
    tag: {
      type: 'string',
      default: 'latest',
    },
    scope: {
      type: 'string',
      default: 'thomasjahoda-forks',
    },
    'dry-run': {
      type: 'boolean',
      default: false,
    },
    'skip-build': {
      type: 'boolean',
      default: false,
    },
    'keep-staging': {
      type: 'boolean',
      default: false,
    },
    all: {
      type: 'boolean',
      default: false,
    },
    packages: {
      type: 'string',
    },
    'upstream-ref': {
      type: 'string',
      default: 'upstream/main',
    },
    otp: {
      type: 'string',
    },
    registry: {
      type: 'string',
    },
    'stage-dir': {
      type: 'string',
    },
  },
})

const scope = normalizeScope(values.scope)

function createDefaultVersion(): string {
  const corePkg = JSON.parse(readFileSync(path.join(repoRoot, 'packages', 'core', 'package.json'), 'utf8'))
  const baseVersion = corePkg.version
  const now = new Date()
  const dt = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ].join('')
  return `${baseVersion}-fork.${dt}`
}

const targetVersion = values.version ?? createDefaultVersion()
const stageRoot =
  values['stage-dir'] === undefined
    ? path.join(
        os.tmpdir(),
        `tiptap-fork-publish-${targetVersion.replace(/[^a-zA-Z0-9.-]+/g, '-')}`,
      )
    : path.resolve(repoRoot, values['stage-dir'])

function discoverPackages(): PackageSpec[] {
  const specs: PackageSpec[] = []
  const bases = ['packages', 'packages-deprecated']

  for (const base of bases) {
    const basePath = path.join(repoRoot, base)
    let entries: string[]
    try {
      entries = readdirSync(basePath)
    } catch {
      continue
    }

    for (const entry of entries) {
      const packageDir = path.join(basePath, entry)
      const pkgJsonPath = path.join(packageDir, 'package.json')
      try {
        const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
        if (!pkgJson.name || pkgJson.private) {
          continue
        }
        const sourceName: string = pkgJson.name
        if (!sourceName.startsWith('@tiptap/')) {
          continue
        }
        const shortName = sourceName.slice('@tiptap/'.length)
        const targetName = `${scope}/tiptap-${shortName}`
        specs.push({ sourceName, targetName, packageDir })
      } catch {
        // ignore unreadable/missing package.json
      }
    }
  }

  // Sort so dependencies are published after dependents where possible
  const priority = (name: string): number => {
    if (name === '@tiptap/core') {return 0}
    if (name === '@tiptap/pm') {return 1}
    if (name === '@tiptap/extension-document') {return 2}
    if (name === '@tiptap/extension-text') {return 3}
    if (name === '@tiptap/extension-paragraph') {return 4}
    if (name === '@tiptap/extensions') {return 5}
    if (name === '@tiptap/html') {return 6}
    if (name === '@tiptap/markdown') {return 7}
    if (name === '@tiptap/suggestion') {return 8}
    if (name === '@tiptap/static-renderer') {return 9}
    if (name === '@tiptap/react') {return 100}
    if (name === '@tiptap/vue-2') {return 101}
    if (name === '@tiptap/vue-3') {return 102}
    if (name === '@tiptap/starter-kit') {return 103}
    return 50
  }

  specs.sort((a, b) => priority(a.sourceName) - priority(b.sourceName))

  return specs
}

function getChangedPackages(allSpecs: PackageSpec[], upstreamRef: string): PackageSpec[] {
  let changedFiles: string[]
  try {
    const output = execSync(`git diff ${upstreamRef} --name-only`, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    changedFiles = output.trim().split('\n').filter(Boolean)
  } catch (error) {
    console.warn(`Could not determine changed files from ${upstreamRef}:`, (error as Error).message)
    return []
  }

  const changedPackages = new Set<string>()
  for (const file of changedFiles) {
    for (const spec of allSpecs) {
      const relativePackageDir = path.relative(repoRoot, spec.packageDir)
      if (file.startsWith(`${relativePackageDir  }/`)) {
        changedPackages.add(spec.sourceName)
      }
    }
  }

  return allSpecs.filter(spec => changedPackages.has(spec.sourceName))
}

const allPackageSpecs = discoverPackages()

let packageSpecs: PackageSpec[]
if (values.all) {
  packageSpecs = allPackageSpecs
} else if (values.packages) {
  const selected = new Set(values.packages.split(',').map(p => p.trim()))
  packageSpecs = allPackageSpecs.filter(spec => selected.has(spec.sourceName) || selected.has(path.basename(spec.packageDir)))
  const unknown = [...selected].filter(name => !packageSpecs.some(spec => spec.sourceName === name || path.basename(spec.packageDir) === name))
  if (unknown.length > 0) {
    console.warn(`Warning: unknown package selections: ${unknown.join(', ')}`)
  }
} else {
  packageSpecs = getChangedPackages(allPackageSpecs, values['upstream-ref'])
}

async function main() {
  if (allPackageSpecs.length === 0) {
    throw new Error('No publishable @tiptap packages found')
  }

  if (packageSpecs.length === 0) {
    console.log('No packages to publish.')
    console.log(`No changes detected relative to ${values['upstream-ref']}.`)
    console.log('Use --all to publish everything, or --packages to select specific packages.')
    return
  }

  const context: PublishContext = {
    dryRun: values['dry-run'],
    keepStaging: values['keep-staging'] || values['dry-run'],
    otp: values.otp,
    registry: values.registry,
    stageRoot,
    tag: values.tag,
    targetVersion,
  }

  console.log(`Publishing Tiptap fork packages under ${scope}`)
  console.log(`Version: ${context.targetVersion}`)
  console.log(`Tag: ${context.tag}`)
  console.log(`Stage root: ${context.stageRoot}`)
  console.log(`Packages to publish: ${packageSpecs.length} / ${allPackageSpecs.length}`)
  for (const spec of packageSpecs) {
    console.log(`  - ${spec.sourceName} -> ${spec.targetName}`)
  }
  if (context.dryRun) {
    console.log('Dry run: npm publish will not write anything to the registry')
  }

  await prepareStageRoot(context.stageRoot)

  try {
    if (!values['skip-build']) {
      console.log('\nBuilding workspace...')
      await runCommand('pnpm', ['build'], { cwd: repoRoot })
    }

    const stagedPackages: Array<{ spec: PackageSpec; stagedDir: string }> = []
    for (const spec of packageSpecs) {
      const stagedDir = await stagePackage(spec, context)
      stagedPackages.push({ spec, stagedDir })
    }

    console.log('\nStaged packages:')
    for (const { spec, stagedDir } of stagedPackages) {
      console.log(`- ${spec.sourceName} -> ${spec.targetName} (${stagedDir})`)
    }

    for (const { spec, stagedDir } of stagedPackages) {
      await publishPackage(spec, stagedDir, context)
    }
  } finally {
    if (context.keepStaging) {
      console.log(`\nKept staged packages at ${context.stageRoot}`)
    } else {
      await rmAsync(context.stageRoot, { force: true, recursive: true })
    }
  }
}

async function prepareStageRoot(stageDir: string) {
  await rmAsync(stageDir, { force: true, recursive: true })
  await runCommand('mkdir', ['-p', stageDir], { cwd: repoRoot })
}

async function stagePackage(spec: PackageSpec, context: PublishContext): Promise<string> {
  console.log(`\nPacking ${spec.sourceName}...`)

  const tarballDir = path.join(context.stageRoot, 'tarballs', safeDirName(spec.targetName))
  const extractRoot = path.join(context.stageRoot, 'packages', safeDirName(spec.targetName))
  await runCommand('mkdir', ['-p', tarballDir], { cwd: repoRoot })
  await runCommand('mkdir', ['-p', extractRoot], { cwd: repoRoot })

  await runCommand('pnpm', ['pack', '--pack-destination', tarballDir], { cwd: spec.packageDir })

  const tarballs = (await readdirAsync(tarballDir)).filter(entry => entry.endsWith('.tgz'))
  if (tarballs.length !== 1) {
    throw new Error(`Expected exactly one tarball for ${spec.sourceName}, found ${tarballs.length}`)
  }

  const tarballPath = path.join(tarballDir, tarballs[0])
  await runCommand('tar', ['-xzf', tarballPath, '-C', extractRoot], { cwd: repoRoot })

  const stagedDir = path.join(extractRoot, 'package')
  await rewriteManifest(stagedDir, spec, context)

  return stagedDir
}

async function rewriteManifest(stagedDir: string, spec: PackageSpec, context: PublishContext) {
  const packageJsonPath = path.join(stagedDir, 'package.json')
  const packageJson = JSON.parse(await readFileAsync(packageJsonPath, 'utf8'))

  packageJson.name = spec.targetName
  if (context.targetVersion) {
    packageJson.version = context.targetVersion
  }
  packageJson.publishConfig = {
    ...packageJson.publishConfig,
    access: 'public',
  }

  await writeFileAsync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
}

async function publishPackage(spec: PackageSpec, stagedDir: string, context: PublishContext) {
  const version =
    context.targetVersion ??
    JSON.parse(await readFileAsync(path.join(stagedDir, 'package.json'), 'utf8')).version
  console.log(`\nPublishing ${spec.targetName}@${version}...`)

  const args = [
    'publish',
    '--access',
    'public',
    '--tag',
    context.tag,
    '--ignore-scripts',
    ...(context.dryRun ? ['--dry-run'] : []),
    ...(context.otp ? ['--otp', context.otp] : []),
    ...(context.registry ? ['--registry', context.registry] : []),
  ]

  await runCommand('npm', args, { cwd: stagedDir })
}

function runCommand(command: string, args: string[], options: { cwd: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: 'inherit',
      shell: false,
    })

    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command "${command} ${args.join(' ')}" exited with code ${code}`))
      }
    })
  })
}

function normalizeScope(input: string): string {
  const trimmed = input.trim()
  if (trimmed.length === 0) {
    throw new Error('Scope cannot be empty')
  }
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`
}

function safeDirName(packageName: string): string {
  return packageName.replace(/[\\/]/g, '__')
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})

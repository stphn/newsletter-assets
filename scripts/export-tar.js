import fs from 'fs-extra'
import archiver from 'archiver'
import path from 'path'
import chalk from 'chalk'
import ora from 'ora'

const spinner = ora('Creating TAR archives...').start()

async function createTarArchive(sourceDir, outputPath, description) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath)
    const archive = archiver('tar', {
      gzip: true,
      gzipOptions: {
        level: 9,
      },
    })

    output.on('close', () => {
      const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2)
      spinner.text = `${description}: ${sizeInMB}MB`
      resolve()
    })

    archive.on('error', reject)
    archive.pipe(output)

    // Add directory contents
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}

async function exportTar() {
  try {
    // Ensure exports directory exists
    await fs.ensureDir('exports/archives')

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const baseFileName = `newsletter-${timestamp}`

    const archives = []

    // Check what directories exist and create archives accordingly
    if (await fs.pathExists('dist')) {
      const htmlArchive = `exports/archives/${baseFileName}-html.tar.gz`
      await createTarArchive('dist', htmlArchive, 'HTML archive')
      archives.push({ type: 'HTML', path: htmlArchive })
    }

    if (await fs.pathExists('exports/html')) {
      const exportHtmlArchive = `exports/archives/${baseFileName}-export-html.tar.gz`
      await createTarArchive('exports/html', exportHtmlArchive, 'Export HTML archive')
      archives.push({ type: 'Export HTML', path: exportHtmlArchive })
    }

    if (await fs.pathExists('exports/outlook')) {
      const outlookArchive = `exports/archives/${baseFileName}-outlook.tar.gz`
      await createTarArchive('exports/outlook', outlookArchive, 'Outlook archive')
      archives.push({ type: 'Outlook', path: outlookArchive })
    }

    // Create source archive (MJML files)
    if ((await fs.pathExists('components')) || (await fs.pathExists('src'))) {
      const sourceArchive = `exports/archives/${baseFileName}-source.tar.gz`
      const archive = archiver('tar', { gzip: true, gzipOptions: { level: 9 } })
      const output = fs.createWriteStream(sourceArchive)

      await new Promise((resolve, reject) => {
        output.on('close', resolve)
        archive.on('error', reject)
        archive.pipe(output)

        // Add MJML source files
        if (fs.pathExistsSync('components')) {
          archive.directory('components', 'components')
        }
        if (fs.pathExistsSync('src')) {
          archive.directory('src', 'src')
        }

        // Add main MJML files
        archive.glob('*.mjml')
        archive.file('package.json', { name: 'package.json' })

        archive.finalize()
      })

      archives.push({ type: 'Source', path: sourceArchive })
    }

    // Create complete archive with everything
    const completeArchive = `exports/archives/${baseFileName}-complete.tar.gz`
    const completeOutput = fs.createWriteStream(completeArchive)
    const completeArchiver = archiver('tar', { gzip: true, gzipOptions: { level: 9 } })

    await new Promise((resolve, reject) => {
      completeOutput.on('close', resolve)
      completeArchiver.on('error', reject)
      completeArchiver.pipe(completeOutput)

      // Add all relevant directories
      ;['dist', 'exports/html', 'exports/outlook', 'components', 'src'].forEach((dir) => {
        if (fs.pathExistsSync(dir)) {
          completeArchiver.directory(dir, dir)
        }
      })

      // Add individual files
      ;['package.json', '*.mjml', 'README.md'].forEach((pattern) => {
        completeArchiver.glob(pattern)
      })

      completeArchiver.finalize()
    })

    archives.push({ type: 'Complete', path: completeArchive })

    // Create manifest file
    const manifest = {
      created: new Date().toISOString(),
      archives: archives.map((archive) => ({
        type: archive.type,
        filename: path.basename(archive.path),
        size: fs.statSync(archive.path).size,
      })),
    }

    await fs.writeFile(
      `exports/archives/${baseFileName}-manifest.json`,
      JSON.stringify(manifest, null, 2),
    )

    spinner.succeed(chalk.green(`✅ Created ${archives.length} TAR archives in exports/archives/`))

    console.log(chalk.blue('\\n📦 Archive Summary:'))
    archives.forEach((archive) => {
      const stats = fs.statSync(archive.path)
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
      console.log(chalk.green(`   ✓ ${archive.type}: ${path.basename(archive.path)} (${sizeMB}MB)`))
    })
  } catch (error) {
    spinner.fail(chalk.red(`❌ TAR export failed: ${error.message}`))
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exportTar()
}

export { exportTar }

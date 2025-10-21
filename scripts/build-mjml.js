import mjml2html from 'mjml'
import fs from 'fs-extra'
import path from 'path'
import { glob } from 'glob'
import chalk from 'chalk'
import ora from 'ora'

const spinner = ora('Building MJML files...').start()

async function buildMJML() {
  try {
    // Ensure dist directory exists
    await fs.ensureDir('dist')

    // Find all MJML files, excluding components directory
    let mjmlFiles = await glob(['src/**/*.mjml', '*.mjml', '!node_modules/**/*.mjml'])

    // Filter out component files
    mjmlFiles = mjmlFiles.filter((file) => !file.includes('/components/'))

    spinner.text = `Found ${mjmlFiles.length} MJML files to process`

    const results = []

    for (const file of mjmlFiles) {
      try {
        const mjmlContent = await fs.readFile(file, 'utf8')
        const { html, errors } = mjml2html(mjmlContent, {
          filePath: file,
          actualPath: path.dirname(file),
        })

        if (errors.length > 0) {
          console.warn(chalk.yellow(`⚠️  Warnings in ${file}:`))
          errors.forEach((error) => console.warn(chalk.yellow(`   ${error.message}`)))
        }

        // Generate output path - flatten structure, remove src/ prefix
        const relativePath = path.relative('.', file)
        let outputFileName = path.basename(relativePath, '.mjml') + '.html'

        // If file is in src/, put it directly in dist/
        // Otherwise preserve the directory structure
        let outputPath
        if (relativePath.startsWith('src/')) {
          outputPath = path.join('dist', outputFileName)
        } else {
          outputPath = path.join('dist', relativePath.replace('.mjml', '.html'))
        }

        // Ensure output directory exists
        await fs.ensureDir(path.dirname(outputPath))

        // Write HTML file
        await fs.writeFile(outputPath, html)

        results.push({
          input: file,
          output: outputPath,
          success: true,
        })

        spinner.text = `Processed ${file}`
      } catch (error) {
        console.error(chalk.red(`❌ Error processing ${file}: ${error.message}`))
        results.push({
          input: file,
          output: null,
          success: false,
          error: error.message,
        })
      }
    }

    spinner.succeed(
      chalk.green(
        `✅ Successfully built ${results.filter((r) => r.success).length}/${results.length} files`,
      ),
    )

    // Log results
    console.log(chalk.blue('\\n📄 Build Results:'))
    results.forEach((result) => {
      if (result.success) {
        console.log(chalk.green(`   ✓ ${result.input} → ${result.output}`))
      } else {
        console.log(chalk.red(`   ✗ ${result.input} - ${result.error}`))
      }
    })

    return results
  } catch (error) {
    spinner.fail(chalk.red(`❌ Build failed: ${error.message}`))
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildMJML()
}

export { buildMJML }

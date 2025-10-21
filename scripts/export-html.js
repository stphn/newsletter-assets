import fs from 'fs-extra'
import path from 'path'
import { glob } from 'glob'
import chalk from 'chalk'
import ora from 'ora'

const spinner = ora('Exporting HTML files...').start()

async function exportHTML() {
  try {
    // Ensure exports directory exists
    await fs.ensureDir('exports/html')

    // Find all HTML files in dist
    const htmlFiles = await glob('dist/**/*.html')

    if (htmlFiles.length === 0) {
      spinner.warn(chalk.yellow('⚠️  No HTML files found in dist/. Run build:mjml first.'))
      return
    }

    spinner.text = `Exporting ${htmlFiles.length} HTML files`

    for (const file of htmlFiles) {
      const content = await fs.readFile(file, 'utf8')

      // Add meta tags for better email client compatibility
      const enhancedHTML = content.replace(
        '<head>',
        `<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
    <meta name="x-apple-disable-message-reformatting">
    <title>Newsletter</title>`,
      )

      const fileName = path.basename(file)
      const exportPath = path.join('exports/html', fileName)

      await fs.writeFile(exportPath, enhancedHTML)
      spinner.text = `Exported ${fileName}`
    }

    spinner.succeed(chalk.green(`✅ Exported ${htmlFiles.length} HTML files to exports/html/`))
  } catch (error) {
    spinner.fail(chalk.red(`❌ HTML export failed: ${error.message}`))
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exportHTML()
}

export { exportHTML }

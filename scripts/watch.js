import chokidar from 'chokidar'
import { buildMJML } from './build-mjml.js'
import chalk from 'chalk'

console.log(chalk.blue('🚀 Starting MJML watch mode...'))
console.log(chalk.gray('Watching for changes in .mjml files...\\n'))

// Watch for MJML file changes
const watcher = chokidar.watch(['**/*.mjml', '!node_modules/**'], {
  ignored: /node_modules/,
  persistent: true,
})

let isBuilding = false

async function handleChange(path) {
  if (isBuilding) return

  isBuilding = true
  console.log(chalk.yellow(`📝 Changed: ${path}`))

  try {
    await buildMJML()
    console.log(chalk.green('✅ Rebuild complete\\n'))
  } catch (error) {
    console.error(chalk.red('❌ Rebuild failed:', error.message))
  }

  isBuilding = false
}

watcher
  .on('change', handleChange)
  .on('add', handleChange)
  .on('unlink', (path) => {
    console.log(chalk.red(`🗑️  Deleted: ${path}`))
  })
  .on('error', (error) => {
    console.error(chalk.red('❌ Watcher error:', error))
  })

// Initial build
await buildMJML()

console.log(chalk.green('👀 Watching for changes... (Press Ctrl+C to stop)'))

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\\n🛑 Stopping watcher...'))
  watcher.close()
  process.exit(0)
})

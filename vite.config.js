import { defineConfig } from 'vite'
import fs from 'fs-extra'
import path from 'path'
import chokidar from 'chokidar'
import { buildMJML } from './scripts/build-mjml.js'
import chalk from 'chalk'

// Template loader utility
function loadTemplate(templateName) {
  const templatePath = path.join('templates', `${templateName}.html`)
  return fs.readFileSync(templatePath, 'utf8')
}

// Custom plugin to serve MJML-generated HTML files
function mjmlPlugin() {
  return {
    name: 'mjml-plugin',
    configureServer(server) {
      let isBuilding = false

      // Set up MJML file watcher
      const watcher = chokidar.watch(['src/**/*.mjml'], {
        ignored: /node_modules/,
        persistent: true,
      })

      const handleMjmlChange = async (path) => {
        if (isBuilding) return

        isBuilding = true
        console.log(chalk.yellow(`📝 MJML Changed: ${path}`))

        try {
          await buildMJML()
          console.log(chalk.green('✅ MJML Rebuild complete'))

          // Trigger browser reload for all connected clients
          server.ws.send({
            type: 'full-reload',
          })

          // Also send a custom event that we can listen for
          server.ws.send({
            type: 'custom',
            event: 'mjml-updated',
            data: { path },
          })
        } catch (error) {
          console.error(chalk.red('❌ MJML Rebuild failed:', error.message))
        }

        isBuilding = false
      }

      watcher
        .on('change', handleMjmlChange)
        .on('add', handleMjmlChange)
        .on('unlink', (path) => {
          console.log(chalk.red(`🗑️ MJML Deleted: ${path}`))
        })

      // Initial MJML build
      buildMJML().catch(console.error)

      // Simple root handler - serve newsletter or build prompt
      server.middlewares.use((req, res, next) => {
        // Skip Vite internal routes
        if (req.url.startsWith('/@vite') || req.url.startsWith('/assets')) {
          return next()
        }

        // Handle root - serve newsletter if available, otherwise show build commands
        if (req.url === '/') {
          // Check if dist directory exists and has HTML files
          if (fs.pathExistsSync('dist')) {
            const items = fs.readdirSync('dist')
            const htmlFiles = items.filter((item) => item.endsWith('.html'))

            if (htmlFiles.length > 0) {
              // Serve the first HTML file found
              const filePath = path.join('dist', htmlFiles[0])
              let content = fs.readFileSync(filePath, 'utf8')

              // Inject Vite's client script for hot reload
              const viteClientScript = `<script type="module" src="/@vite/client"></script>`
              if (content.includes('</head>')) {
                content = content.replace('</head>', `${viteClientScript}\n</head>`)
              } else {
                content = viteClientScript + '\n' + content
              }

              res.setHeader('Content-Type', 'text/html')
              res.end(content)
              return
            }
          }

          // No dist or no HTML files - show build commands
          const buildPromptHtml = loadTemplate('build-first')
          res.setHeader('Content-Type', 'text/html')
          res.end(buildPromptHtml)
          return
        }

        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [mjmlPlugin()],
  root: '.',
  publicDir: 'assets',
  server: {
    port: 3000,
    open: true,
    host: true,
  },
  build: {
    outDir: 'dist/vite',
    emptyOutDir: true,
  },
})

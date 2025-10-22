import fs from 'fs-extra'
import path from 'path'
import { execSync } from 'child_process'
import readline from 'readline'
import chalk from 'chalk'
import https from 'https'
import http from 'http'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const ASSETS_DIR = path.join(process.cwd(), 'assets')
const AUTHORS_FILE = path.join(ASSETS_DIR, 'authors.json')
const NEWSLETTER_ASSETS_REPO = process.env.NEWSLETTER_ASSETS_REPO || '../newsletter-assets'
const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/stphn/newsletter-assets/main/assets'

// Ensure assets directories exist
async function ensureDirectories() {
  await fs.ensureDir(path.join(ASSETS_DIR, 'avatars'))
  await fs.ensureDir(path.join(ASSETS_DIR, 'articles'))
  await fs.ensureDir(path.join(ASSETS_DIR, 'avatars-source'))
  await fs.ensureDir(path.join(ASSETS_DIR, 'articles-source'))
}

// Find unprocessed images in source folders
async function findUnprocessedImages(type) {
  const sourceDir = path.join(ASSETS_DIR, `${type}-source`)
  const processedDir = path.join(ASSETS_DIR, type)

  const sourceFiles = await fs.readdir(sourceDir)
  const imageFiles = sourceFiles.filter(file =>
    /\.(jpg|jpeg|png|gif|webp)$/i.test(file) && !file.startsWith('.')
  )

  return imageFiles
}

// Load or create authors library
async function loadAuthors() {
  if (await fs.pathExists(AUTHORS_FILE)) {
    return await fs.readJSON(AUTHORS_FILE)
  }
  return {}
}

// Save authors library
async function saveAuthors(authors) {
  await fs.writeJSON(AUTHORS_FILE, authors, { spaces: 2 })
}

// Ask question and get answer
function ask(question) {
  return new Promise((resolve) => {
    rl.question(chalk.cyan(question), (answer) => {
      resolve(answer.trim())
    })
  })
}

// Download image from URL
async function downloadImage(url, tempPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    const file = fs.createWriteStream(tempPath)

    console.log(chalk.yellow('Downloading image from URL...'))

    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`))
        return
      }

      response.pipe(file)

      file.on('finish', () => {
        file.close()
        console.log(chalk.green('✓ Image downloaded'))
        resolve(tempPath)
      })
    }).on('error', (err) => {
      fs.unlink(tempPath, () => {})
      reject(err)
    })
  })
}

// Check if input is a URL
function isURL(input) {
  return input.startsWith('http://') || input.startsWith('https://')
}

// Process avatar image with ImageMagick
async function processAvatar(inputPath, outputName) {
  const outputPath = path.join(ASSETS_DIR, 'avatars', `${outputName}.jpg`)

  console.log(chalk.yellow('Processing avatar...'))

  try {
    // Resize to 64x64, crop to square, optimize
    execSync(
      `magick "${inputPath}" -resize 64x64^ -gravity center -extent 64x64 -quality 85 "${outputPath}"`,
      { stdio: 'inherit' }
    )

    console.log(chalk.green(`✓ Avatar processed: ${outputPath}`))
    return outputPath
  } catch (error) {
    console.error(chalk.red('ImageMagick error:', error.message))
    throw error
  }
}

// Process article image with ImageMagick
async function processArticle(inputPath, outputName) {
  const ext = path.extname(inputPath)
  const outputPath = path.join(ASSETS_DIR, 'articles', `${outputName}${ext}`)

  console.log(chalk.yellow('Processing article image...'))

  try {
    // Resize to max 600px width, maintain aspect ratio, optimize
    execSync(
      `magick "${inputPath}" -resize 600x\\> -quality 85 "${outputPath}"`,
      { stdio: 'inherit' }
    )

    console.log(chalk.green(`✓ Article image processed: ${outputPath}`))
    return outputPath
  } catch (error) {
    console.error(chalk.red('ImageMagick error:', error.message))
    throw error
  }
}

// Copy to newsletter-assets repo
async function copyToRepo(localPath, type) {
  const repoPath = path.join(NEWSLETTER_ASSETS_REPO, 'assets', type, path.basename(localPath))

  await fs.ensureDir(path.dirname(repoPath))
  await fs.copy(localPath, repoPath)

  console.log(chalk.green(`✓ Copied to repo: ${repoPath}`))
  return repoPath
}

// Git commit and push
async function gitCommitPush(message) {
  const shouldCommit = await ask('Commit and push to GitHub? (y/n): ')

  if (shouldCommit.toLowerCase() === 'y') {
    try {
      console.log(chalk.yellow('Running git commands...'))

      execSync('git add assets/', { cwd: NEWSLETTER_ASSETS_REPO, stdio: 'inherit' })
      execSync(`git commit -m "${message}"`, { cwd: NEWSLETTER_ASSETS_REPO, stdio: 'inherit' })
      execSync('git push origin main', { cwd: NEWSLETTER_ASSETS_REPO, stdio: 'inherit' })

      console.log(chalk.green('✓ Changes pushed to GitHub'))
      return true
    } catch (error) {
      console.error(chalk.red('Git error:', error.message))
      return false
    }
  }

  return false
}

// Generate GitHub URL
function generateGitHubURL(type, filename) {
  return `${GITHUB_BASE_URL}/${type}/${filename}`
}

// Process image from source folder
async function processFromSource(sourcePath, imageType, isAvatar) {
  try {
    console.log(chalk.cyan(`\n--- Processing: ${path.basename(sourcePath)} ---`))

    if (isAvatar) {
      const authors = await loadAuthors()

      console.log(chalk.cyan('\nExisting authors:'))
      Object.keys(authors).forEach(key => {
        console.log(chalk.gray(`  - ${authors[key].name} (${key})`))
      })

      const authorName = await ask('\nAuthor name (or existing key): ')
      const authorKey = authorName.toLowerCase().replace(/\s+/g, '-')

      // Process avatar
      const localPath = await processAvatar(sourcePath, authorKey)
      const repoPath = await copyToRepo(localPath, imageType)

      // Update authors library
      authors[authorKey] = {
        name: authorName,
        avatar: `avatars/${path.basename(localPath)}`,
        url: generateGitHubURL(imageType, path.basename(localPath))
      }

      await saveAuthors(authors)
      console.log(chalk.green(`✓ Author added to library: ${authorKey}`))

      // Output URL
      console.log(chalk.bold.green('\n✓ GitHub URL:'))
      console.log(chalk.white(authors[authorKey].url))

      // Remove source file after processing
      await fs.unlink(sourcePath)
      console.log(chalk.gray(`✓ Removed source file: ${path.basename(sourcePath)}`))

    } else {
      // For articles, use filename without extension as output name
      const outputName = path.basename(sourcePath, path.extname(sourcePath))

      const localPath = await processArticle(sourcePath, outputName)
      const repoPath = await copyToRepo(localPath, imageType)

      // Output URL
      const url = generateGitHubURL(imageType, path.basename(localPath))
      console.log(chalk.bold.green('\n✓ GitHub URL:'))
      console.log(chalk.white(url))

      // Remove source file after processing
      await fs.unlink(sourcePath)
      console.log(chalk.gray(`✓ Removed source file: ${path.basename(sourcePath)}`))
    }

  } catch (error) {
    console.error(chalk.red(`Error processing ${path.basename(sourcePath)}:`, error.message))
  }
}

// Main processing flow
async function main() {
  try {
    await ensureDirectories()

    console.log(chalk.bold.cyan('\n📸 Newsletter Image Processor\n'))

    // Ask for image type
    const type = await ask('Image type (1=avatar, 2=article): ')

    if (type !== '1' && type !== '2') {
      console.log(chalk.red('Invalid type. Use 1 for avatar or 2 for article.'))
      rl.close()
      return
    }

    const isAvatar = type === '1'
    const imageType = isAvatar ? 'avatars' : 'articles'

    // Check for unprocessed images in source folder
    const unprocessedImages = await findUnprocessedImages(imageType)

    if (unprocessedImages.length > 0) {
      console.log(chalk.cyan(`\nFound ${unprocessedImages.length} unprocessed image(s) in ${imageType}-source/:`))
      unprocessedImages.forEach((file, i) => {
        console.log(chalk.gray(`  ${i + 1}. ${file}`))
      })

      const useSource = await ask('\nProcess images from source folder? (y/n): ')

      if (useSource.toLowerCase() === 'y') {
        // Process all images from source folder
        for (const sourceFile of unprocessedImages) {
          const sourcePath = path.join(ASSETS_DIR, `${imageType}-source`, sourceFile)
          await processFromSource(sourcePath, imageType, isAvatar)
        }

        // Git commit after batch processing
        const commitMessage = isAvatar
          ? `Add ${unprocessedImages.length} avatar(s)`
          : `Add ${unprocessedImages.length} article image(s)`
        await gitCommitPush(commitMessage)

        rl.close()
        return
      }
    }

    // Ask for input file or URL
    const input = await ask('Input image path or URL: ')

    let inputPath = input
    let tempFile = null

    // If input is a URL, download it first
    if (isURL(input)) {
      tempFile = path.join(ASSETS_DIR, '.temp-download.jpg')
      try {
        await downloadImage(input, tempFile)
        inputPath = tempFile
      } catch (error) {
        console.log(chalk.red(`Failed to download image: ${error.message}`))
        rl.close()
        return
      }
    } else if (!await fs.pathExists(inputPath)) {
      console.log(chalk.red(`File not found: ${inputPath}`))
      rl.close()
      return
    }

    let outputName
    let authorName

    if (isAvatar) {
      // Check if author exists
      const authors = await loadAuthors()

      console.log(chalk.cyan('\nExisting authors:'))
      Object.keys(authors).forEach(key => {
        console.log(chalk.gray(`  - ${authors[key].name} (${key})`))
      })

      authorName = await ask('\nAuthor name (or existing key): ')
      const authorKey = authorName.toLowerCase().replace(/\s+/g, '-')

      outputName = authorKey

      // Process avatar
      const localPath = await processAvatar(inputPath, outputName)
      const repoPath = await copyToRepo(localPath, imageType)

      // Update authors library
      authors[authorKey] = {
        name: authorName,
        avatar: `avatars/${path.basename(localPath)}`,
        url: generateGitHubURL(imageType, path.basename(localPath))
      }

      await saveAuthors(authors)
      console.log(chalk.green(`✓ Author added to library: ${authorKey}`))

      // Git commit
      await gitCommitPush(`Add avatar for ${authorName}`)

      // Output URL
      console.log(chalk.bold.green('\n✓ GitHub URL:'))
      console.log(chalk.white(authors[authorKey].url))

    } else {
      // Process article image
      outputName = await ask('Output filename (without extension): ')

      const localPath = await processArticle(inputPath, outputName)
      const repoPath = await copyToRepo(localPath, imageType)

      // Git commit
      await gitCommitPush(`Add article image: ${outputName}`)

      // Output URL
      const url = generateGitHubURL(imageType, path.basename(localPath))
      console.log(chalk.bold.green('\n✓ GitHub URL:'))
      console.log(chalk.white(url))
    }

    // Clean up temp file if it was created
    if (tempFile && await fs.pathExists(tempFile)) {
      await fs.unlink(tempFile)
      console.log(chalk.gray('Cleaned up temporary file'))
    }

    rl.close()

  } catch (error) {
    console.error(chalk.red('Error:', error.message))
    rl.close()
    process.exit(1)
  }
}

main()

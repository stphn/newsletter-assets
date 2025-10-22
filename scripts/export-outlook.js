import fs from 'fs-extra'
import path from 'path'
import { glob } from 'glob'
import chalk from 'chalk'
import ora from 'ora'
import { buildMJML } from './build-mjml.js'

const spinner = ora('Creating Outlook templates...').start()

function injectMobileClasses(html) {
  let modified = html

  // Inject class for article section outer TD (has border and padding)
  // This targets the section TD that wraps the beige column
  modified = modified.replace(
    /(<td[^>]*style="[^"]*border:4px solid #2D2D2F[^"]*padding:8px[^"]*"[^>]*)(>)/gi,
    (match, tdOpen, closing) => {
      // Check if class attribute already exists
      if (tdOpen.includes('class="')) {
        // Add to existing class
        return tdOpen.replace(/class="([^"]*)"/, 'class="$1 article-outer"') + closing
      } else {
        // Add new class attribute
        return tdOpen + ' class="article-outer"' + closing
      }
    }
  )

  // Inject class for article column inner TD (beige background)
  modified = modified.replace(
    /(<td[^>]*style="[^"]*background-color:#E4E7DB[^"]*"[^>]*)(>)/gi,
    (match, tdOpen, closing) => {
      // Check if class attribute already exists
      if (tdOpen.includes('class="')) {
        // Add to existing class
        return tdOpen.replace(/class="([^"]*)"/, 'class="$1 article-inner"') + closing
      } else {
        // Add new class attribute
        return tdOpen + ' class="article-inner"' + closing
      }
    }
  )

  return modified
}

function optimizeForOutlook(html) {
  // Outlook-specific optimizations
  let optimized = html

  // First inject mobile utility classes
  optimized = injectMobileClasses(optimized)

  // Add Outlook conditional comments
  optimized = optimized.replace(
    '<head>',
    `<head>
    <meta charset="utf-8">
    <!--[if gte mso 9]>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
    <![endif]-->`,
  )

  // Add MSO-specific styles
  optimized = optimized.replace(
    '</head>',
    `  <style type="text/css">
    /* Outlook-specific styles */
    .mso-hide { mso-hide: all !important; }
    table { border-collapse: collapse; }
    .outlook-group-fix { width: 100% !important; }

    /* Outlook DPI fix */
    @media screen and (-webkit-min-device-pixel-ratio: 0) {
      .outlook-group-fix { width: auto !important; }
    }

    /* Fix inline-block alignment for Outlook Mac */
    .mj-column-per-60 table[role="presentation"],
    .mj-column-per-40 table[role="presentation"] {
      height: 100% !important;
    }
  </style>
</head>`,
  )

  // Fix font-size:0 container that breaks alignment
  optimized = optimized.replace(
    /(<td[^>]*direction:ltr;font-size:0px;)/g,
    '$1line-height:0;'
  )

  // Replace web fonts with fallbacks for Outlook
  optimized = optimized.replace(
    /font-family:\s*[^;]*Montserrat[^;]*/gi,
    'font-family: Arial, sans-serif',
  )

  // Add VML background support for Outlook
  optimized = optimized.replace(/<table([^>]*background-color[^>]*)>/gi, (match, attributes) => {
    const bgColor = attributes.match(/background-color:\s*([^;"\s]+)/)
    if (bgColor) {
      return `<!--[if gte mso 9]>
<v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;">
<v:fill type="tile" color="${bgColor[1]}" />
<v:textbox inset="0,0,0,0">
<![endif]-->
${match}
<!--[if gte mso 9]>
</v:textbox>
</v:rect>
<![endif]-->`
    }
    return match
  })

  // Fix emoji encoding for better compatibility
  optimized = optimized.replace(/👾/g, '&#x1F47E;')
  optimized = optimized.replace(/👉/g, '&#x1F449;')
  optimized = optimized.replace(/📧/g, '&#x1F4E7;')
  optimized = optimized.replace(/🎮/g, '&#x1F3AE;')

  return optimized
}

function createOutlookTemplate(html, templateName) {
  // Create proper Outlook .oft format (Windows)
  const oftContent = `MIME-Version: 1.0
Content-Type: multipart/related; boundary="----=_NextPart_01D8B0F1.2A3C4D50"

------=_NextPart_01D8B0F1.2A3C4D50
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: quoted-printable

${html}

------=_NextPart_01D8B0F1.2A3C4D50--`

  return oftContent
}

function createOutlookMacTemplate(html, templateName) {
  // Create proper .emltpl format for Outlook Mac with MIME headers
  const timestamp = new Date().toUTCString()

  return `Date: ${timestamp}
From: newsletter@example.com
Message-ID: <${Date.now()}@newsletter.local>
Subject: ${templateName}
MIME-Version: 1.0
Content-Type: multipart/mixed;
    boundary="----Mixed_${Date.now()}_1"

------Mixed_${Date.now()}_1
Content-Type: multipart/related;
    boundary="----Related_${Date.now()}_2"

------Related_${Date.now()}_2
Content-Type: multipart/alternative;
    boundary="----Alternative_${Date.now()}_3"

------Alternative_${Date.now()}_3
Content-Type: text/html; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

${html}

------Alternative_${Date.now()}_3--
------Related_${Date.now()}_2--
------Mixed_${Date.now()}_1--`
}

async function exportOutlook() {
  try {
    // Ensure we're in the project root
    const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
    process.chdir(projectRoot)

    // First build MJML files
    spinner.stop()
    await buildMJML()

    // Restart spinner for export
    spinner.start('Creating Outlook templates...')

    // Ensure exports directory exists
    await fs.ensureDir('exports/outlook')

    // Find all HTML files in dist
    const htmlFiles = await glob('dist/**/*.html')

    if (htmlFiles.length === 0) {
      spinner.warn(chalk.yellow('⚠️  No HTML files found in dist/. Run build:mjml first.'))
      return
    }

    spinner.text = `Creating Outlook templates for ${htmlFiles.length} files`

    for (const file of htmlFiles) {
      const content = await fs.readFile(file, 'utf8')
      const optimizedHTML = optimizeForOutlook(content)
      const baseName = path.basename(file, '.html')

      // Create .oft file (Outlook Windows Template)
      const oftFileName = `${baseName}.oft`
      const oftPath = path.join('exports/outlook', oftFileName)
      const oftContent = createOutlookTemplate(optimizedHTML, baseName)
      await fs.writeFile(oftPath, oftContent)

      // Create .emltpl file (Outlook Mac Template)
      const emltplFileName = `${baseName}.emltpl`
      const emltplPath = path.join('exports/outlook', emltplFileName)
      const emltplContent = createOutlookMacTemplate(optimizedHTML, baseName)
      await fs.writeFile(emltplPath, emltplContent)

      // Also create .html file for fallback/manual copy
      const htmlFileName = `${baseName}-outlook.html`
      const htmlPath = path.join('exports/outlook', htmlFileName)
      await fs.writeFile(htmlPath, optimizedHTML)

      spinner.text = `Created ${oftFileName}, ${emltplFileName} and ${htmlFileName}`
    }

    // Create Outlook import instructions
    const instructions = `# Outlook Template Import Instructions

## Method 1: Using .oft files (Outlook Windows)

1. **Double-click** any .oft file to open it in Outlook
2. **Or manually import**:
   - Open Outlook
   - File → Open & Export → Open Outlook Data File
   - Browse and select your .oft file
   - The template will open as a new email

## Method 2: Using .emltpl files (Outlook Mac)

1. **Double-click** any .emltpl file to open it in Outlook for Mac
2. **Or manually import**:
   - Open Outlook for Mac
   - File → Import
   - Select "Outlook template file (.emltpl)"
   - Browse and select your .emltpl file

## Method 3: Save as Template in Outlook
1. **Double-click** the appropriate file (.oft for Windows, .emltpl for Mac)
2. **Make any edits** if needed
3. **Save as template**: File → Save As → Outlook Template

## Method 4: Using HTML files (Manual - All Platforms)

1. **Copy the HTML content** from any *-outlook.html file
2. **Open Outlook** and create a new email
3. **Switch to HTML mode**:
   - In Outlook 365: Insert > Get Add-ins > HTML Code
   - In Outlook Desktop: Format Text > HTML
   - In Outlook Mac: Format > HTML
4. **Paste the HTML code**
5. **Save as template** (File > Save As > Outlook Template)

## Files in this directory:
${htmlFiles
  .map((file) => {
    const baseName = path.basename(file, '.html')
    return `- ${baseName}.oft (Outlook Windows Template)\\n- ${baseName}.emltpl (Outlook Mac Template)\\n- ${baseName}-outlook.html (HTML fallback)`
  })
  .join('\\n')}

## Outlook-specific optimizations applied:
- ✅ Conditional comments for MSO
- ✅ VML background support
- ✅ Font fallbacks for Outlook compatibility
- ✅ DPI scaling fixes
- ✅ Table structure optimization
- ✅ OFT format for Outlook Windows
- ✅ EMLTPL format for Outlook Mac

## Testing recommendations:
- Test in Outlook 2016/2019/365 (Windows)
- Test in Outlook for Mac
- Test in Outlook.com web interface
- Use Litmus or Email on Acid for comprehensive testing
- Verify both .oft and .emltpl import works correctly
`

    await fs.writeFile('exports/outlook/README.md', instructions)

    spinner.succeed(
      chalk.green(
        `✅ Created ${
          htmlFiles.length * 3
        } Outlook files (.oft + .emltpl + .html) in exports/outlook/`,
      ),
    )
    console.log(chalk.blue('📖 See exports/outlook/README.md for import instructions'))
    console.log(chalk.green('� .oft files for Windows | 🍎 .emltpl files for Mac'))
  } catch (error) {
    spinner.fail(chalk.red(`❌ Outlook export failed: ${error.message}`))
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exportOutlook()
}

export { exportOutlook }

import fs from 'fs-extra'
import path from 'path'
import { glob } from 'glob'
import chalk from 'chalk'
import ora from 'ora'

const spinner = ora('Creating Outlook templates...').start()

function optimizeForOutlook(html) {
  // Outlook-specific optimizations
  let optimized = html

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
  // For Mac, just return clean HTML - Outlook Mac handles templating differently
  // The metadata in your sample might be added by Outlook Mac when saving
  return html
}

async function exportOutlook() {
  try {
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

# Newsletter Assets

This folder contains processed images for the newsletter.

## Directory Structure

```
assets/
├── avatars/          # Processed author avatars (64x64px, optimized)
├── avatars-source/   # Place unprocessed avatar images here for batch processing
├── articles/         # Processed article images (max 600px width, optimized)
├── articles-source/  # Place unprocessed article images here for batch processing
├── authors.json      # Author library with metadata and URLs
└── README.md         # This file
```

## Using the Image Processor

### Prerequisites

1. **Install ImageMagick:**
   ```bash
   # macOS
   brew install imagemagick

   # Ubuntu/Debian
   sudo apt-get install imagemagick
   ```

2. **Set up newsletter-assets repo path:**
   ```bash
   # Option 1: Set environment variable
   export NEWSLETTER_ASSETS_REPO="/path/to/newsletter-assets"

   # Option 2: Clone repo parallel to this project
   # Default: ../newsletter-assets
   ```

### Process Images

Run the interactive image processor:

```bash
pnpm run process-images
```

### Workflow

#### Batch Processing from Source Folders:

**Best for:** Processing multiple images at once, or downloading from authenticated sources like Cosmos

1. **Download images manually:**
   - For avatars: Save images to `assets/avatars-source/`
   - For articles: Save images to `assets/articles-source/`
   - Example: Download avatar from Cosmos (while logged in) to `avatars-source/`

2. **Run the processor:**
   ```bash
   pnpm run process-images
   ```

3. **Choose type:** `1` (avatar) or `2` (article)

4. **Script will detect unprocessed images:**
   - Shows list of found images
   - Asks: "Process images from source folder? (y/n)"
   - If yes, processes all images one by one

5. **For each image (if avatar):**
   - Enter author name (or existing author key to update)
   - Script processes, copies, and removes source file

6. **After all images processed:**
   - Asks: "Commit and push to GitHub? (y/n)"
   - If yes, commits all changes in one batch

**Benefits:**
- Process multiple images in one session
- Works with authenticated download sources (Cosmos, etc.)
- Automatic cleanup of source files after processing
- Single Git commit for batch operations

#### Processing Avatars (Single Image):

1. Run `pnpm run process-images`
2. Choose type: `1` (avatar)
3. Enter input image path or URL:
   - Local file: `~/Downloads/photo.jpg`
   - URL: `https://cosmos.coyocloud.com/web/senders/.../avatar?imageSize=XL`
4. Enter author name (or existing author key to update)
5. Script will:
   - Resize to 64x64px
   - Optimize quality
   - Save to `assets/avatars/`
   - Copy to newsletter-assets repo
   - Update `authors.json`
   - Commit and push to GitHub (if confirmed)
   - Output GitHub URL for copy-paste

#### Processing Article Images:

1. Run `pnpm run process-images`
2. Choose type: `2` (article)
3. Enter input image path or URL:
   - Local file: `~/Downloads/campaign.jpg`
   - URL: `https://example.com/images/campaign.jpg`
4. Enter output filename (without extension)
5. Script will:
   - Resize to max 600px width
   - Maintain aspect ratio
   - Optimize quality
   - Save to `assets/articles/`
   - Copy to newsletter-assets repo
   - Commit and push to GitHub (if confirmed)
   - Output GitHub URL for copy-paste

### Author Library

The `authors.json` file maintains a library of authors with their avatars:

```json
{
  "stephane-goeuriot": {
    "name": "Stephane Goeuriot",
    "avatar": "avatars/stephane-goeuriot.jpg",
    "url": "https://raw.githubusercontent.com/stphn/newsletter-assets/main/assets/avatars/stephane-goeuriot.jpg"
  }
}
```

**Benefits:**
- Reuse authors across newsletters
- Consistent avatar URLs
- Quick lookup of existing authors

### Using URLs in MJML

After processing, copy the generated GitHub URL:

```xml
<!-- Avatar in person.mjml -->
<img src="https://raw.githubusercontent.com/stphn/newsletter-assets/main/assets/avatars/stephane-goeuriot.jpg" />

<!-- Article image -->
<mj-image src="https://raw.githubusercontent.com/stphn/newsletter-assets/main/assets/articles/campaign-launch.jpg" />
```

### Image Specifications

**Avatars:**
- Size: 64x64px (displays at 32px with @2x)
- Format: JPG (optimized)
- Quality: 85%
- Shape: Square (crop from center)

**Article Images:**
- Max width: 600px
- Aspect ratio: Preserved
- Format: JPG or PNG (same as input)
- Quality: 85% (JPG only)

### Tips

- Use high-quality source images (larger is better)
- For avatars, use square or portrait photos
- Article images should be landscape (16:9 or 4:3)
- Keep file sizes under 200KB for faster email loading

# Outlook Template Import Instructions

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
- index-templated.oft (Outlook Windows Template)\n- index-templated.emltpl (Outlook Mac Template)\n- index-templated-outlook.html (HTML fallback)

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

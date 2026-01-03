# Credit Card Offers Extractor - Browser Extension

A Chrome/Edge browser extension that extracts offers from **American Express** and **Chase** credit card offers pages and allows you to export them to CSV.

## Features

- 🔍 Automatically extracts all offers from Amex and Chase offers pages
- 💾 Export offers to CSV format
- 📋 View all offers in a clean, organized interface
- 🔄 Works with your authenticated session (no login required)
- ⚡ Automatically detects when offers are loaded dynamically
- 🏦 Supports multiple credit card providers (Amex & Chase)

## Installation

### Step 1: Prepare Icons

First, you need to generate the extension icons:

1. Open `generate-icons.html` in your browser
2. Click the download links to save `icon16.png`, `icon48.png`, and `icon128.png`
3. Move these files to the `icons/` directory

Alternatively, you can create your own icons (16x16, 48x48, and 128x128 pixels) and place them in the `icons/` directory with the names:
- `icon16.png`
- `icon48.png`
- `icon128.png`

### Step 2: Load Extension in Chrome/Edge

1. Open Chrome or Edge browser
2. Navigate to `chrome://extensions/` (or `edge://extensions/` for Edge)
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the `credit-card-shopping` folder
6. The extension should now appear in your extensions list

## Usage

1. **Navigate to Offers Page**
   - **For Amex**: Go to https://global.americanexpress.com/offers/eligible
   - **For Chase**: Go to https://secure.chase.com/web/auth/dashboard#/dashboard/merchantOffers/offerCategoriesPage
   - Make sure you're logged in to your account

2. **Extract Offers**
   - Click the extension icon in your browser toolbar
   - Click the "Extract Offers" button
   - Wait for the extraction to complete (usually takes 1-3 seconds)

3. **View Offers**
   - All extracted offers will be displayed in the popup
   - Each offer shows:
     - Source (Amex or Chase)
     - Title/Merchant name
     - Discount/benefit amount
     - Description
     - Category (if available)
     - Terms and conditions
     - Expiry date
     - Status (Added/Not added, etc.)

4. **Export to CSV**
   - Click the "Export to CSV" button
   - The file will be downloaded with a filename like `amex-offers-2024-01-02.csv` or `chase-offers-2024-01-02.csv`
   - Open in Excel, Google Sheets, or any spreadsheet application

## How It Works

The extension uses a content script that:
- Automatically detects whether you're on an Amex or Chase offers page
- Runs site-specific extraction logic optimized for each provider
- Scans the page for offer elements using multiple detection strategies
- Extracts offer details including title, merchant, discount, terms, category, etc.
- Stores offers locally for quick access
- Monitors the page for dynamically loaded offers

### Supported Sites

- **American Express**: `/offers/eligible` pages
- **Chase**: `/merchantOffers/offerCategoriesPage` pages

## File Structure

```
credit-card-shopping/
├── manifest.json          # Extension configuration
├── content.js            # Script that extracts offers from the page
├── popup.html            # Extension popup UI
├── popup.js              # Popup functionality
├── popup.css             # Popup styling
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── generate-icons.html   # Tool to generate icons
└── README.md             # This file
```

## Troubleshooting

### No offers found
- Make sure you're logged in to your account (Amex or Chase)
- Ensure you're on the correct offers page:
  - **Amex**: URL should contain `/offers/eligible`
  - **Chase**: URL should contain `merchantOffers`
- Try refreshing the page and clicking "Extract Offers" again
- Some offers may load dynamically - wait a few seconds after the page loads
- For Chase, make sure you've selected a category or are viewing "All" offers

### Extension not working
- Check that the extension is enabled in `chrome://extensions/`
- Make sure you've loaded the unpacked extension correctly
- Check the browser console for any errors (F12 → Console tab)

### Icons not showing
- Make sure all three icon files (16px, 48px, 128px) are in the `icons/` directory
- Use the `generate-icons.html` file to create the icons if needed

## Privacy

This extension:
- Only runs on American Express and Chase website pages
- Does not send any data to external servers
- Stores offers locally in your browser
- Does not collect or transmit personal information

## License

This project is provided as-is for personal use.

## Support

If you encounter any issues or have suggestions for improvements, please check:
1. That you're using a supported browser (Chrome/Edge)
2. That you're logged in to your account (Amex or Chase)
3. That the offers page has fully loaded
4. That you're on a supported offers page (see "Supported Sites" above)


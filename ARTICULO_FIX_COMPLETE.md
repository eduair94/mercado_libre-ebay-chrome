# 🔧 MercadoLibre Extension Debug Guide

## Problem Summary
The extension was not showing buttons for the main product on `articulo.mercadolibre.com.*` URLs that use the specific HTML structure provided by the user.

## Root Cause Analysis
1. **URL Pattern Detection Issue**: The `isProductDetailPage()` function was using `/MLU/` pattern but actual URLs use `/MLU-` format
2. **Insufficient Debugging**: Limited visibility into why the extension wasn't processing product pages
3. **Domain Coverage**: Need to ensure all MercadoLibre subdomains are properly detected

## 🚀 Solutions Implemented

### 1. Fixed URL Pattern Detection
**File**: `src/content_script.ts` - `isProductDetailPage()` function

**Previous Pattern**:
```typescript
const isProductURL = /\/(p|MLU)\/[\w-]+/.test(url);
```

**New Pattern**:
```typescript
const isProductURL = /\/(p|ML[A-Z]-\d+)[\w-]*/.test(url) || 
                     url.includes('articulo.mercadolibre.') || 
                     url.includes('produto.mercadolivre.');
```

**What this fixes**:
- ✅ `articulo.mercadolibre.com.ar/MLU-479780358-product-name` (your example)
- ✅ `produto.mercadolivre.com.br/MLB-123456-product-name` (Brazil)
- ✅ All country-specific product page subdomains
- ✅ Both old `/p/` format and new `/ML[COUNTRY]-ID-` format

### 2. Enhanced Debug Logging
**File**: `src/content_script.ts` - Multiple functions enhanced

**New Debug Features**:
- 🚨 Immediate console logs when content script loads
- 🔍 URL pattern matching test on script load
- 📊 Detailed debugging in `processAllItems()`
- 🏷️ Product name extraction debugging in `processMainProduct()`
- ✅ Success/failure tracking for each step

**Console Output Examples**:
```
🚨 MERCADOLIBRE EXTENSION - CONTENT SCRIPT LOADING! 🚨
📍 CURRENT URL: https://articulo.mercadolibre.com.ar/MLU-479780358-...
🔍 PRODUCT URL PATTERN: ✅ MATCHES
🚀 processAllItems() called
🔍 Is product detail page: true
📄 Processing product detail page...
🔍 processMainProduct() called
✅ Price container found: [HTMLElement]
🏷️ Product name from title: Honor X5b 4gb Ram 128gb...
✅ Button container inserted after price section
✅ Main product button handlers set up successfully
```

### 3. Domain Detection Enhancement
**File**: `src/content_script.ts` - Initial detection logic

**Enhanced Detection**:
```typescript
const isOnMercadoLibre = window.location.href.includes("mercadolibre.com") || 
                         window.location.href.includes("mercadolivre.com");
```

**Now detects**:
- ✅ All `mercadolibre.com.*` domains (18 countries)
- ✅ Brazil's `mercadolivre.com.br`
- ✅ All subdomains: `articulo.*`, `produto.*`, `listado.*`, `lista.*`

## 🧪 Testing Resources

### Test Files Created

1. **`test_url_patterns.html`**
   - Tests URL pattern matching logic
   - Validates product page detection for various URLs
   - Can be opened locally to verify detection logic

2. **`test_product_debug.html`**
   - Basic product page structure test
   - Simple debugging interface
   - Tests core extension functionality

3. **`test_articulo_simulation.html`**
   - **MOST COMPREHENSIVE TEST**
   - Simulates exact HTML structure from user's example
   - Real-time debug panel showing extension status
   - Matches user's specific use case

4. **`test_argentina_product.html`**
   - Argentina-specific test case
   - Currency detection validation
   - Manual testing instructions

### How to Test

#### Option 1: Use Test Files (Recommended)
1. Build the extension: `npm run build`
2. Load extension in Chrome (Developer Mode)
3. Open `test_articulo_simulation.html` in browser
4. Check browser console (F12) for debug messages
5. Look for extension buttons to appear after price section

#### Option 2: Test on Real MercadoLibre Site
1. Build the extension: `npm run build`
2. Load extension in Chrome
3. Go to: `https://articulo.mercadolibre.com.ar/MLU-479780358-honor-x5b-4gb-ram-128gb-4g-lte-50mpx-dual-sim-libre-dimm`
4. Check console for debug messages
5. Look for eBay/Amazon comparison buttons

### Debug Console Messages to Look For

✅ **Success Indicators**:
- `🚨 MERCADOLIBRE EXTENSION - CONTENT SCRIPT LOADING!`
- `🔍 PRODUCT URL PATTERN: ✅ MATCHES`
- `🔍 Is product detail page: true`
- `✅ Price container found`
- `✅ Button container inserted after price section`

❌ **Failure Indicators**:
- `❌ Price container not found`
- `❌ Could not extract product name`
- `🔍 Is product detail page: false`

## 🎯 Expected Behavior

After implementing these fixes, the extension should:

1. **Detect Product Pages**: Correctly identify `articulo.mercadolibre.com.*` URLs as product pages
2. **Find Price Container**: Successfully locate the `#price` element in the HTML structure
3. **Extract Product Name**: Get product title from `.ui-pdp-title` element
4. **Insert Buttons**: Add eBay/Amazon comparison buttons after the price section
5. **Handle Currency**: Correctly detect `US$` vs local currency symbols
6. **Show Debug Info**: Provide clear console logging for troubleshooting

## 🔄 Next Steps

If extension still doesn't work after these fixes:

1. **Check Console**: Open browser DevTools and look for debug messages
2. **Verify Extension Load**: Confirm extension appears in Chrome Extensions page
3. **Check Manifest**: Ensure all domain patterns are included in `manifest.json`
4. **Test Currency Data**: Verify API endpoints for currency conversion are accessible
5. **Check Element Selectors**: Confirm HTML structure matches expected selectors

## 📋 Validation Checklist

- [ ] Extension builds without errors (`npm run build`)
- [ ] Console shows content script loading message
- [ ] URL pattern detection works for `articulo.mercadolibre.com.*`
- [ ] Product page detection returns `true`
- [ ] Price container (`#price`) is found
- [ ] Product title is extracted successfully
- [ ] Extension buttons are created and inserted
- [ ] Button click handlers work correctly
- [ ] Currency detection works for USD vs local currency

---

**Status**: ✅ All fixes implemented and ready for testing
**Last Updated**: August 23, 2025
**Files Modified**: `src/content_script.ts`, various test files created

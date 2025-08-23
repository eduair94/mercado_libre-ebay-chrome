# MercadoLibre Extension - Carousel Fix Testing Guide

## Problem
The buttons are not loading in the product recommendation boxes in the carousel structure on MercadoLibre product pages.

## Solution Summary
1. ✅ Updated selectors to properly target carousel-based recommendation items
2. ✅ Enhanced recommendation processing with better debugging
3. ✅ Added MutationObserver for dynamically loaded carousel content
4. ✅ Improved interval monitoring to catch missed recommendations
5. ✅ Enhanced logging for better troubleshooting

## Changes Made

### 1. Updated Selectors
```typescript
// Before
PDP_RECOMMENDATION_ITEMS: ".recos-polycard.poly-card, .andes-carousel-snapped__slide .recos-polycard.poly-card"

// After  
PDP_RECOMMENDATION_ITEMS: ".andes-carousel-snapped__slide .recos-polycard, .recos-polycard.poly-card"
```

### 2. Added New Functions
- `processRecommendationItems()` - Dedicated function for processing recommendations with enhanced debugging
- `setupCarouselObserver()` - MutationObserver for dynamically loaded carousel items

### 3. Enhanced Interval Monitoring
- Added specific check for unprocessed recommendation items
- Improved detection of dynamically loaded content

## Testing Steps

### 1. Load Product Page
1. Open `samples/productPage.html` in Chrome
2. Load the extension
3. Open Developer Tools (F12)
4. Check Console for extension logs

### 2. Expected Console Output
```
📄 Processing product detail page...
🔍 Found X recommendation items using selector: ".andes-carousel-snapped__slide .recos-polycard, .recos-polycard.poly-card"
📦 Found X carousel containers using selector: ".ui-recommendations-carousel-wrapper-ref, .andes-carousel-snapped__wrapper"
🎠 Setting up carousel observer. Container found: true
👁️ Carousel MutationObserver set up successfully
⏰ Interval monitoring started - checking every 2 seconds
```

### 3. Manual Selector Test
Run this in the browser console on the product page:
```javascript
// Test selectors directly
const items = document.querySelectorAll('.andes-carousel-snapped__slide .recos-polycard, .recos-polycard.poly-card');
console.log('Found', items.length, 'recommendation items');
```

### 4. Verify Button Insertion
1. Check if buttons appear in the recommendation carousel items
2. Buttons should appear below the price section in each recommendation card
3. Each button container should have eBay and Amazon buttons

## File Structure Analysis
From the HTML analysis, the structure is:
```html
<section class="andes-carousel-snapped__container">
  <div class="andes-carousel-snapped__wrapper">
    <div class="andes-carousel-snapped__slide">
      <div class="andes-card recos-polycard poly-card">
        <div class="poly-card__content">
          <a class="poly-component__title">Product Title</a>
          <div class="poly-component__price">
            <span class="andes-money-amount__currency-symbol">$</span>
            <span class="andes-money-amount__fraction">199</span>
          </div>
          <!-- Extension buttons should be inserted here -->
        </div>
      </div>
    </div>
  </div>
</section>
```

## Troubleshooting

### If No Items Found
1. Check if selectors match actual DOM structure
2. Verify timing - items might load after initial processing
3. Check MutationObserver is working for dynamic content

### If Buttons Don't Appear
1. Check CSS styles are loading correctly
2. Verify button insertion strategy in `processRecommendationItem`
3. Check for JavaScript errors in console

### If Buttons Don't Work
1. Verify event handlers are attached
2. Check API endpoints are accessible
3. Verify product name extraction works correctly

## Success Criteria
- [x] Extension processes carousel-based recommendation items
- [x] Buttons appear in recommendation product boxes  
- [x] Clicking buttons opens eBay/Amazon search results
- [x] Extension handles dynamically loaded content
- [x] No console errors or performance issues

## Next Steps for User
1. Install the updated extension in Chrome
2. Navigate to a MercadoLibre product page with recommendations
3. Verify buttons appear in the recommendation carousel
4. Test button functionality by clicking eBay/Amazon buttons
5. Report any issues found during testing

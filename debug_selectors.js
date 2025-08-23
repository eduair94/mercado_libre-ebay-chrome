// Manual test script to inject into browser console
(function testSelectors() {
  console.log("🔍 Testing MercadoLibre Extension Selectors");
  
  const selectors = {
    PDP_RECOMMENDATIONS_CONTAINER: ".ui-recommendations-carousel-wrapper-ref, .andes-carousel-snapped__wrapper",
    PDP_RECOMMENDATION_ITEMS: ".andes-carousel-snapped__slide .recos-polycard, .recos-polycard.poly-card",
    PDP_RECOMMENDATION_TITLE: ".poly-component__title",
    PDP_RECOMMENDATION_PRICE_CURRENCY: ".poly-component__price .andes-money-amount__currency-symbol",
    PDP_RECOMMENDATION_PRICE_FRACTION: ".poly-component__price .andes-money-amount__fraction"
  };

  Object.entries(selectors).forEach(([name, selector]) => {
    const elements = document.querySelectorAll(selector);
    console.log(`${name}: "${selector}" found ${elements.length} elements`);
    
    if (elements.length > 0) {
      console.log("  First few elements:", Array.from(elements).slice(0, 3));
      if (name === 'PDP_RECOMMENDATION_ITEMS') {
        elements.forEach((item, index) => {
          const title = item.querySelector('.poly-component__title');
          const price = item.querySelector('.poly-component__price .andes-money-amount__fraction');
          console.log(`  Item ${index + 1}: "${title?.textContent?.trim()}" - $${price?.textContent?.trim()}`);
        });
      }
    }
  });

  // Test the specific carousel structure
  console.log("\n🎠 Carousel Structure Analysis:");
  const carouselContainers = document.querySelectorAll('.andes-carousel-snapped__container');
  console.log(`Found ${carouselContainers.length} carousel containers`);
  
  const carouselWrappers = document.querySelectorAll('.andes-carousel-snapped__wrapper');
  console.log(`Found ${carouselWrappers.length} carousel wrappers`);
  
  const carouselSlides = document.querySelectorAll('.andes-carousel-snapped__slide');
  console.log(`Found ${carouselSlides.length} carousel slides`);
  
  const recosPolycards = document.querySelectorAll('.recos-polycard');
  console.log(`Found ${recosPolycards.length} recos-polycard elements`);
  
  // Test if we're on a product page
  const isProductPage = window.location.pathname.includes('/p/');
  console.log(`\n📄 Is Product Page: ${isProductPage}`);
  console.log(`Current URL: ${window.location.href}`);
})();

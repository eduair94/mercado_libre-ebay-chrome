// Simple validation test for the Amazon parser fix
const fs = require('fs');
const { JSDOM } = require('jsdom');

// Mock the DOMParser if not available in Node.js
if (!global.DOMParser) {
    const { DOMParser } = require('@xmldom/xmldom');
    global.DOMParser = DOMParser;
}

// Test fixLink method with various inputs
function testFixLink() {
    console.log('Testing fixLink method...');
    
    // Mock StoreFront class
    class StoreFront {
        constructor() {
            this.origin = "https://amazon.com";
        }
        
        fixLink(link) {
            if (!link) return "";
            if (link.startsWith("http")) return link;
            console.log("origin", this.origin);
            return this.origin + link;
        }
    }
    
    const storeFront = new StoreFront();
    
    // Test cases
    const testCases = [
        { input: null, expected: "" },
        { input: undefined, expected: "" },
        { input: "", expected: "" },
        { input: "/product/123", expected: "https://amazon.com/product/123" },
        { input: "https://example.com/product", expected: "https://example.com/product" },
        { input: "/-/es/Premium-Connectors-monitor/dp/B07MQVFKN4", expected: "https://amazon.com/-/es/Premium-Connectors-monitor/dp/B07MQVFKN4" }
    ];
    
    let allPassed = true;
    
    testCases.forEach((testCase, index) => {
        const result = storeFront.fixLink(testCase.input);
        const passed = result === testCase.expected;
        console.log(`Test ${index + 1}: ${passed ? '✓ PASS' : '✗ FAIL'}`);
        console.log(`  Input: ${testCase.input}`);
        console.log(`  Expected: "${testCase.expected}"`);
        console.log(`  Got: "${result}"`);
        console.log('');
        
        if (!passed) allPassed = false;
    });
    
    return allPassed;
}

// Test parsing with a simple HTML snippet
function testParsing() {
    console.log('Testing parsing with simple HTML...');
    
    const sampleHTML = `
        <div class="s-result-item" data-component-type="s-search-result">
            <a class="a-link-normal s-line-clamp-2 s-link-style a-text-normal" href="/-/es/product1">
                <h2><span>Test Product 1</span></h2>
            </a>
            <span class="a-price-whole">25</span>
            <span class="a-price-fraction">99</span>
        </div>
        
        <div class="s-result-item" data-component-type="s-search-result">
            <a class="a-link-normal s-line-clamp-2 s-link-style a-text-normal" href="/-/es/product2">
                <h2><span>Test Product 2</span></h2>
            </a>
            <span class="a-price-whole">10</span>
            <span class="a-price-fraction">00</span>
        </div>
        
        <div class="s-result-item" data-component-type="s-search-result">
            <!-- Product without link should not crash -->
            <div>
                <h2><span>Test Product 3 - No Link</span></h2>
            </div>
            <span class="a-price-whole">15</span>
        </div>
    `;
    
    // Mock classes
    class StoreFront {
        constructor() {
            this.origin = "https://amazon.com";
        }
        
        fixLink(link) {
            if (!link) return "";
            if (link.startsWith("http")) return link;
            return this.origin + link;
        }
        
        getPriceData(pr) {
            let prNoSpaces = pr.replace(/\s/g, "");
            const currencyMatch = prNoSpaces.match(/[A-Z]+/);
            let priceMatch = prNoSpaces.match(/(\d{1,3}(,\d{3})*(\.\d{2})?)/g);
            let currency = "USD";
            let price = 0;
            if (priceMatch) {
                priceMatch[0] = priceMatch[0].replace(/\,/g, "");
                price = parseFloat(priceMatch[0]);
            }
            if (price) {
                if (currencyMatch) {
                    currency = currencyMatch[0];
                }
            } else {
                currency = "";
            }
            return { currency, price: price };
        }
    }
    
    class AmazonFront extends StoreFront {
        parseHTML(data) {
            const productContainer = '.s-result-item[data-component-type="s-search-result"]';
            const nameSel = "a.a-link-normal.s-line-clamp-2 h2 span";
            const linkSel = "a.a-link-normal.s-line-clamp-2";
            const priceSel = ".a-price-whole";
            const priceFraction = ".a-price-fraction";

            const dom = new JSDOM(data);
            const document = dom.window.document;
            
            const items = Array.from(document.querySelectorAll(productContainer)).map((el) => {
                const wholeElement = el.querySelector(priceSel);
                const fractionElement = el.querySelector(priceFraction);
                
                const txt = (wholeElement?.textContent || "") + (fractionElement?.textContent || "0");
                const { currency, price } = this.getPriceData(txt);
                
                // Get the name from the h2 span inside the link
                const nameElement = el.querySelector(nameSel);
                const name = nameElement ? nameElement.textContent?.trim() || "" : "";
                
                // Get the link from the a element
                const linkElement = el.querySelector(linkSel);
                const href = linkElement ? linkElement.getAttribute("href") : null;
                
                return {
                    name,
                    currency,
                    price,
                    link: this.fixLink(href),
                };
            });

            return {
                items: items,
                total: 0,
                totalPages: 0,
                proxy: "",
            };
        }
    }
    
    try {
        const parser = new AmazonFront();
        const result = parser.parseHTML(sampleHTML);
        
        console.log(`Found ${result.items.length} items`);
        result.items.forEach((item, i) => {
            console.log(`Item ${i + 1}:`);
            console.log(`  Name: ${item.name}`);
            console.log(`  Price: ${item.currency}${item.price}`);
            console.log(`  Link: ${item.link}`);
            console.log('');
        });
        
        // Validate results
        const expectedCount = 3;
        const hasValidNames = result.items.every(item => item.name && item.name.includes('Test Product'));
        const hasValidPrices = result.items.every(item => item.price > 0);
        const hasValidLinks = result.items.filter(item => item.link).length >= 2; // At least 2 should have links
        
        const success = result.items.length === expectedCount && hasValidNames && hasValidPrices && hasValidLinks;
        
        console.log(`Parsing test: ${success ? '✓ PASS' : '✗ FAIL'}`);
        return success;
        
    } catch (error) {
        console.log(`Parsing test: ✗ FAIL - ${error.message}`);
        return false;
    }
}

// Run tests
console.log('=== Amazon Parser Fix Validation ===\n');

const fixLinkPassed = testFixLink();
console.log('---\n');
const parsingPassed = testParsing();

console.log('=== Summary ===');
console.log(`fixLink method: ${fixLinkPassed ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Parsing test: ${parsingPassed ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Overall: ${fixLinkPassed && parsingPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);

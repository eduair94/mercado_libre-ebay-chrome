// Test script to validate MercadoLibre URL matching
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing MercadoLibre URL Pattern Matching...\n');

// Read the manifest.json file
const manifestPath = path.join(__dirname, 'public', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Extract content script matches
const contentScriptMatches = manifest.content_scripts[0].matches;

console.log(`📊 Total URL Patterns: ${contentScriptMatches.length}\n`);

// Test URLs that should match
const testUrls = [
    'https://articulo.mercadolibre.com.ar/MLA-123456-product-name',
    'https://producto.mercadolivre.com.br/MLB-123456-product-name',
    'https://listado.mercadolibre.com.mx/samsung-galaxy',
    'https://www.mercadolibre.com.co/product-name',
    'https://mercadolibre.cl/something',
    'https://articulo.mercadolibre.com.pe/MPE-123456-product'
];

console.log('🎯 Testing URL Matches:\n');

testUrls.forEach(testUrl => {
    const url = new URL(testUrl);
    const urlToMatch = `${url.protocol}//${url.hostname}${url.pathname}`;
    
    // Check if any pattern matches this URL
    const matches = contentScriptMatches.some(pattern => {
        // Convert pattern to regex (simple wildcard matching)
        const regexPattern = pattern
            .replace(/\*/g, '.*')
            .replace(/\./g, '\\.');
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(urlToMatch);
    });
    
    console.log(`${matches ? '✅' : '❌'} ${testUrl}`);
    if (!matches) {
        console.log(`   No matching pattern found for: ${urlToMatch}`);
    }
});

console.log('\n🌎 Countries and Domain Patterns:\n');

// Group patterns by country
const countries = [
    { name: 'Argentina', patterns: contentScriptMatches.filter(p => p.includes('.com.ar')) },
    { name: 'Bolivia', patterns: contentScriptMatches.filter(p => p.includes('.com.bo')) },
    { name: 'Brazil', patterns: contentScriptMatches.filter(p => p.includes('.com.br')) },
    { name: 'Chile', patterns: contentScriptMatches.filter(p => p.includes('.cl')) },
    { name: 'Colombia', patterns: contentScriptMatches.filter(p => p.includes('.com.co')) },
    { name: 'Costa Rica', patterns: contentScriptMatches.filter(p => p.includes('.co.cr')) },
    { name: 'Dominican Republic', patterns: contentScriptMatches.filter(p => p.includes('.com.do')) },
    { name: 'Ecuador', patterns: contentScriptMatches.filter(p => p.includes('.com.ec')) },
    { name: 'El Salvador', patterns: contentScriptMatches.filter(p => p.includes('.com.sv')) },
    { name: 'Guatemala', patterns: contentScriptMatches.filter(p => p.includes('.com.gt')) },
    { name: 'Honduras', patterns: contentScriptMatches.filter(p => p.includes('.com.hn')) },
    { name: 'Mexico', patterns: contentScriptMatches.filter(p => p.includes('.com.mx')) },
    { name: 'Nicaragua', patterns: contentScriptMatches.filter(p => p.includes('.com.ni')) },
    { name: 'Panama', patterns: contentScriptMatches.filter(p => p.includes('.com.pa')) },
    { name: 'Paraguay', patterns: contentScriptMatches.filter(p => p.includes('.com.py')) },
    { name: 'Peru', patterns: contentScriptMatches.filter(p => p.includes('.com.pe')) },
    { name: 'Uruguay', patterns: contentScriptMatches.filter(p => p.includes('.com.uy')) },
    { name: 'Venezuela', patterns: contentScriptMatches.filter(p => p.includes('.com.ve')) }
];

countries.forEach(country => {
    if (country.patterns.length > 0) {
        console.log(`🏁 ${country.name}: ${country.patterns.length} patterns`);
        country.patterns.forEach(pattern => {
            console.log(`   ${pattern}`);
        });
    }
});

console.log(`\n✅ Summary:`);
console.log(`📊 Total Patterns: ${contentScriptMatches.length}`);
console.log(`🌎 Countries Covered: ${countries.filter(c => c.patterns.length > 0).length}`);
console.log(`🔗 Average Patterns per Country: ${Math.round(contentScriptMatches.length / 18)}`);

// Validate that we have all expected pattern types
const hasMainSite = contentScriptMatches.some(p => p.includes('mercadolibre.com.ar/*') && !p.includes('www') && !p.includes('listado') && !p.includes('articulo'));
const hasWwwSite = contentScriptMatches.some(p => p.includes('www.mercadolibre.com.ar/*'));
const hasListings = contentScriptMatches.some(p => p.includes('listado.mercadolibre.com.ar/*'));
const hasProducts = contentScriptMatches.some(p => p.includes('articulo.mercadolibre.com.ar/*'));

console.log(`\n🧪 Pattern Type Validation for Argentina:`);
console.log(`${hasMainSite ? '✅' : '❌'} Main site pattern`);
console.log(`${hasWwwSite ? '✅' : '❌'} WWW subdomain pattern`);
console.log(`${hasListings ? '✅' : '❌'} Listings subdomain pattern`);
console.log(`${hasProducts ? '✅' : '❌'} Product subdomain pattern`);

console.log('\n🎉 Test Complete!');

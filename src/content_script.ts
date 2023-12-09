import { ebayFront } from "./classes/EbayFront";

onload = async (event) => {
    const currencies = await fetch('https://api.cambio-uruguay.com/fortex').then(res=>res.json());
    const site = window.location.href;
    if (site.includes('mercadolibre.com')) {
        function append(newElement, targetElement) {
            targetElement.appendChild(newElement);
        }
        function currencyConversion(item: any) {
            const price = item.price;
            const currency = item.currency;
            let priceAlt = 0;
            const usdUYU = currencies['UYU']['USD']
            let currencyAlt = '';
            if (currency === 'USD') {
                priceAlt = price * usdUYU
                currencyAlt = 'UYU'
            } else if (currency === 'UYU') {
                priceAlt = price / usdUYU;
                currencyAlt = 'USD'
            }
            return { priceAlt: priceAlt.toFixed(2), currencyAlt }
        }
        function dataProcess(item:Element, data:any) {
            //const res = ebayFront.parseHTML(data);
            const res = ebayFront.parseHTML(data);
            const targetElement = item.querySelector('.ui-search-item__group--title');
            const items = res.items;
            item.querySelector('.ebay_btn').remove();
            if (items && items.length) {
                const item0 = items[0];
                const { priceAlt, currencyAlt } = currencyConversion(item0);
                // Step 3: Append the HTML content to the target element
                const newElement = document.createElement('div');
                newElement.innerHTML = `<a href="${item0.link}" target="_blank" class="ebay_content">${item0.price} ${item0.currency} (${priceAlt} ${currencyAlt})</a>`;
                // Step 3: Append the new element to the target element
                append(newElement, targetElement);
            } else {
                const newElement = document.createElement('div');
                newElement.innerHTML = `<span class="ebay_content">N/A</span>`;
                
                // Step 3: Append the new element to the target element
                append(newElement, targetElement);
            }
        }
        const items = document.querySelectorAll('.ui-search-layout .ui-search-result');
        console.log("Total items", items.length);
        setTimeout(() => {
            items.forEach((item) => {
                const name = item.querySelector('.ui-search-item__title')?.textContent;
                if (name) {
                    const site = 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(name);
                    const element = document.createElement('div');
                    element.innerHTML = `<button class="ebay_btn">EBAY PRICE</button>`;
                    console.log("Append element");
                    const targetElement = item.querySelector('.ui-search-item__group--title');
                    append(element, targetElement);
                    element.onclick = () => {
                        chrome.runtime.sendMessage({ url: site, msg: "request" }, data => dataProcess(item, data));
                    }
                }   
            });
        }, 1000);    
    }
};    
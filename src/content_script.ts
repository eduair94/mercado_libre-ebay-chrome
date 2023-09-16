import { ebayFront } from "./classes/EbayFront";

onload = (event) => {
    const site = window.location.href;
    if (site.includes('mercadolibre.com')) {
        function append(newElement, targetElement) {
            setTimeout(() => {
                targetElement.appendChild(newElement);
            }, 1000);
        }
        function dataProcess(item:Element, data:any) {
            //const res = ebayFront.parseHTML(data);
            const res = ebayFront.parseHTML(data);
            const targetElement = item.querySelector('.ui-search-item__group--title');
            const items = res.items;
            if (items && items.length) {
                const item0 = items[0];
                // Step 3: Append the HTML content to the target element
                const newElement = document.createElement('div');
                const priceUYU = Math.ceil(item0.price * 39);
                newElement.innerHTML = `<a href="${item0.link}" target="_blank" class="ebay_content">EBAY PRICE: ${item0.price} USD (${priceUYU} UYU)</a>`;
                
                // Step 3: Append the new element to the target element
                append(newElement, targetElement);
            } else {
                const newElement = document.createElement('div');
                newElement.innerHTML = `<span class="ebay_content">EBAY PRICE: N/A</span>`;
                
                // Step 3: Append the new element to the target element
                append(newElement, targetElement);
            }
        }
        const items = document.querySelectorAll('.ui-search-layout .ui-search-result');
        console.log("Total items", items.length);
        items.forEach((item) => {
            const name = item.querySelector('.ui-search-item__title')?.textContent;
            if(name) {
                const site = 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(name);
                chrome.runtime.sendMessage({ url: site, msg: "request" }, data => dataProcess( item, data));
            }   
        });
    }
};    
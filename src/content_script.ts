import { amazonFront } from "./classes/AmazonFront";
import { ebayFront } from "./classes/EbayFront";
import { Item, ParseHTMLResult } from "./interfaces/products.interface";

function wordCoincidence(str1: string, str2: string): number {
  const words1 = str1.split(/\s+/); // Split the first string into words
  const words2 = str2.split(/\s+/); // Split the second string into words
  const commonWords = words1.filter((word) => words2.includes(word)); // Find common words
  return commonWords.length; // Return the count of common words
}

function findMostSimilarProduct(target: string, products: Item[]): Item {
  target = target.toLowerCase();
  let maxWords = 0;
  let mostSimilar = null;

  for (const product of products) {
    const comWords = wordCoincidence(target, product.name.toLowerCase());
    if (comWords > maxWords) {
      maxWords = comWords;
      mostSimilar = product;
    }
  }
  if (!mostSimilar) return products[0];
  return mostSimilar;
}

onload = async (event) => {
  const [currencyList, currencies] = await Promise.all([
    fetch('https://trustpilot.digitalshopuy.com/currency/all').then(res=> res.json()),
    fetch("https://api.cambio-uruguay.com/fortex").then((res) => res.json())
  ]);
  const site = window.location.href;
  if (site.includes("mercadolibre.com")) {
    function append(newElement, targetElement) {
      targetElement.appendChild(newElement);
    }
    function currencyConversion(item: any, currencySymbol = 'UYU') {
      const price = item.price;
      const currency = item.currency;
      let priceAlt = 0;
      let currencyAlt = "";
      const usdCurr = currencySymbol === 'UYU' ? currencies[currencySymbol]["USD"] : currencyList.rates[currencySymbol].to;
      if (currency === "USD") {
        priceAlt = price * usdCurr;
        currencyAlt = currencySymbol;
      } else if (currency === currencySymbol) {
        priceAlt = price / usdCurr;
        currencyAlt = "USD";
      }

      let currFormatter = new Intl.NumberFormat('es-UY', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });


      return { priceRaw: priceAlt, priceAlt: currFormatter.format(priceAlt), currencyAlt };
    }
    function dataProcess(item: Element, data: any, site: "ebay" | "amazon", name: string) {
      //const res = ebayFront.parseHTML(data);
      const btnSelector = site === "ebay" ? ".ebay_btn" : ".amazon_btn";
      let res: ParseHTMLResult;
      if (site === "ebay") {
        res = ebayFront.parseHTML(data);
      } else {
        res = amazonFront.parseHTML(data);
      }

      const targetElement = item.querySelector(btnSelector);
      const items = res.items;
      if (items && items.length) {
        const item0 = findMostSimilarProduct(name, items);
        const country = window.location.hostname.split(".").at(-1).toLowerCase();
        const jsonCurrencies = {
          uy: "UYU",
          co: "COP",
        }
        const currencySymbol = jsonCurrencies[country];
        const { priceAlt, currencyAlt, priceRaw } = currencyConversion(item0, currencySymbol);
        const newElement = document.createElement("div");
        let className = "";
        let mlPrice = {
          currency: "USD",
          price: 0,
        };
        try {
          mlPrice = {
            currency: item.querySelector(".ui-search-price__second-line .andes-money-amount__currency-symbol").innerHTML,
            price: parseFloat(item.querySelector(".ui-search-price__second-line .andes-money-amount__fraction").innerHTML.replace(/\./g, "")),
          };
        } catch (e) {}
        console.log("mlPrice", mlPrice, priceRaw);
        if (item0.price > 0) {
          if (mlPrice.currency === "U$S" && item0.price >= mlPrice.price) {
            className = "btn_ml_danger";
          } else if (mlPrice.currency !== "U$S" && priceRaw >= mlPrice.price) {
            className = "btn_ml_danger";
          } else {
            className = "btn_ml_success";
          }
        }
        newElement.innerHTML = `<a href="${item0.link}" target="_blank" class="ebay_content ${className}">${item0.price} ${item0.currency} (${priceAlt} ${currencyAlt})</a>`;
        targetElement.replaceWith(newElement);
      } else {
        const newElement = document.createElement("div");
        newElement.innerHTML = `<span class="ebay_content">N/A</span>`;
        targetElement.replaceWith(newElement);
      }
    }
    const items = document.querySelectorAll(".ui-search-layout .ui-search-result");
    console.log("Total items", items.length);
    setTimeout(() => {
      items.forEach((item) => {
        const name = item.querySelector(".ui-search-item__title")?.textContent;
        if (name) {
          const element = document.createElement("div");
          element.innerHTML = `<div class="btn_ml_app_container"><button class="ebay_btn btn_ml_app">EBAY PRICE</button><button class="amazon_btn btn_ml_app">AMAZON PRICE</button></div>`;
          const targetElement = item.querySelector(".ui-search-item__group--title");
          append(element, targetElement);
          const ebayBtn = element.querySelector(".ebay_btn") as HTMLButtonElement;
          ebayBtn.onclick = () => {
            const site = "https://www.ebay.com/sch/i.html?_nkw=" + encodeURIComponent(name);
            chrome.runtime.sendMessage({ url: site, msg: "request" }, (data) => dataProcess(item, data, "ebay", name));
          };
          const amazonBtn = element.querySelector(".amazon_btn") as HTMLButtonElement;
          amazonBtn.onclick = () => {
            const site = "https://www.amazon.com/s?k=" + encodeURIComponent(name);
            chrome.runtime.sendMessage({ url: site, msg: "request" }, (data) => dataProcess(item, data, "amazon", name));
          };
        }
      });
    }, 1000);
  }
};

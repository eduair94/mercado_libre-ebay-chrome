import { ParseHTMLResult } from "../interfaces/products.interface";
import StoreFront from "./StoreFront";

class AmazonFront extends StoreFront {
  origin = "https://amazon.com";
  parseHTML(data: string): ParseHTMLResult {
    const productContainer = '.s-result-item[data-component-type="s-search-result"]';
    const nameSel = "h2 .a-link-normal";
    const priceSel = ".a-price-whole";
    const priceFraction = ".a-price-fraction";

    const parser = new DOMParser();
    const html = parser.parseFromString(data, "text/html");
    const items = Array.from(html.querySelectorAll(productContainer)).map((el, u) => {
      const txt = (el.querySelector(priceSel)?.textContent || "") + (el.querySelector(priceFraction)?.textContent || "0");
      console.log("txt", txt);
      const { currency, price } = this.getPriceData(txt);
      return {
        image: "",
        name: (el.querySelector(nameSel)?.textContent || "").trim(),
        currency,
        price,
        location: "",
        originalPrice: { currency: "USD", price: 0 },
        shippingCost: { currency: "USD", price: 0 },
        seller: undefined,
        status: "",
        watchCount: 0,
        soldCount: 0,
        bidCount: 0,
        link: this.fixLink(el.querySelector(nameSel)?.getAttribute("href")),
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

export const amazonFront = new AmazonFront();

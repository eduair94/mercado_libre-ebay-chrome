import { ParseHTMLResult } from "../interfaces/products.interface";
import StoreFront from "./StoreFront";

class AmazonFront extends StoreFront {
  origin = "https://amazon.com";
  parseHTML(data: string): ParseHTMLResult {
    const productContainer = '.s-result-item[data-component-type="s-search-result"]';
    const nameSel = "a.a-link-normal.s-line-clamp-2 h2 span";
    const linkSel = "a.a-link-normal.s-line-clamp-2";
    const priceSel = ".a-price-whole";
    const priceFraction = ".a-price-fraction";

    const parser = new DOMParser();
    const html = parser.parseFromString(data, "text/html");
    const items = Array.from(html.querySelectorAll(productContainer)).map((el, u) => {
      const txt = (el.querySelector(priceSel)?.textContent || "") + (el.querySelector(priceFraction)?.textContent || "0");
      console.log("txt", txt);
      const { currency, price } = this.getPriceData(txt);

      // Get the name from the h2 span inside the link
      const nameElement = el.querySelector(nameSel);
      const name = nameElement ? nameElement.textContent?.trim() || "" : "";

      // Get the link from the a element
      const linkElement = el.querySelector(linkSel);
      const href = linkElement ? linkElement.getAttribute("href") : null;

      return {
        image: "",
        name,
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

export const amazonFront = new AmazonFront();

import StoreFront from "./StoreFront";

class EbayFront extends StoreFront {
  parseHTML(data: string) {
    const parser = new DOMParser();
    const html = parser.parseFromString(data, "text/html");
    const productContainer = ".srp-results > li";
    const imageSel = "img";
    const nameSel = '[role="heading"]';
    const priceSel = ".s-item__price";
    const sellerSel = ".s-item__seller-info-text";
    const statusSel = ".SECONDARY_INFO";
    const watchCount = ".s-item__watchCountTotal";
    const soldCount = ".s-item__quantitySold";
    const shippingCost = ".s-item__logisticsCost";
    const originalPrice = ".s-item__trending-price .STRIKETHROUGH";
    const locationSel = ".s-item__itemLocation";
    const bidCount = ".s-item__bidCount";
    const totalResults = ".srp-controls__count-heading";
    const pageSel = '.pagination__item[href="#"]';
    const linkSel = ".s-item__link";
    const items = Array.from(html.querySelectorAll(productContainer))
      .map((el, u) => {
        const { currency, price } = this.getPriceData(el.querySelector(priceSel)?.textContent || "");
        return {
          image: el.querySelector(imageSel)?.getAttribute("src"),
          name: (el.querySelector(nameSel)?.textContent || "").trim(),
          currency,
          price,
          location: this.fixLocation(el.querySelector(locationSel)?.textContent || ""),
          originalPrice: this.getPriceData(el.querySelector(originalPrice)?.textContent || ""),
          shippingCost: this.getPriceData(el.querySelector(shippingCost)?.textContent || ""),
          seller: this.getSellerData(el.querySelector(sellerSel)?.textContent || ""),
          status: el.querySelector(statusSel)?.textContent || "",
          watchCount: this.getNumber(el.querySelector(watchCount)?.textContent || ""),
          soldCount: this.getNumber(el.querySelector(soldCount)?.textContent || ""),
          bidCount: this.getNumber(el.querySelector(bidCount)?.textContent || ""),
          link: el.querySelector(linkSel)?.getAttribute("href"),
        };
      })
      .filter((el) => el.name);

    const total = 0;
    const totalPages = Math.ceil(total / items.length);
    const res = { items, total, totalPages, proxy: "" };
    return res;
  }
}

const ebayFront = new EbayFront();
export { ebayFront };

import StoreFront from "./StoreFront";

class EbayFront extends StoreFront {
  parseHTML(data: string) {
    const parser = new DOMParser();
    const html = parser.parseFromString(data, "text/html");
    const productContainer = ".srp-results li.s-card";
    const imageSel = "img.s-card__image";
    const nameSel = '.s-card__title .su-styled-text';
    const priceSel = ".s-card__price";
    const sellerSel = ".su-card-container__attributes__secondary .su-styled-text";
    const statusSel = ".s-card__subtitle .su-styled-text";
    const watchCount = ".s-card__attribute-row";
    const soldCount = ".s-card__attribute-row";
    const shippingCost = ".s-card__attribute-row";
    const originalPrice = ".s-card__attribute-row .su-styled-text";
    const locationSel = ".s-card__attribute-row";
    const bidCount = ".s-card__attribute-row";
    const totalResults = ".srp-controls__count-heading";
    const pageSel = '.pagination__item[href="#"]';
    const linkSel = ".su-card-container__header a";
    const items = Array.from(html.querySelectorAll(productContainer))
      .map((el, u) => {
        // Get image source
        const imageEl = el.querySelector(imageSel);
        const image = imageEl?.getAttribute("src") || imageEl?.getAttribute("data-defer-load");

        // Get product name
        const name = (el.querySelector(nameSel)?.textContent || "").trim();

        // Get price
        const { currency, price } = this.getPriceData(el.querySelector(priceSel)?.textContent || "");

        // Get link
        const link = el.querySelector(linkSel)?.getAttribute("href");

        // Parse status/condition from subtitle
        const statusElements = el.querySelectorAll(statusSel);
        const status = Array.from(statusElements).map(el => el.textContent?.trim()).join(" · ");

        // Parse all attribute rows to extract various data
        const attributeRows = Array.from(el.querySelectorAll(watchCount));
        let location = "";
        let watchCountNum = 0;
        let soldCountNum = 0;
        let shippingCostData = { currency: "", price: 0 };
        let seller = { name: "", reviews: 0, positivePercentage: 0 };

        attributeRows.forEach(row => {
          const text = row.textContent?.trim() || "";
          
          // Extract location
          if (text.includes("Located in")) {
            location = text.replace("Located in", "").trim();
          }
          
          // Extract watch count
          if (text.includes("watchers")) {
            watchCountNum = this.getNumber(text);
          }
          
          // Extract sold count
          if (text.includes("sold")) {
            soldCountNum = this.getNumber(text);
          }
          
          // Extract shipping cost
          if (text.includes("delivery") || text.includes("shipping")) {
            shippingCostData = this.getPriceData(text);
          }
        });

        // Get seller info from secondary attributes
        const sellerElements = el.querySelectorAll(sellerSel);
        if (sellerElements.length >= 2) {
          const sellerName = sellerElements[0]?.textContent?.trim() || "";
          const sellerRatingText = sellerElements[1]?.textContent?.trim() || "";
          
          // Parse seller rating which is in format "0% positive (0)"
          const ratingMatch = sellerRatingText.match(/(\d+)%\s+positive\s+\((\d+)\)/);
          if (ratingMatch) {
            const positivePercentage = parseInt(ratingMatch[1]);
            const reviews = parseInt(ratingMatch[2]);
            seller = { name: sellerName, reviews, positivePercentage };
          } else {
            seller = { name: sellerName, reviews: 0, positivePercentage: 0 };
          }
        }

        return {
          image,
          name,
          currency,
          price,
          location: this.fixLocation(location),
          originalPrice: { currency: "", price: 0 }, // Not easily extractable from new structure
          shippingCost: shippingCostData,
          seller,
          status,
          watchCount: watchCountNum,
          soldCount: soldCountNum,
          bidCount: 0, // Not visible in new structure
          link: this.fixLink(link),
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


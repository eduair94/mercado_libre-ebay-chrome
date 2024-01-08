class StoreFront {
  protected origin: string;
  fixLocation(location: string) {
    return location.replace("from", "").trim();
  }
  fixLink(link: string) {
    if (link.startsWith("http")) return link;
    console.log("origin", this.origin);
    return this.origin + link;
  }
  getNumber(inputString: string) {
    const pr = inputString.replace(/(\.|\,)/g, "");
    const numberMatch = pr.match(/\d+/);
    // Check if a match was found
    if (numberMatch !== null) {
      // Extracted number as a string
      const numberString = numberMatch.join("");

      // Convert the number string to an integer or float as needed
      const number = parseInt(numberString);

      return number;
    } else {
      return 0;
    }
  }
  getSellerData(inputString: string) {
    const regex = /([^(]+)\s*\(([\d,.]+)\)\s*([\d,.]+)%/;
    const match = inputString.match(regex);
    if (match !== null) {
      // Extracted seller name, number of reviews, and percentage of positive reviews
      const name = match[1].trim();
      const reviews = parseFloat(match[2].replace(/(\.|\,)/g, ""));
      const positivePercentage = parseFloat(match[3].replace(",", "."));
      return { name, reviews, positivePercentage };
    }
  }
  getPriceData(pr: string) {
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

export default StoreFront;

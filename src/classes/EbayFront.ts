class EbayFront {
	constructor() {
		
	}
    fixLocation(location: string) {
        return location.replace('from', '').trim();
    }
    parseHTML(data: string) {
        const $p = $($.parseHTML(data));
		const productContainer = '.srp-results > li';
		const imageSel = 'img';
		const nameSel = '[role="heading"]';
		const priceSel = '.s-item__price';
		const sellerSel = '.s-item__seller-info-text';
		const statusSel = '.SECONDARY_INFO';
		const watchCount = '.s-item__watchCountTotal';
		const soldCount = '.s-item__quantitySold';
		const shippingCost = '.s-item__logisticsCost';
		const originalPrice = '.s-item__trending-price .STRIKETHROUGH';
		const locationSel = '.s-item__itemLocation';
		const bidCount = '.s-item__bidCount';
		const totalResults = '.srp-controls__count-heading';
		const pageSel = '.pagination__item[href="#"]';
        const linkSel = '.s-item__link';
		const items = $p.find(productContainer)
            .map((i, a) => {
                const el = $(a);
				const { currency, price } = this.getPriceData(el.find(priceSel).text());
				return {
					image: el.find(imageSel).attr('src'),
					name: el.find(nameSel).text().trim(),
					currency,
					price,
					location: this.fixLocation(el.find(locationSel).text()),
					originalPrice: this.getPriceData(el.find(originalPrice).text()),
					shippingCost: this.getPriceData(el.find(shippingCost).text()),
					seller: this.getSellerData(el.find(sellerSel).text()),
					status: el.find(statusSel).text(),
					watchCount: this.getNumber(el.find(watchCount).text()),
					soldCount: this.getNumber(el.find(soldCount).text()),
					bidCount: this.getNumber(el.find(bidCount).text()),
					link: el.find(linkSel).attr('href')
				};
			})
			.get()
			.filter((el) => el.name);

		const total = this.getNumber($(totalResults).text());
		const totalPages = Math.ceil(total / items.length);
		const res = { items, total, totalPages, proxy: '' };
		return res;
	}
	getNumber(inputString: string) {
		const pr = inputString.replace(/(\.|\,)/g, '');
		const numberMatch = pr.match(/\d+/);
		// Check if a match was found
		if (numberMatch !== null) {
			// Extracted number as a string
			const numberString = numberMatch.join('');

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
			const reviews = parseFloat(match[2].replace(/(\.|\,)/g, ''));
			const positivePercentage = parseFloat(match[3].replace(',', '.'));
			return { name, reviews, positivePercentage };
		} else {
			console.log('Information not found in the input string.');
		}
	}
	getPriceData(pr: string) {
		let prNoSpaces = pr.replace(/\s/g, '');
		const currencyMatch = prNoSpaces.match(/[A-Z]+/);
		const priceMatch = prNoSpaces.match(/\d+\.\d+/g);
		let currency = 'USD';
		let price = 0;
		if (priceMatch) {
			price = parseFloat(priceMatch[0]);
        }
        if (price) {
           if (currencyMatch) {
                currency = currencyMatch[0];
            } 
        } else {
            currency = '';
        }
		return { currency, price: price };
	}
}

const ebayFront = new EbayFront();
export { ebayFront };

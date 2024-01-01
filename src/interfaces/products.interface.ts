export interface Item {
  image: string | null;
  name: string;
  currency: string;
  price: number;
  location: string;
  originalPrice: { currency: string; price: number };
  shippingCost: { currency: string; price: number };
  seller: { name: string; reviews: number; positivePercentage: number } | undefined;
  status: string;
  watchCount: number;
  soldCount: number;
  bidCount: number;
  link: string | null;
}

export interface ParseHTMLResult {
  items: Item[];
  total: number;
  totalPages: number;
  proxy: string;
}

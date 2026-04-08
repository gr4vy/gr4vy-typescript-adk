export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
}

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface EmbedConfig {
  token: string;
  gr4vy_id: string;
  environment: string;
  currency: string;
  country: string;
  merchant_account_id: string;
  amount: number;
}

export interface CatalogData {
  products: Product[];
  categories: string[];
  initialFilter?: string;
}

export interface CartData {
  items: CartItem[];
}

export interface CheckoutData {
  items: CartItem[];
  embed: EmbedConfig;
}

export interface PaymentResult {
  transaction_id?: string;
  status: string;
  amount?: string;
  items?: string[];
  card?: string;
  message?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  sunlight: "Low Light" | "Indirect Light" | "Full Sun";
  water: "Low" | "Moderate" | "Frequent";
  climate: "Tropical" | "Arid" | "Temperate";
}

export interface FilterOptions {
  sunlight: string[];
  water: string[];
  climate: string[];
}

export interface ActiveFilters {
  sunlight?: string[];
  water?: string[];
  climate?: string[];
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
  filters: FilterOptions;
  initialFilters?: ActiveFilters;
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

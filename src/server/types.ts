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

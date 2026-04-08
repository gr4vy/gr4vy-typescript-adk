export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  image?: string;
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

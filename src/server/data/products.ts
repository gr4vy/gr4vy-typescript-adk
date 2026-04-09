import type { Product } from "../types.js";

export const PRODUCTS: Product[] = [
  {
    id: "aloe-vera",
    name: "Aloe Vera",
    price: 14.99,
    description:
      "Low-maintenance succulent with air-purifying qualities",
    image:
      "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=400&h=300&fit=crop",
    sunlight: "Full Sun",
    water: "Low",
    climate: "Arid",
  },
  {
    id: "monstera",
    name: "Monstera Deliciosa",
    price: 34.99,
    description:
      "Iconic split-leaf tropical plant, thrives in indirect light",
    image:
      "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=400&h=300&fit=crop",
    sunlight: "Indirect Light",
    water: "Moderate",
    climate: "Tropical",
  },
  {
    id: "snake-plant",
    name: "Snake Plant",
    price: 24.99,
    description:
      "Nearly indestructible, perfect for beginners and low light",
    image:
      "https://images.unsplash.com/photo-1572688484438-313a56e6f908?w=400&h=300&fit=crop",
    sunlight: "Low Light",
    water: "Low",
    climate: "Temperate",
  },
  {
    id: "pothos",
    name: "Golden Pothos",
    price: 12.99,
    description:
      "Fast-growing trailing vine, great for shelves and hangers",
    image:
      "https://images.unsplash.com/photo-1637967886160-fd78dc3ce3f5?w=400&h=300&fit=crop",
    sunlight: "Low Light",
    water: "Moderate",
    climate: "Tropical",
  },
  {
    id: "peace-lily",
    name: "Peace Lily",
    price: 18.99,
    description:
      "Elegant blooming plant that thrives in shade",
    image:
      "https://images.unsplash.com/photo-1593691509543-c55fb32d8de5?w=400&h=300&fit=crop",
    sunlight: "Low Light",
    water: "Moderate",
    climate: "Tropical",
  },
  {
    id: "cactus",
    name: "Barrel Cactus",
    price: 9.99,
    description:
      "Compact desert cactus, needs minimal watering",
    image:
      "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400&h=300&fit=crop",
    sunlight: "Full Sun",
    water: "Low",
    climate: "Arid",
  },
  {
    id: "fiddle-leaf-fig",
    name: "Fiddle Leaf Fig",
    price: 29.99,
    description:
      "Dramatic large-leaf tree, a stylish statement plant",
    image:
      "https://images.unsplash.com/photo-1545241047-6083a3684587?w=400&h=300&fit=crop",
    sunlight: "Indirect Light",
    water: "Moderate",
    climate: "Temperate",
  },
  {
    id: "boston-fern",
    name: "Boston Fern",
    price: 16.99,
    description:
      "Lush hanging fern that loves humidity and moisture",
    image:
      "https://images.unsplash.com/photo-1597055181321-e0d5e5cf25cf?w=400&h=300&fit=crop",
    sunlight: "Indirect Light",
    water: "Frequent",
    climate: "Tropical",
  },
  {
    id: "lavender",
    name: "Lavender",
    price: 11.99,
    description:
      "Fragrant flowering herb, loves sunshine and well-drained soil",
    image:
      "https://images.unsplash.com/photo-1611909023032-2d6b3134ecba?w=400&h=300&fit=crop",
    sunlight: "Full Sun",
    water: "Moderate",
    climate: "Temperate",
  },
  {
    id: "calathea",
    name: "Calathea",
    price: 22.99,
    description:
      "Striking patterned leaves that fold up at night",
    image:
      "https://images.unsplash.com/photo-1637967886160-fd78dc3ce3f5?w=400&h=300&fit=crop",
    sunlight: "Low Light",
    water: "Frequent",
    climate: "Tropical",
  },
  {
    id: "rosemary",
    name: "Rosemary",
    price: 8.99,
    description:
      "Aromatic culinary herb, thrives in warm sunny spots",
    image:
      "https://images.unsplash.com/photo-1515586000433-45406d8e6662?w=400&h=300&fit=crop",
    sunlight: "Full Sun",
    water: "Frequent",
    climate: "Temperate",
  },
  {
    id: "jade-plant",
    name: "Jade Plant",
    price: 19.99,
    description:
      "Hardy succulent with thick glossy leaves, symbol of good luck",
    image:
      "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=400&h=300&fit=crop",
    sunlight: "Indirect Light",
    water: "Low",
    climate: "Arid",
  },
];

export interface ProductFilters {
  sunlight?: string | string[];
  water?: string | string[];
  climate?: string | string[];
}

function matchesFilter(value: string, filter?: string | string[]): boolean {
  if (!filter) return true;
  if (Array.isArray(filter)) return filter.length === 0 || filter.includes(value);
  return value === filter;
}

export function getProducts(filters?: ProductFilters): Product[] {
  if (!filters) return PRODUCTS;
  return PRODUCTS.filter((p) => {
    if (!matchesFilter(p.sunlight, filters.sunlight)) return false;
    if (!matchesFilter(p.water, filters.water)) return false;
    if (!matchesFilter(p.climate, filters.climate)) return false;
    return true;
  });
}

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export interface FilterOptions {
  sunlight: string[];
  water: string[];
  climate: string[];
}

export function getFilterOptions(): FilterOptions {
  return {
    sunlight: [...new Set(PRODUCTS.map((p) => p.sunlight))].sort(),
    water: [...new Set(PRODUCTS.map((p) => p.water))].sort(),
    climate: [...new Set(PRODUCTS.map((p) => p.climate))].sort(),
  };
}

import type { Product } from "../types.js";

export const PRODUCTS: Product[] = [
  // Mountain Bikes
  {
    id: "trail-blazer-29er",
    name: "Trail Blazer 29er",
    category: "Mountain Bikes",
    price: 899.99,
    description:
      "Full-suspension 29er with 130mm travel, perfect for technical trails and all-day adventures.",
  },
  {
    id: "rock-hopper-pro",
    name: "Rock Hopper Pro",
    category: "Mountain Bikes",
    price: 649.99,
    description:
      "Hardtail aluminum frame with hydraulic disc brakes and a RockShox fork for trail riding.",
  },
  {
    id: "summit-ridge",
    name: "Summit Ridge",
    category: "Mountain Bikes",
    price: 1299.99,
    description:
      "Carbon fiber enduro bike with 160mm travel, dropper post, and aggressive geometry.",
  },
  {
    id: "dirt-devil-jr",
    name: "Dirt Devil Jr",
    category: "Mountain Bikes",
    price: 349.99,
    description:
      "Youth mountain bike with 24-inch wheels, front suspension, and lightweight alloy frame.",
  },

  // Road Bikes
  {
    id: "aero-sprinter",
    name: "Aero Sprinter",
    category: "Road Bikes",
    price: 1199.99,
    description:
      "Aerodynamic carbon frame with Shimano 105 groupset, built for speed and race-day performance.",
  },
  {
    id: "gran-fondo-touring",
    name: "Gran Fondo Touring",
    category: "Road Bikes",
    price: 799.99,
    description:
      "Endurance geometry with disc brakes and wider tire clearance, built for long-distance comfort.",
  },
  {
    id: "velocity-ti",
    name: "Velocity Ti",
    category: "Road Bikes",
    price: 2499.99,
    description:
      "Titanium frame with Ultegra Di2 electronic shifting — the ultimate ride quality.",
  },

  // E-Bikes
  {
    id: "volt-cruiser",
    name: "Volt Cruiser",
    category: "E-Bikes",
    price: 1899.99,
    description:
      "500W mid-drive motor with 60-mile range and step-through frame for easy mounting.",
  },
  {
    id: "thunder-commuter",
    name: "Thunder Commuter",
    category: "E-Bikes",
    price: 1499.99,
    description:
      "Integrated lights, fenders, and rear rack with a 350W hub motor for daily commuting.",
  },
  {
    id: "peak-power-mtb-e",
    name: "Peak Power MTB-E",
    category: "E-Bikes",
    price: 2799.99,
    description:
      "Full-suspension e-mountain bike with Bosch CX motor and 625Wh battery for epic rides.",
  },

  // Accessories
  {
    id: "carbon-helmet-pro",
    name: "Carbon Helmet Pro",
    category: "Accessories",
    price: 89.99,
    description:
      "MIPS-equipped lightweight road helmet with aerodynamic vents and adjustable fit system.",
  },
  {
    id: "multi-tool-kit",
    name: "Multi-Tool Kit",
    category: "Accessories",
    price: 24.99,
    description:
      "16-function bicycle multi-tool with chain breaker, hex keys, and Torx drivers.",
  },
  {
    id: "floor-pump-elite",
    name: "Floor Pump Elite",
    category: "Accessories",
    price: 49.99,
    description:
      "High-pressure floor pump with digital gauge, compatible with Presta and Schrader valves.",
  },
  {
    id: "waterproof-panniers",
    name: "Waterproof Panniers",
    category: "Accessories",
    price: 119.99,
    description:
      "Roll-top waterproof pannier bags with 25L capacity per side, quick-release mounting.",
  },
];

export function getProducts(category?: string): Product[] {
  if (category) {
    return PRODUCTS.filter(
      (p) => p.category.toLowerCase() === category.toLowerCase()
    );
  }
  return PRODUCTS;
}

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function getCategories(): string[] {
  return [...new Set(PRODUCTS.map((p) => p.category))].sort();
}

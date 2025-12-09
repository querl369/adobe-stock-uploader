/**
 * Adobe Stock Category Taxonomy
 *
 * Complete mapping of all 21 official Adobe Stock categories.
 * Used for validating AI-generated categories and mapping category names to IDs.
 *
 * Story 3.2: Adobe Stock Category Taxonomy
 * 
 * @see https://helpx.adobe.com/stock/contributor/help/categories.html
 * 
 */

/**
 * Complete mapping of Adobe Stock category IDs to their official names
 *
 * All 21 categories match Adobe Stock documentation exactly.
 * Uses `as const` for TypeScript type safety and inference.
 */
export const ADOBE_STOCK_CATEGORIES = {
  1: 'Animals',
  2: 'Buildings and Architecture',
  3: 'Business',
  4: 'Drinks',
  5: 'The Environment',
  6: 'States of Mind',
  7: 'Food',
  8: 'Graphic Resources',
  9: 'Hobbies and Leisure',
  10: 'Industry',
  11: 'Landscape',
  12: 'Lifestyle',
  13: 'People',
  14: 'Plants and Flowers',
  15: 'Culture and Religion',
  16: 'Science',
  17: 'Social Issues',
  18: 'Sports',
  19: 'Technology',
  20: 'Transport',
  21: 'Travel',
} as const;

/**
 * Type for valid Adobe Stock category IDs (1-21)
 */
export type CategoryId = keyof typeof ADOBE_STOCK_CATEGORIES;

/**
 * Type for valid Adobe Stock category names
 */
export type CategoryName = (typeof ADOBE_STOCK_CATEGORIES)[CategoryId];

/**
 * Minimum valid category ID
 */
export const MIN_CATEGORY_ID = 1;

/**
 * Maximum valid category ID
 */
export const MAX_CATEGORY_ID = 21;

/**
 * Default category ID used when no match is found
 * "Animals" is used as the default fallback
 */
export const DEFAULT_CATEGORY_ID = 1;

/**
 * Reverse lookup map: normalized category name → category ID
 *
 * Pre-computed for O(1) lookups during fuzzy matching.
 * Keys are lowercase for case-insensitive matching.
 */
export const CATEGORY_NAME_TO_ID: Record<string, number> = Object.entries(
  ADOBE_STOCK_CATEGORIES
).reduce(
  (acc, [id, name]) => {
    acc[name.toLowerCase()] = Number(id);
    return acc;
  },
  {} as Record<string, number>
);

/**
 * Common variations and aliases for category names
 *
 * Maps alternative names to canonical category IDs.
 * Used for fuzzy matching when AI returns non-exact category names.
 *
 * @example
 * "animal" → 1 (canonical: "Animals")
 * "architecture" → 2 (canonical: "Buildings and Architecture")
 * "tech" → 19 (canonical: "Technology")
 */
export const CATEGORY_ALIASES: Record<string, number> = {
  // Category 1: Animals
  animal: 1,
  pet: 1,
  pets: 1,
  wildlife: 1,
  insect: 1,
  insects: 1,

  // Category 2: Buildings and Architecture
  building: 2,
  buildings: 2,
  architecture: 2,
  interior: 2,
  interiors: 2,
  home: 2,
  homes: 2,
  house: 2,
  houses: 2,
  structure: 2,
  structures: 2,

  // Category 3: Business
  office: 3,
  finance: 3,
  money: 3,
  corporate: 3,
  work: 3,
  meeting: 3,

  // Category 4: Drinks
  drink: 4,
  beverage: 4,
  beverages: 4,
  wine: 4,
  beer: 4,
  cocktail: 4,
  cocktails: 4,
  coffee: 4,

  // Category 5: The Environment
  environment: 5,
  nature: 5,
  eco: 5,
  ecological: 5,
  natural: 5,
  outdoor: 5,
  outdoors: 5,

  // Category 6: States of Mind
  emotion: 6,
  emotions: 6,
  emotional: 6,
  feeling: 6,
  feelings: 6,
  mood: 6,
  moods: 6,
  mental: 6,
  psychology: 6,
  'state of mind': 6,

  // Category 7: Food
  meal: 7,
  meals: 7,
  eating: 7,
  cuisine: 7,
  dish: 7,
  dishes: 7,
  recipe: 7,
  recipes: 7,
  cooking: 7,

  // Category 8: Graphic Resources
  graphic: 8,
  graphics: 8,
  background: 8,
  backgrounds: 8,
  texture: 8,
  textures: 8,
  pattern: 8,
  patterns: 8,
  symbol: 8,
  symbols: 8,
  abstract: 8,

  // Category 9: Hobbies and Leisure
  hobby: 9,
  hobbies: 9,
  leisure: 9,
  pastime: 9,
  recreation: 9,
  relaxation: 9,
  crafts: 9,
  craft: 9,
  diy: 9,

  // Category 10: Industry
  industrial: 10,
  manufacturing: 10,
  factory: 10,
  factories: 10,
  production: 10,
  construction: 10,
  engineering: 10,

  // Category 11: Landscape
  landscapes: 11,
  vista: 11,
  vistas: 11,
  scenery: 11,
  scenic: 11,
  panorama: 11,
  panoramic: 11,
  city: 11,
  cities: 11,
  cityscape: 11,

  // Category 12: Lifestyle
  life: 12,
  living: 12,
  everyday: 12,
  daily: 12,
  routine: 12,

  // Category 13: People
  person: 13,
  human: 13,
  humans: 13,
  portrait: 13,
  portraits: 13,
  face: 13,
  faces: 13,
  man: 13,
  woman: 13,
  child: 13,
  children: 13,
  family: 13,

  // Category 14: Plants and Flowers
  plant: 14,
  plants: 14,
  flower: 14,
  flowers: 14,
  floral: 14,
  botanical: 14,
  garden: 14,
  gardening: 14,
  tree: 14,
  trees: 14,

  // Category 15: Culture and Religion
  culture: 15,
  cultural: 15,
  religion: 15,
  religious: 15,
  tradition: 15,
  traditions: 15,
  traditional: 15,
  spiritual: 15,
  faith: 15,
  ceremony: 15,
  ritual: 15,

  // Category 16: Science
  scientific: 16,
  research: 16,
  laboratory: 16,
  lab: 16,
  experiment: 16,
  medical: 16,
  medicine: 16,
  biology: 16,
  chemistry: 16,
  physics: 16,

  // Category 17: Social Issues
  social: 17,
  society: 17,
  poverty: 17,
  inequality: 17,
  politics: 17,
  political: 17,
  protest: 17,
  activism: 17,

  // Category 18: Sports
  sport: 18,
  athletic: 18,
  athletics: 18,
  fitness: 18,
  exercise: 18,
  workout: 18,
  gym: 18,
  football: 18,
  basketball: 18,
  soccer: 18,
  yoga: 18,
  running: 18,

  // Category 19: Technology
  tech: 19,
  computer: 19,
  computers: 19,
  digital: 19,
  smartphone: 19,
  phone: 19,
  software: 19,
  hardware: 19,
  internet: 19,
  web: 19,
  ai: 19,
  vr: 19,
  'virtual reality': 19,

  // Category 20: Transport
  transportation: 20,
  vehicle: 20,
  vehicles: 20,
  car: 20,
  cars: 20,
  automotive: 20,
  bus: 20,
  train: 20,
  plane: 20,
  airplane: 20,
  aircraft: 20,
  ship: 20,
  boat: 20,
  highway: 20,

  // Category 21: Travel
  traveling: 21,
  travelling: 21,
  tourism: 21,
  tourist: 21,
  vacation: 21,
  holiday: 21,
  destination: 21,
  adventure: 21,
  explore: 21,
  exploration: 21,
};

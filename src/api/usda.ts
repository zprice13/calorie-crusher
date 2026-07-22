import type { Food, NutritionPer100 } from '../types'
import { ProductNotFoundError } from './openFoodFacts'

/**
 * USDA FoodData Central — the US government food database. Its Branded Foods
 * set carries UPC/GTIN codes, making it a strong fallback when Open Food
 * Facts doesn't know a product. DEMO_KEY works without signup but is
 * rate-limited (~30 req/hour per IP); a personal key from api.data.gov is
 * free and instant.
 */
const DEMO_KEY = 'DEMO_KEY'

// FDC nutrient ids (values in the search response are per 100 g/ml).
const NUTRIENT_IDS = {
  kcal: 1008,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  fiber: 1079,
  sugar: 2000,
  sodium: 1093,
} as const

interface FdcNutrient {
  nutrientId: number
  unitName?: string
  value?: number
}

interface FdcFood {
  fdcId: number
  description?: string
  brandOwner?: string
  brandName?: string
  gtinUpc?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  foodNutrients?: FdcNutrient[]
}

function nutrient(food: FdcFood, id: number): number | undefined {
  return food.foodNutrients?.find((n) => n.nutrientId === id)?.value
}

/** FDC branded descriptions are SHOUTED; calm them down. */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s(/-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase())
    .trim()
}

function toFood(f: FdcFood, barcode: string): Food | null {
  const kcal = nutrient(f, NUTRIENT_IDS.kcal)
  if (kcal == null || !f.description) return null
  const per100: NutritionPer100 = {
    kcal: Math.round(kcal),
    protein: nutrient(f, NUTRIENT_IDS.protein) ?? 0,
    carbs: nutrient(f, NUTRIENT_IDS.carbs) ?? 0,
    fat: nutrient(f, NUTRIENT_IDS.fat) ?? 0,
    fiber: nutrient(f, NUTRIENT_IDS.fiber),
    sugar: nutrient(f, NUTRIENT_IDS.sugar),
    sodium: nutrient(f, NUTRIENT_IDS.sodium),
  }
  const unitOk = /^(g|grm|ml|mlt)$/i.test(f.servingSizeUnit ?? '')
  const servingGrams = unitOk && f.servingSize && f.servingSize > 0 ? f.servingSize : undefined
  return {
    id: barcode,
    name: titleCase(f.description),
    brand: f.brandName ? titleCase(f.brandName) : f.brandOwner ? titleCase(f.brandOwner) : undefined,
    per100,
    servingGrams,
    servingLabel: f.householdServingFullText?.toLowerCase() || undefined,
    source: 'usda',
    lastUsed: Date.now(),
  }
}

/** GTIN digits vary (12-digit UPC-A vs 13/14-digit EAN/GTIN); try the common forms. */
function barcodeVariants(barcode: string): string[] {
  const variants = new Set<string>([barcode])
  variants.add(barcode.replace(/^0+/, ''))
  variants.add(barcode.padStart(13, '0'))
  variants.add(barcode.padStart(14, '0'))
  return [...variants].filter((v) => v.length >= 8)
}

/** Look up a UPC/EAN in USDA FoodData Central's branded foods. */
export async function lookupBarcodeUsda(barcode: string, apiKey?: string): Promise<Food> {
  const key = apiKey?.trim() || DEMO_KEY
  for (const code of barcodeVariants(barcode)) {
    const url =
      'https://api.nal.usda.gov/fdc/v1/foods/search?' +
      new URLSearchParams({
        api_key: key,
        query: code,
        dataType: 'Branded',
        pageSize: '5',
      })
    const res = await fetch(url)
    if (res.status === 429) throw new Error('USDA rate limit hit — try again in an hour or add a free API key in Goals.')
    if (!res.ok) throw new Error(`USDA request failed (${res.status})`)
    const data = await res.json()
    const foods: FdcFood[] = data.foods ?? []
    // The query matches any field; require the GTIN to actually match.
    const hit = foods.find((f) => (f.gtinUpc ?? '').replace(/^0+/, '') === code.replace(/^0+/, ''))
    if (hit) {
      const food = toFood(hit, barcode)
      if (food) return food
    }
  }
  throw new ProductNotFoundError(barcode)
}

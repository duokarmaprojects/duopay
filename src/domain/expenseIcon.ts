export type ExpenseCategory =
  | "FOOD"
  | "COFFEE"
  | "GROCERIES"
  | "TRAVEL"
  | "FLIGHT"
  | "HOTEL"
  | "TRANSPORT"
  | "FUEL"
  | "ENTERTAINMENT"
  | "SHOPPING"
  | "RENT"
  | "HEALTH"
  | "GYM"
  | "BILLS"
  | "EDUCATION"
  | "GIFT"
  | "ELECTRONICS"
  | "HOME"
  | "OTHER";

const CATEGORY_KEYWORDS: Record<ExpenseCategory, string[]> = {
  FOOD: ["pizza", "burger", "restaurant", "dinner", "lunch", "food", "meal", "swiggy", "zomato", "eat", "breakfast"],
  COFFEE: ["coffee", "cafe", "cappuccino", "latte", "starbucks", "espresso", "tea", "chai"],
  GROCERIES: ["grocery", "groceries", "supermarket", "vegetable", "fruit", "milk", "mart", "store", "blinkit", "zepto", "instamart"],
  TRANSPORT: ["uber", "ola", "taxi", "cab", "auto", "rickshaw", "bus", "train", "metro", "transit", "ride"],
  FLIGHT: ["flight", "airplane", "airport", "plane", "indigo", "air india", "airlines"],
  HOTEL: ["hotel", "hostel", "stay", "booking", "airbnb", "oyo", "room", "resort"],
  TRAVEL: ["travel", "trip", "tour", "holiday", "vacation"],
  FUEL: ["petrol", "diesel", "fuel", "gas", "pump"],
  ENTERTAINMENT: ["movie", "cinema", "netflix", "prime", "game", "show", "ticket", "concert", "party", "club", "spotify"],
  SHOPPING: ["shopping", "clothes", "mall", "amazon", "flipkart", "myntra", "shoes", "apparel"],
  RENT: ["rent", "apartment", "landlord", "flat", "lease"],
  HEALTH: ["medicine", "doctor", "pharmacy", "hospital", "clinic", "health", "dental", "medical"],
  GYM: ["gym", "fitness", "workout", "protein", "supplement", "training"],
  BILLS: ["bill", "electricity", "water", "internet", "wifi", "broadband", "recharge", "mobile", "utility"],
  EDUCATION: ["course", "tuition", "school", "college", "book", "education", "class"],
  GIFT: ["gift", "birthday", "present", "anniversary", "wedding", "flower", "cake"],
  ELECTRONICS: ["laptop", "computer", "monitor", "keyboard", "mouse", "electronics", "phone", "mobile", "charger", "cable", "headphone", "earphone", "tv"],
  HOME: ["home", "furniture", "decor", "kitchen", "repair", "maintenance", "plumber", "electrician"],
  OTHER: []
};

/**
 * Derives an expense category purely from the description string.
 * Case-insensitive keyword matching.
 */
export function getExpenseCategory(description?: string | null): ExpenseCategory {
  if (!description) return "OTHER";
  
  const normalized = description.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => normalized.includes(keyword))) {
      return category as ExpenseCategory;
    }
  }

  return "OTHER";
}

import {
  // POPULAR / GENERIC
  Users, UsersRound, Star, Sparkles, Home, Map, Plane, Coffee, Pizza, Briefcase, GraduationCap, Dumbbell, Wallet, Heart,
  // TRAVEL
  Luggage, Hotel, Car, TrainFront, Bus, Ship, Mountain, Umbrella, Tent,
  // FOOD
  Utensils, Cake, Wine, ChefHat, ShoppingBasket, Apple,
  // HOME
  Sofa, Bed, Key, Lamp, Wrench, Hammer,
  // WORK
  Laptop, Building2, Presentation, Calendar, FileText, Calculator, PieChart,
  // COLLEGE
  Book, Library, Pencil, Microscope, School, Notebook,
  // SPORTS
  Trophy, Bike, Medal, Target,
  // ENTERTAINMENT
  Gamepad2, Music, Film, Camera, Headphones, Mic, Guitar, Ticket,
  // SHOPPING
  ShoppingBag, ShoppingCart, Tag, Gift, Watch, Shirt, Store,
  // FINANCE
  Landmark, CreditCard, Coins, Receipt, Banknote, PiggyBank,
  // NATURE
  TreePine, Flower2, Sun, Moon, Waves, Leaf, Cloud
} from "lucide-react"

export type GroupIconCategory = 
  | "Popular" | "People" | "Food" | "Travel" | "Home" 
  | "College" | "Work" | "Sports" | "Entertainment" 
  | "Shopping" | "Finance" | "Nature" | "Events" | "Other"

export interface GroupIconDefinition {
  id: string;
  label: string;
  category: GroupIconCategory;
  keywords: string[];
  icon: any; // LucideIcon component
}

export const GROUP_ICONS: GroupIconDefinition[] = [
  // POPULAR / PEOPLE
  { id: "users", label: "Users", category: "People", keywords: ["people", "group", "friends", "team", "family"], icon: Users },
  { id: "users-round", label: "Friends", category: "People", keywords: ["people", "friends", "buddies", "circle"], icon: UsersRound },
  { id: "heart", label: "Heart", category: "People", keywords: ["love", "couple", "partner", "romance"], icon: Heart },

  // TRAVEL
  { id: "plane", label: "Plane", category: "Travel", keywords: ["travel", "trip", "flight", "vacation", "holiday", "airport"], icon: Plane },
  { id: "map", label: "Map", category: "Travel", keywords: ["travel", "trip", "location", "destination", "navigate"], icon: Map },
  { id: "luggage", label: "Luggage", category: "Travel", keywords: ["travel", "trip", "baggage", "suitcase", "vacation"], icon: Luggage },
  { id: "hotel", label: "Hotel", category: "Travel", keywords: ["travel", "stay", "accommodation", "resort", "motel"], icon: Hotel },
  { id: "car", label: "Car", category: "Travel", keywords: ["drive", "roadtrip", "vehicle", "auto", "taxi", "uber"], icon: Car },
  { id: "train", label: "Train", category: "Travel", keywords: ["travel", "transit", "subway", "metro", "railway"], icon: TrainFront },
  { id: "bus", label: "Bus", category: "Travel", keywords: ["travel", "transit", "coach", "public"], icon: Bus },
  { id: "ship", label: "Ship", category: "Travel", keywords: ["cruise", "boat", "ferry", "sea", "ocean"], icon: Ship },
  { id: "mountain", label: "Mountain", category: "Travel", keywords: ["hike", "nature", "climb", "peak", "trip"], icon: Mountain },
  { id: "beach", label: "Beach", category: "Travel", keywords: ["vacation", "sea", "sand", "summer", "holiday"], icon: Umbrella },
  { id: "tent", label: "Camping", category: "Travel", keywords: ["tent", "camp", "outdoors", "nature"], icon: Tent },

  // FOOD
  { id: "pizza", label: "Pizza", category: "Food", keywords: ["food", "eat", "dinner", "lunch", "restaurant", "slice"], icon: Pizza },
  { id: "utensils", label: "Dining", category: "Food", keywords: ["food", "restaurant", "eat", "meal", "fork", "knife"], icon: Utensils },
  { id: "coffee", label: "Coffee", category: "Food", keywords: ["drink", "cafe", "latte", "espresso", "tea"], icon: Coffee },
  { id: "cake", label: "Cake", category: "Food", keywords: ["dessert", "sweet", "birthday", "party", "bake"], icon: Cake },
  { id: "wine", label: "Wine", category: "Food", keywords: ["drink", "alcohol", "bar", "party", "cheers", "glass"], icon: Wine },
  { id: "chef", label: "Cooking", category: "Food", keywords: ["food", "cook", "chef", "kitchen", "recipe"], icon: ChefHat },
  { id: "groceries", label: "Groceries", category: "Food", keywords: ["food", "shop", "supermarket", "basket", "vegetables"], icon: ShoppingBasket },
  { id: "apple", label: "Fruit", category: "Food", keywords: ["food", "healthy", "snack", "fruit"], icon: Apple },

  // HOME
  { id: "home", label: "Home", category: "Home", keywords: ["house", "apartment", "rent", "living", "flat"], icon: Home },
  { id: "sofa", label: "Furniture", category: "Home", keywords: ["couch", "living room", "decor", "ikea"], icon: Sofa },
  { id: "bed", label: "Bedroom", category: "Home", keywords: ["sleep", "room", "mattress", "furniture"], icon: Bed },
  { id: "key", label: "Key", category: "Home", keywords: ["house", "lock", "rent", "lease", "door"], icon: Key },
  { id: "lamp", label: "Lighting", category: "Home", keywords: ["light", "electricity", "decor", "home"], icon: Lamp },
  { id: "tools", label: "Tools", category: "Home", keywords: ["repair", "maintenance", "fix", "diy", "hardware"], icon: Wrench },
  { id: "hammer", label: "Construction", category: "Home", keywords: ["build", "repair", "fix", "woodwork"], icon: Hammer },

  // WORK
  { id: "briefcase", label: "Business", category: "Work", keywords: ["job", "office", "work", "career", "professional"], icon: Briefcase },
  { id: "laptop", label: "Laptop", category: "Work", keywords: ["computer", "tech", "work", "office", "freelance"], icon: Laptop },
  { id: "building", label: "Office", category: "Work", keywords: ["company", "corporate", "work", "enterprise"], icon: Building2 },
  { id: "presentation", label: "Meeting", category: "Work", keywords: ["pitch", "conference", "boardroom", "work"], icon: Presentation },
  { id: "calendar", label: "Schedule", category: "Work", keywords: ["time", "date", "planner", "event", "appointment"], icon: Calendar },
  { id: "file", label: "Document", category: "Work", keywords: ["paper", "contract", "record", "work"], icon: FileText },

  // COLLEGE
  { id: "graduation", label: "Graduation", category: "College", keywords: ["school", "university", "degree", "education", "student"], icon: GraduationCap },
  { id: "book", label: "Book", category: "College", keywords: ["study", "read", "textbook", "education"], icon: Book },
  { id: "school", label: "School", category: "College", keywords: ["building", "education", "campus", "academy"], icon: School },
  { id: "library", label: "Library", category: "College", keywords: ["books", "study", "university", "campus"], icon: Library },
  { id: "pencil", label: "Pencil", category: "College", keywords: ["write", "draw", "study", "stationery"], icon: Pencil },
  { id: "microscope", label: "Science", category: "College", keywords: ["lab", "research", "biology", "chemistry", "experiment"], icon: Microscope },
  { id: "notebook", label: "Notebook", category: "College", keywords: ["notes", "study", "journal", "write"], icon: Notebook },

  // SPORTS
  { id: "dumbbell", label: "Gym", category: "Sports", keywords: ["workout", "fitness", "training", "exercise", "weights"], icon: Dumbbell },
  { id: "trophy", label: "Trophy", category: "Sports", keywords: ["win", "champion", "award", "prize", "competition"], icon: Trophy },
  { id: "bike", label: "Cycling", category: "Sports", keywords: ["bicycle", "ride", "workout", "fitness"], icon: Bike },
  { id: "medal", label: "Medal", category: "Sports", keywords: ["award", "win", "champion", "prize"], icon: Medal },
  { id: "target", label: "Target", category: "Sports", keywords: ["goal", "aim", "darts", "archery", "focus"], icon: Target },

  // ENTERTAINMENT
  { id: "gamepad", label: "Gaming", category: "Entertainment", keywords: ["video games", "console", "play", "gamer", "xbox", "playstation"], icon: Gamepad2 },
  { id: "music", label: "Music", category: "Entertainment", keywords: ["song", "audio", "listen", "tune", "spotify"], icon: Music },
  { id: "film", label: "Movies", category: "Entertainment", keywords: ["cinema", "video", "watch", "theater", "netflix"], icon: Film },
  { id: "camera", label: "Photography", category: "Entertainment", keywords: ["photo", "picture", "shoot", "lens"], icon: Camera },
  { id: "headphones", label: "Audio", category: "Entertainment", keywords: ["listen", "music", "podcast", "sound"], icon: Headphones },
  { id: "mic", label: "Podcast", category: "Entertainment", keywords: ["record", "sing", "karaoke", "audio", "voice"], icon: Mic },
  { id: "guitar", label: "Concert", category: "Entertainment", keywords: ["music", "band", "live", "instrument", "play"], icon: Guitar },
  { id: "ticket", label: "Tickets", category: "Entertainment", keywords: ["event", "show", "admission", "pass"], icon: Ticket },

  // SHOPPING
  { id: "shopping-bag", label: "Shopping", category: "Shopping", keywords: ["buy", "purchase", "store", "mall", "clothes"], icon: ShoppingBag },
  { id: "shopping-cart", label: "Cart", category: "Shopping", keywords: ["buy", "purchase", "ecommerce", "online", "checkout"], icon: ShoppingCart },
  { id: "tag", label: "Discount", category: "Shopping", keywords: ["price", "sale", "offer", "deal", "label"], icon: Tag },
  { id: "gift", label: "Gift", category: "Shopping", keywords: ["present", "birthday", "surprise", "box", "wrap"], icon: Gift },
  { id: "watch", label: "Accessories", category: "Shopping", keywords: ["time", "jewelry", "fashion", "wearable"], icon: Watch },
  { id: "shirt", label: "Apparel", category: "Shopping", keywords: ["clothes", "fashion", "wear", "garment", "style"], icon: Shirt },
  { id: "store", label: "Store", category: "Shopping", keywords: ["shop", "retail", "business", "market"], icon: Store },

  // FINANCE
  { id: "wallet", label: "Wallet", category: "Finance", keywords: ["money", "cash", "pay", "spend", "budget"], icon: Wallet },
  { id: "landmark", label: "Bank", category: "Finance", keywords: ["institution", "finance", "money", "deposit", "building"], icon: Landmark },
  { id: "credit-card", label: "Card", category: "Finance", keywords: ["pay", "payment", "debit", "visa", "mastercard"], icon: CreditCard },
  { id: "coins", label: "Cash", category: "Finance", keywords: ["money", "change", "currency", "wealth"], icon: Coins },
  { id: "receipt", label: "Receipt", category: "Finance", keywords: ["bill", "invoice", "payment", "expense"], icon: Receipt },
  { id: "banknote", label: "Money", category: "Finance", keywords: ["cash", "bill", "currency", "pay"], icon: Banknote },
  { id: "piggy-bank", label: "Savings", category: "Finance", keywords: ["save", "money", "deposit", "fund"], icon: PiggyBank },

  // NATURE
  { id: "tree", label: "Nature", category: "Nature", keywords: ["forest", "outdoors", "wood", "plant", "green"], icon: TreePine },
  { id: "flower", label: "Flower", category: "Nature", keywords: ["plant", "bloom", "garden", "blossom", "rose"], icon: Flower2 },
  { id: "sun", label: "Sunny", category: "Nature", keywords: ["weather", "hot", "day", "light", "summer"], icon: Sun },
  { id: "moon", label: "Night", category: "Nature", keywords: ["evening", "dark", "space", "sky", "lunar"], icon: Moon },
  { id: "waves", label: "Water", category: "Nature", keywords: ["sea", "ocean", "beach", "swim", "surf"], icon: Waves },
  { id: "leaf", label: "Eco", category: "Nature", keywords: ["plant", "green", "environment", "nature", "sustainability"], icon: Leaf },
  { id: "cloud", label: "Cloudy", category: "Nature", keywords: ["weather", "sky", "overcast", "rain"], icon: Cloud },

  // EVENTS
  { id: "sparkles", label: "Special", category: "Events", keywords: ["magic", "shiny", "new", "feature", "stars"], icon: Sparkles },
  { id: "star", label: "Star", category: "Events", keywords: ["favorite", "important", "rating", "top"], icon: Star },
];

/**
 * Legacy emoji to new vector ID mapping
 */
const EMOJI_MAPPING: Record<string, string> = {
  "🍕": "pizza", "🍔": "pizza", "☕": "coffee", "🍻": "wine", "🍷": "wine", "🎂": "cake", "🌮": "pizza", "🍣": "pizza",
  "🏖️": "beach", "✈️": "plane", "🚗": "car", "🚂": "train", "🏕️": "tent", "🏔️": "mountain", "🏨": "hotel", "🗽": "map",
  "🎉": "sparkles", "🎬": "film", "🎫": "ticket", "🎮": "gamepad", "⚽": "football", "🎵": "music", "🎤": "mic", "🎸": "guitar",
  "🏠": "home", "🛒": "shopping-cart", "🛍️": "shopping-bag", "💡": "lamp", "🔌": "tools", "🔧": "tools", "🛋️": "sofa", "🪴": "flower",
  "✨": "sparkles", "🔥": "sparkles", "💎": "sparkles", "🌟": "star", "💰": "coins", "💸": "banknote", "💼": "briefcase", "👨‍👩‍👧‍👦": "users"
};

/**
 * Resolves a stored group image/icon to a validated GroupIconDefinition.
 * Falls back to 'users' if unknown, and seamlessly maps legacy emojis.
 */
export function resolveGroupIcon(storedId: string | null | undefined): GroupIconDefinition {
  const defaultIcon = GROUP_ICONS.find(i => i.id === "users")!;
  
  if (!storedId) return defaultIcon;

  // Exact match
  const exact = GROUP_ICONS.find(i => i.id === storedId);
  if (exact) return exact;

  // Legacy emoji mapping
  const mappedId = EMOJI_MAPPING[storedId];
  if (mappedId) {
    const mappedIcon = GROUP_ICONS.find(i => i.id === mappedId);
    if (mappedIcon) return mappedIcon;
  }

  // Trim whitespace or common emoji modifiers and try again (robustness)
  const cleanId = storedId.replace(/[\uFE0F]/g, "").trim();
  const cleanMapped = EMOJI_MAPPING[cleanId];
  if (cleanMapped) {
    const cleanMappedIcon = GROUP_ICONS.find(i => i.id === cleanMapped);
    if (cleanMappedIcon) return cleanMappedIcon;
  }

  return defaultIcon;
}

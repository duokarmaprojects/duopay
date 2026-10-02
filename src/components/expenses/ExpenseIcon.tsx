import { ExpenseCategory, getExpenseCategory } from "@/domain/expenseIcon";
import {
  Pizza,
  Coffee,
  ShoppingBag,
  Map,
  Plane,
  Bed,
  Car,
  Fuel,
  Ticket,
  ShoppingBasket,
  Home,
  Stethoscope,
  Dumbbell,
  Receipt,
  Book,
  Gift,
  Laptop,
  Wrench,
  CircleDollarSign
} from "lucide-react";

interface Props {
  category?: string | null;
  description?: string;
  size?: number;
  className?: string;
}

export function ExpenseIcon({ category, description, size = 18, className = "" }: Props) {
  // Determine final category (use DB category, fallback to description logic)
  let resolvedCategory = category as ExpenseCategory;
  if (!resolvedCategory || resolvedCategory === "OTHER" && description) {
    resolvedCategory = getExpenseCategory(description);
  } else if (!resolvedCategory) {
    resolvedCategory = "OTHER";
  }

  // Determine Icon component
  let Icon = CircleDollarSign;
  let bgClass = "bg-gray-100 text-gray-500";

  switch (resolvedCategory) {
    case "FOOD": Icon = Pizza; bgClass = "bg-orange-100 text-orange-600"; break;
    case "COFFEE": Icon = Coffee; bgClass = "bg-amber-100 text-amber-600"; break;
    case "GROCERIES": Icon = ShoppingBasket; bgClass = "bg-green-100 text-green-600"; break;
    case "TRAVEL": Icon = Map; bgClass = "bg-blue-100 text-blue-600"; break;
    case "FLIGHT": Icon = Plane; bgClass = "bg-sky-100 text-sky-600"; break;
    case "HOTEL": Icon = Bed; bgClass = "bg-indigo-100 text-indigo-600"; break;
    case "TRANSPORT": Icon = Car; bgClass = "bg-yellow-100 text-yellow-600"; break;
    case "FUEL": Icon = Fuel; bgClass = "bg-red-100 text-red-600"; break;
    case "ENTERTAINMENT": Icon = Ticket; bgClass = "bg-purple-100 text-purple-600"; break;
    case "SHOPPING": Icon = ShoppingBag; bgClass = "bg-pink-100 text-pink-600"; break;
    case "RENT": Icon = Home; bgClass = "bg-teal-100 text-teal-600"; break;
    case "HEALTH": Icon = Stethoscope; bgClass = "bg-rose-100 text-rose-600"; break;
    case "GYM": Icon = Dumbbell; bgClass = "bg-zinc-100 text-zinc-600"; break;
    case "BILLS": Icon = Receipt; bgClass = "bg-slate-100 text-slate-600"; break;
    case "EDUCATION": Icon = Book; bgClass = "bg-cyan-100 text-cyan-600"; break;
    case "GIFT": Icon = Gift; bgClass = "bg-fuchsia-100 text-fuchsia-600"; break;
    case "ELECTRONICS": Icon = Laptop; bgClass = "bg-violet-100 text-violet-600"; break;
    case "HOME": Icon = Wrench; bgClass = "bg-stone-100 text-stone-600"; break;
    case "OTHER":
    default: Icon = CircleDollarSign; bgClass = "bg-gray-100 text-gray-500"; break;
  }

  return (
    <div className={`flex items-center justify-center shrink-0 transition-colors duration-300 ${bgClass} ${className}`}>
      <Icon size={size} />
    </div>
  );
}

// Helper to get raw icon component and color if needed outside the wrapper
export function getExpenseIconDetails(category: ExpenseCategory) {
  switch (category) {
    case "FOOD": return { Icon: Pizza, bgClass: "bg-orange-100 text-orange-600", label: "Food" };
    case "COFFEE": return { Icon: Coffee, bgClass: "bg-amber-100 text-amber-600", label: "Coffee" };
    case "GROCERIES": return { Icon: ShoppingBasket, bgClass: "bg-green-100 text-green-600", label: "Groceries" };
    case "TRAVEL": return { Icon: Map, bgClass: "bg-blue-100 text-blue-600", label: "Travel" };
    case "FLIGHT": return { Icon: Plane, bgClass: "bg-sky-100 text-sky-600", label: "Flight" };
    case "HOTEL": return { Icon: Bed, bgClass: "bg-indigo-100 text-indigo-600", label: "Hotel" };
    case "TRANSPORT": return { Icon: Car, bgClass: "bg-yellow-100 text-yellow-600", label: "Transport" };
    case "FUEL": return { Icon: Fuel, bgClass: "bg-red-100 text-red-600", label: "Fuel" };
    case "ENTERTAINMENT": return { Icon: Ticket, bgClass: "bg-purple-100 text-purple-600", label: "Entertainment" };
    case "SHOPPING": return { Icon: ShoppingBag, bgClass: "bg-pink-100 text-pink-600", label: "Shopping" };
    case "RENT": return { Icon: Home, bgClass: "bg-teal-100 text-teal-600", label: "Rent" };
    case "HEALTH": return { Icon: Stethoscope, bgClass: "bg-rose-100 text-rose-600", label: "Health" };
    case "GYM": return { Icon: Dumbbell, bgClass: "bg-zinc-100 text-zinc-600", label: "Gym" };
    case "BILLS": return { Icon: Receipt, bgClass: "bg-slate-100 text-slate-600", label: "Bills" };
    case "EDUCATION": return { Icon: Book, bgClass: "bg-cyan-100 text-cyan-600", label: "Education" };
    case "GIFT": return { Icon: Gift, bgClass: "bg-fuchsia-100 text-fuchsia-600", label: "Gift" };
    case "ELECTRONICS": return { Icon: Laptop, bgClass: "bg-violet-100 text-violet-600", label: "Electronics" };
    case "HOME": return { Icon: Wrench, bgClass: "bg-stone-100 text-stone-600", label: "Home" };
    case "OTHER":
    default: return { Icon: CircleDollarSign, bgClass: "bg-gray-100 text-gray-500", label: "Other" };
  }
}

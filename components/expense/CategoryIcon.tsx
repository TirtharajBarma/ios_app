import React from 'react';
import {
  Cigarette,
  Flame,
  Star,
  Heart,
  Home,
  Car,
  Plane,
  Gift,
  BookOpen,
  Music,
  Gamepad2,
  Camera,
  Wrench,
  Leaf,
  ShoppingBag,
  ShoppingCart,
  ShoppingBasket,
  Tv,
  Film,
  Zap,
  Banknote,
  UtensilsCrossed,
  Utensils,
  MoreHorizontal,
  Coins,
  Sparkles,
  Tag,
  Coffee,
  Shield,
  Smile,
  Repeat,
  Wallet,
  Landmark,
  TrendingUp,
  Folder,
  Users,
  Laptop,
  Briefcase,
  PiggyBank,
  Smartphone,
  Activity,
  Wifi,
  RefreshCw,
} from 'lucide-react-native';
import { ExpenseCategory } from '@/types/expense';

export interface CategoryIconProps {
  category?: ExpenseCategory | null;
  iconName?: string;
  catId?: string;
  color?: string;
  size?: number;
  strokeWidth?: number;
  fill?: boolean;
}

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Cigarette,
  Flame,
  Star,
  Heart,
  Home,
  Car,
  Plane,
  Gift,
  BookOpen,
  Music,
  Gamepad2,
  Camera,
  Wrench,
  Leaf,
  ShoppingBag,
  ShoppingCart,
  ShoppingBasket,
  Tv,
  Film,
  Zap,
  Banknote,
  UtensilsCrossed,
  Utensils,
  MoreHorizontal,
  Coins,
  Sparkles,
  Tag,
  Coffee,
  Shield,
  Smile,
  Repeat,
  Subscription: Repeat,
  Wallet,
  Landmark,
  TrendingUp,
  Folder,
  Users,
  Laptop,
  Briefcase,
  PiggyBank,
  Smartphone,
  Activity,
  Wifi,
  RefreshCw,
};

const DEFAULT_CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
  cat_cig: Cigarette,
  cat_health: Heart,
  cat_income: Coins,
  cat_trans: Car,
  cat_shop: ShoppingBag,
  cat_ent: Tv,
  cat_util: Zap,
  cat_fin: Banknote,
  cat_food: UtensilsCrossed,
  cat_subs: Repeat,
  cat_split_return: Users,
  cat_split: Users,
  cat_salary: Briefcase,
  cat_freelance: Laptop,
  cat_invest: TrendingUp,
  cat_bonus: Gift,
  cat_rental: Home,
  cat_refund: RefreshCw,
  cat_other_inc: Coins,
};

/**
 * Universal Category Icon component
 * Ensures 100% consistent icon and color rendering throughout the entire app
 * (Dashboard, Ledger, Visualizer, Settings, Add Transaction, Monthly Budget).
 * User-selected iconName and color in category object ALWAYS take precedence.
 */
export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  iconName,
  catId,
  color,
  size = 18,
  strokeWidth = 2,
  fill = false,
}) => {
  const resolvedName = iconName || category?.iconName || '';
  const resolvedId = catId || category?.id || '';
  const resolvedColor = color || category?.color || '#FFFFFF';

  const props: Record<string, any> = {
    size,
    color: resolvedColor,
    strokeWidth,
  };

  // 1. Direct iconName match (user customized icon)
  if (resolvedName && ICON_MAP[resolvedName]) {
    const IconComp = ICON_MAP[resolvedName];
    if (resolvedName === 'Star' || resolvedName === 'Heart') {
      props.fill = fill ? resolvedColor : 'none';
    }
    return <IconComp {...props} />;
  }

  // 2. Default category ID fallback
  if (resolvedId && DEFAULT_CATEGORY_ICONS[resolvedId]) {
    const FallbackComp = DEFAULT_CATEGORY_ICONS[resolvedId];
    if (resolvedId === 'cat_health') {
      props.fill = fill ? resolvedColor : 'none';
    }
    return <FallbackComp {...props} />;
  }

  // 3. Fallback for Misc or unknown
  return <MoreHorizontal {...props} />;
};

/**
 * Generates a clean semi-transparent background color based on the category color.
 */
export const getCategoryBgColor = (color?: string, alphaHex: string = '24'): string => {
  if (!color) return 'rgba(255, 255, 255, 0.08)';
  if (color.startsWith('#') && color.length === 7) {
    return `${color}${alphaHex}`;
  }
  return color;
};

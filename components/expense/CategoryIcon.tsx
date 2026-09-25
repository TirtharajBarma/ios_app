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

  const props = {
    size,
    color: resolvedColor,
    strokeWidth,
  };

  // 1. Check iconName first (user customized icon) & default category ID fallbacks
  if (
    resolvedName === 'Cigarette' ||
    resolvedName === 'Flame' ||
    (!resolvedName && resolvedId === 'cat_cig')
  ) {
    return <Cigarette {...props} />;
  }
  if (resolvedName === 'Star') {
    return <Star {...props} fill={fill ? resolvedColor : 'none'} />;
  }
  if (resolvedName === 'Heart' || (!resolvedName && resolvedId === 'cat_health')) {
    return <Heart {...props} fill={fill ? resolvedColor : 'none'} />;
  }
  if (resolvedName === 'Coins' || (!resolvedName && resolvedId === 'cat_income')) {
    return <Coins {...props} />;
  }
  if (resolvedName === 'Car' || (!resolvedName && resolvedId === 'cat_trans')) {
    return <Car {...props} />;
  }
  if (
    resolvedName === 'ShoppingBag' ||
    resolvedName === 'ShoppingCart' ||
    resolvedName === 'ShoppingBasket' ||
    (!resolvedName && resolvedId === 'cat_shop')
  ) {
    return <ShoppingBag {...props} />;
  }
  if (
    resolvedName === 'Tv' ||
    resolvedName === 'Film' ||
    (!resolvedName && resolvedId === 'cat_ent')
  ) {
    return <Tv {...props} />;
  }
  if (resolvedName === 'Zap' || (!resolvedName && resolvedId === 'cat_util')) {
    return <Zap {...props} />;
  }
  if (
    resolvedName === 'Banknote' ||
    resolvedName === 'Wallet' ||
    resolvedName === 'Landmark' ||
    (!resolvedName && resolvedId === 'cat_fin')
  ) {
    return <Banknote {...props} />;
  }
  if (
    resolvedName === 'UtensilsCrossed' ||
    resolvedName === 'Utensils' ||
    (!resolvedName && resolvedId === 'cat_food')
  ) {
    return <UtensilsCrossed {...props} />;
  }
  if (
    resolvedName === 'Repeat' ||
    resolvedName === 'Subscription' ||
    (!resolvedName && resolvedId === 'cat_subs')
  ) {
    return <Repeat {...props} />;
  }
  if (resolvedName === 'Home') return <Home {...props} />;
  if (resolvedName === 'Plane') return <Plane {...props} />;
  if (resolvedName === 'Gift') return <Gift {...props} />;
  if (resolvedName === 'BookOpen') return <BookOpen {...props} />;
  if (resolvedName === 'Music') return <Music {...props} />;
  if (resolvedName === 'Gamepad2') return <Gamepad2 {...props} />;
  if (resolvedName === 'Camera') return <Camera {...props} />;
  if (resolvedName === 'Wrench') return <Wrench {...props} />;
  if (resolvedName === 'Leaf') return <Leaf {...props} />;
  if (resolvedName === 'Sparkles') return <Sparkles {...props} />;
  if (resolvedName === 'Tag') return <Tag {...props} />;
  if (resolvedName === 'Coffee') return <Coffee {...props} />;
  if (resolvedName === 'Shield') return <Shield {...props} />;
  if (resolvedName === 'Smile') return <Smile {...props} />;
  if (resolvedName === 'Folder') return <Folder {...props} />;
  if (resolvedName === 'Users') return <Users {...props} />;
  if (resolvedName === 'Wallet') return <Wallet {...props} />;
  if (resolvedName === 'Landmark') return <Landmark {...props} />;
  if (resolvedName === 'TrendingUp') return <TrendingUp {...props} />;

  // Default fallback for Misc or unknown
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

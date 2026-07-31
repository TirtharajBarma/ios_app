import React from "react";
import {
  Music, Video, Gamepad2, BookOpen, Brain, Cloud, Tv, Headphones,
  Film, Code2, Database, Server, HardDrive, Globe, Mail, Camera,
  Smartphone, Monitor, ShoppingCart, Coffee, Dumbbell, Car, Plane,
  Home, Zap, Wifi, Droplets, Heart, Star, Crown, Lock, Shield,
  Bell, Calendar, Clock, type LucideIcon,
} from "lucide-react-native";

const iconMap: Record<string, LucideIcon> = {
  Music, Video, Gamepad2, BookOpen, Brain, Cloud, Tv, Headphones,
  Film, Code2, Database, Server, HardDrive, Globe, Mail, Camera,
  Smartphone, Monitor, ShoppingCart, Coffee, Dumbbell, Car, Plane,
  Home, Zap, Wifi, Droplets, Heart, Star, Crown, Lock, Shield,
  Bell, Calendar, Clock,
};

export function getLucideIcon(name: string): LucideIcon | null {
  return iconMap[name] ?? null;
}

export function isLucideIconSource(source: string): boolean {
  return source.startsWith("icon:");
}

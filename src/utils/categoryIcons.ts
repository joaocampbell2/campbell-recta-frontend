import type { ComponentType } from 'react';
import {
  Wallet,
  Briefcase,
  TrendingUp,
  ShoppingBag,
  Home,
  DollarSign,
  UtensilsCrossed,
  Car,
  House,
  Heart,
  GraduationCap,
  Film,
  Shirt,
  Zap,
  CreditCard,
  ShoppingCart,
  ShoppingBasket,
  Utensils,
  Droplet,
  Pill,
  MoreHorizontal,
  Circle,
  ArrowLeftRight,
  Tag,
  Coffee,
  Plane,
  Gift,
  Music,
  Gamepad2,
  Book,
  Wrench,
  Smartphone,
  PawPrint,
  Baby,
  Dumbbell,
  Sparkles,
  PiggyBank,
  Receipt,
  Landmark,
  Package,
  Shield,
} from 'lucide-react';

export interface CategoryIconOption {
  name: string;
  label: string;
  component: ComponentType<{ className?: string }>;
}

export const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = [
  { name: 'Tag', label: 'Etiqueta', component: Tag },
  { name: 'Wallet', label: 'Carteira', component: Wallet },
  { name: 'CreditCard', label: 'Cartão', component: CreditCard },
  { name: 'DollarSign', label: 'Dinheiro', component: DollarSign },
  { name: 'PiggyBank', label: 'Poupança', component: PiggyBank },
  { name: 'Landmark', label: 'Banco', component: Landmark },
  { name: 'Receipt', label: 'Recibo', component: Receipt },
  { name: 'TrendingUp', label: 'Investimentos', component: TrendingUp },
  { name: 'Briefcase', label: 'Trabalho', component: Briefcase },
  { name: 'ShoppingBag', label: 'Compras', component: ShoppingBag },
  { name: 'ShoppingCart', label: 'Carrinho', component: ShoppingCart },
  { name: 'ShoppingBasket', label: 'Mercado', component: ShoppingBasket },
  { name: 'Package', label: 'Pacote', component: Package },
  { name: 'UtensilsCrossed', label: 'Alimentação', component: UtensilsCrossed },
  { name: 'Utensils', label: 'Restaurante', component: Utensils },
  { name: 'Coffee', label: 'Café', component: Coffee },
  { name: 'Home', label: 'Casa', component: Home },
  { name: 'House', label: 'Moradia', component: House },
  { name: 'Car', label: 'Carro', component: Car },
  { name: 'Droplet', label: 'Combustível', component: Droplet },
  { name: 'Plane', label: 'Viagem', component: Plane },
  { name: 'Heart', label: 'Saúde', component: Heart },
  { name: 'Pill', label: 'Farmácia', component: Pill },
  { name: 'Dumbbell', label: 'Academia', component: Dumbbell },
  { name: 'GraduationCap', label: 'Educação', component: GraduationCap },
  { name: 'Book', label: 'Livros', component: Book },
  { name: 'Film', label: 'Lazer', component: Film },
  { name: 'Music', label: 'Música', component: Music },
  { name: 'Gamepad2', label: 'Jogos', component: Gamepad2 },
  { name: 'Shirt', label: 'Roupas', component: Shirt },
  { name: 'Zap', label: 'Energia / Contas', component: Zap },
  { name: 'Smartphone', label: 'Celular / Tech', component: Smartphone },
  { name: 'Wrench', label: 'Manutenção', component: Wrench },
  { name: 'PawPrint', label: 'Pet', component: PawPrint },
  { name: 'Baby', label: 'Família / Bebê', component: Baby },
  { name: 'Gift', label: 'Presentes', component: Gift },
  { name: 'Sparkles', label: 'Beleza / Cuidados', component: Sparkles },
  { name: 'Shield', label: 'Seguros', component: Shield },
  { name: 'ArrowLeftRight', label: 'Transferência', component: ArrowLeftRight },
  { name: 'MoreHorizontal', label: 'Outros', component: MoreHorizontal },
  { name: 'Circle', label: 'Padrão', component: Circle },
];

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = Object.fromEntries(
  CATEGORY_ICON_OPTIONS.map((opt) => [opt.name, opt.component])
);

export function getCategoryIconComponent(
  iconName?: string | null
): ComponentType<{ className?: string }> {
  if (!iconName) return Circle;
  return ICON_MAP[iconName] || Circle;
}

/**
 * Shared enums for the frontend
 * These enums should match the backend enums
 */

export enum HouseholdRole {
  OWNER = 'OWNER',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export enum AccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
  CREDIT = 'CREDIT',
  CASH = 'CASH',
  INVESTMENT = 'INVESTMENT',
}

export enum CategoryType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
  ALLOCATION = 'ALLOCATION',
}

/** Value used in APIs for custom categories: "CUSTOM:{uuid}" */
export const CUSTOM_CATEGORY_PREFIX = 'CUSTOM:';

export function isCustomCategoryName(value: string): boolean {
  return typeof value === 'string' && value.startsWith(CUSTOM_CATEGORY_PREFIX);
}

export enum CategoryName {
  // Income categories
  SALARY = 'SALARY',
  FREELANCE = 'FREELANCE',
  INVESTMENTS = 'INVESTMENTS',
  SALES = 'SALES',
  RENTAL_INCOME = 'RENTAL_INCOME',
  OTHER_INCOME = 'OTHER_INCOME',
  
  // Expense categories
  FOOD = 'FOOD',
  TRANSPORTATION = 'TRANSPORTATION',
  HOUSING = 'HOUSING',
  HEALTHCARE = 'HEALTHCARE',
  EDUCATION = 'EDUCATION',
  ENTERTAINMENT = 'ENTERTAINMENT',
  CLOTHING = 'CLOTHING',
  UTILITIES = 'UTILITIES',
  SUBSCRIPTIONS = 'SUBSCRIPTIONS',
  ONLINE_SHOPPING = 'ONLINE_SHOPPING',
  GROCERIES = 'GROCERIES',
  RESTAURANT = 'RESTAURANT',
  FUEL = 'FUEL',
  PHARMACY = 'PHARMACY',
  OTHER_EXPENSES = 'OTHER_EXPENSES',
  
  // Internal movement categories
  TRANSFER = 'TRANSFER',
  ALLOCATION = 'ALLOCATION',
  CREDIT_CARD_INVOICE = 'CUSTOM:e61a55a5-d8c4-4f6a-9a9b-272d740d125c',
  DEBTS = "CUSTOM:23aabe0f-3545-432b-b8dc-5fb73fcd119c"
}

export enum RecurrenceFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

/**
 * Mapping from CategoryName enum to translation key
 * This maps the enum value to the i18n translation key
 */
export const CATEGORY_NAME_TO_TRANSLATION_KEY: Record<CategoryName, string> = {
  [CategoryName.SALARY]: 'categorySALARY',
  [CategoryName.FREELANCE]: 'categoryFREELANCE',
  [CategoryName.INVESTMENTS]: 'categoryINVESTMENTS',
  [CategoryName.SALES]: 'categorySALES',
  [CategoryName.RENTAL_INCOME]: 'categoryRENTAL_INCOME',
  [CategoryName.OTHER_INCOME]: 'categoryOTHER_INCOME',
  [CategoryName.FOOD]: 'categoryFOOD',
  [CategoryName.TRANSPORTATION]: 'categoryTRANSPORTATION',
  [CategoryName.HOUSING]: 'categoryHOUSING',
  [CategoryName.HEALTHCARE]: 'categoryHEALTHCARE',
  [CategoryName.EDUCATION]: 'categoryEDUCATION',
  [CategoryName.ENTERTAINMENT]: 'categoryENTERTAINMENT',
  [CategoryName.CLOTHING]: 'categoryCLOTHING',
  [CategoryName.UTILITIES]: 'categoryUTILITIES',
  [CategoryName.SUBSCRIPTIONS]: 'categorySUBSCRIPTIONS',
  [CategoryName.ONLINE_SHOPPING]: 'categoryONLINE_SHOPPING',
  [CategoryName.GROCERIES]: 'categoryGROCERIES',
  [CategoryName.RESTAURANT]: 'categoryRESTAURANT',
  [CategoryName.FUEL]: 'categoryFUEL',
  [CategoryName.PHARMACY]: 'categoryPHARMACY',
  [CategoryName.OTHER_EXPENSES]: 'categoryOTHER_EXPENSES',
  [CategoryName.TRANSFER]: 'categoryTRANSFER',
  [CategoryName.ALLOCATION]: 'categoryALLOCATION',
  [CategoryName.CREDIT_CARD_INVOICE]: 'categoryCREDIT_CARD_INVOICE',
};

/**
 * Fallback display names (used when translations are not available)
 * @deprecated Use getCategoryDisplayName with translations object instead
 */
export const CATEGORY_NAME_DISPLAY: Record<CategoryName, string> = {
  [CategoryName.SALARY]: 'Salário',
  [CategoryName.FREELANCE]: 'Freelance',
  [CategoryName.INVESTMENTS]: 'Investimentos',
  [CategoryName.SALES]: 'Vendas',
  [CategoryName.RENTAL_INCOME]: 'Aluguel',
  [CategoryName.OTHER_INCOME]: 'Outras Receitas',
  [CategoryName.FOOD]: 'Alimentação',
  [CategoryName.TRANSPORTATION]: 'Transporte',
  [CategoryName.HOUSING]: 'Moradia',
  [CategoryName.HEALTHCARE]: 'Saúde',
  [CategoryName.EDUCATION]: 'Educação',
  [CategoryName.ENTERTAINMENT]: 'Lazer',
  [CategoryName.CLOTHING]: 'Roupas',
  [CategoryName.UTILITIES]: 'Contas',
  [CategoryName.SUBSCRIPTIONS]: 'Assinaturas',
  [CategoryName.ONLINE_SHOPPING]: 'Compras Online',
  [CategoryName.GROCERIES]: 'Supermercado',
  [CategoryName.RESTAURANT]: 'Restaurante',
  [CategoryName.FUEL]: 'Combustível',
  [CategoryName.PHARMACY]: 'Farmácia',
  [CategoryName.OTHER_EXPENSES]: 'Outras Despesas',
  [CategoryName.TRANSFER]: 'Transferência',
  [CategoryName.ALLOCATION]: 'Alocação',
  [CategoryName.CREDIT_CARD_INVOICE]: 'Fatura Cartão',
};

/**
 * Get all category names by type
 */
export function getCategoriesByType(type: CategoryType): CategoryName[] {
  if (type === CategoryType.INCOME) {
    return [
      CategoryName.SALARY,
      CategoryName.FREELANCE,
      CategoryName.INVESTMENTS,
      CategoryName.SALES,
      CategoryName.RENTAL_INCOME,
      CategoryName.OTHER_INCOME,
    ];
  }
  return [
    CategoryName.FOOD,
    CategoryName.TRANSPORTATION,
    CategoryName.HOUSING,
    CategoryName.HEALTHCARE,
    CategoryName.EDUCATION,
    CategoryName.ENTERTAINMENT,
    CategoryName.CLOTHING,
    CategoryName.UTILITIES,
    CategoryName.SUBSCRIPTIONS,
    CategoryName.ONLINE_SHOPPING,
    CategoryName.GROCERIES,
    CategoryName.RESTAURANT,
    CategoryName.FUEL,
    CategoryName.PHARMACY,
    CategoryName.OTHER_EXPENSES,
  ];
}

/**
 * Get all category names (for base categories list)
 * Includes TRANSFER and ALLOCATION for internal movements
 */
export function getAllCategoryNames(): CategoryName[] {
  return [
    ...getCategoriesByType(CategoryType.INCOME),
    ...getCategoriesByType(CategoryType.EXPENSE),
    CategoryName.TRANSFER,
    CategoryName.ALLOCATION,
  ];
}

/** Custom category item for display/color/icon resolution. type required when filtering by category type. */
export interface CustomCategoryInfo {
  id: string;
  name: string;
  type?: CategoryType;
  color?: string | null;
  icon?: string | null;
}

/**
 * Convert category value (enum or CUSTOM:uuid) to display name.
 * @param categoryName - Enum value or "CUSTOM:uuid"
 * @param translations - Optional i18n. Used for system categories.
 * @param customCategories - Optional list of custom categories for CUSTOM: resolution.
 */
export function getCategoryDisplayName(
  categoryName: string,
  translations?: Record<string, string>,
  customCategories?: CustomCategoryInfo[]
): string {
  if (isCustomCategoryName(categoryName) && customCategories?.length) {
    const id = categoryName.slice(CUSTOM_CATEGORY_PREFIX.length);
    const c = customCategories.find((x) => x.id === id);
    if (c) return c.name;
    return categoryName;
  }
  const key = CATEGORY_NAME_TO_TRANSLATION_KEY[categoryName as CategoryName];
  if (translations && key) {
    const translated = (translations as any)[key] || translations[key];
    if (translated) return translated;
  }
  return CATEGORY_NAME_DISPLAY[categoryName as CategoryName] || categoryName;
}

/**
 * Convert display name to category value (enum or CUSTOM:uuid).
 * @param customCategories - If provided, search by .name for custom; return "CUSTOM:id".
 */
export function getCategoryNameFromDisplay(
  displayName: string,
  translations?: Record<string, string>,
  customCategories?: CustomCategoryInfo[]
): string | undefined {
  if (customCategories?.length) {
    const c = customCategories.find((x) => x.name === displayName);
    if (c) return `${CUSTOM_CATEGORY_PREFIX}${c.id}`;
  }
  if (translations) {
    for (const [categoryName, translationKey] of Object.entries(CATEGORY_NAME_TO_TRANSLATION_KEY)) {
      if (translations[translationKey] === displayName) return categoryName;
    }
  }
  const entry = Object.entries(CATEGORY_NAME_DISPLAY).find(([, display]) => display === displayName);
  return entry ? entry[0] : undefined;
}

/**
 * Normalize form/legacy value to categoryName (enum or CUSTOM:uuid).
 * Accepts: already categoryName, or display name (resolved via getCategoryNameFromDisplay).
 */
export function toCategoryName(
  value: string | undefined,
  translations?: Record<string, string>,
  customCategories?: CustomCategoryInfo[]
): string | undefined {
  if (!value) return undefined;
  if (isCustomCategoryName(value)) return value;
  if (parseCategoryName(value)) return value;
  return getCategoryNameFromDisplay(value, translations, customCategories);
}

/**
 * Convert CategoryName enum value (string) to CategoryName enum
 */
export function parseCategoryName(value: string): CategoryName | undefined {
  return Object.values(CategoryName).find(name => name === value);
}

/**
 * Mapping from CategoryName enum to Lucide React icon names
 * These are the icon component names from lucide-react
 */
export const CATEGORY_NAME_ICONS: Record<CategoryName, string> = {
  // Income categories
  [CategoryName.SALARY]: 'Wallet',
  [CategoryName.FREELANCE]: 'Briefcase',
  [CategoryName.INVESTMENTS]: 'TrendingUp',
  [CategoryName.SALES]: 'ShoppingBag',
  [CategoryName.RENTAL_INCOME]: 'Home',
  [CategoryName.OTHER_INCOME]: 'DollarSign',
  
  // Expense categories
  [CategoryName.FOOD]: 'UtensilsCrossed',
  [CategoryName.TRANSPORTATION]: 'Car',
  [CategoryName.HOUSING]: 'House',
  [CategoryName.HEALTHCARE]: 'Heart',
  [CategoryName.EDUCATION]: 'GraduationCap',
  [CategoryName.ENTERTAINMENT]: 'Film',
  [CategoryName.CLOTHING]: 'Shirt',
  [CategoryName.UTILITIES]: 'Zap',
  [CategoryName.SUBSCRIPTIONS]: 'CreditCard',
  [CategoryName.ONLINE_SHOPPING]: 'ShoppingCart',
  [CategoryName.GROCERIES]: 'ShoppingBasket',
  [CategoryName.RESTAURANT]: 'Utensils',
  [CategoryName.FUEL]: 'Droplet',
  [CategoryName.PHARMACY]: 'Pill',
  [CategoryName.OTHER_EXPENSES]: 'MoreHorizontal',
  
  // Internal movement categories
  [CategoryName.TRANSFER]: 'ArrowLeftRight',
  [CategoryName.ALLOCATION]: 'CreditCard',
};

/**
 * Get icon name for a category (enum or CUSTOM:uuid).
 * @param customCategories - If provided and value is CUSTOM:, use .icon or 'Circle'.
 */
export function getCategoryIconName(
  categoryName: string,
  customCategories?: CustomCategoryInfo[]
): string {
  if (isCustomCategoryName(categoryName) && customCategories?.length) {
    const id = categoryName.slice(CUSTOM_CATEGORY_PREFIX.length);
    const c = customCategories.find((x) => x.id === id);
    return (c?.icon as string) || 'Circle';
  }
  return CATEGORY_NAME_ICONS[categoryName as CategoryName] || 'Circle';
}

/** Colors for system categories (same logic as backend for consistency) */
const CATEGORY_NAME_COLORS: Record<string, string> = {
  [CategoryName.SALARY]: '#22C55E',
  [CategoryName.FREELANCE]: '#10B981',
  [CategoryName.INVESTMENTS]: '#14B8A6',
  [CategoryName.SALES]: '#06B6D4',
  [CategoryName.RENTAL_INCOME]: '#3B82F6',
  [CategoryName.OTHER_INCOME]: '#6366F1',
  [CategoryName.FOOD]: '#F59E0B',
  [CategoryName.TRANSPORTATION]: '#F97316',
  [CategoryName.HOUSING]: '#EF4444',
  [CategoryName.HEALTHCARE]: '#84CC16',
  [CategoryName.EDUCATION]: '#6366F1',
  [CategoryName.ENTERTAINMENT]: '#8B5CF6',
  [CategoryName.CLOTHING]: '#F43F5E',
  [CategoryName.UTILITIES]: '#EAB308',
  [CategoryName.SUBSCRIPTIONS]: '#A855F7',
  [CategoryName.ONLINE_SHOPPING]: '#EC4899',
  [CategoryName.GROCERIES]: '#F59E0B',
  [CategoryName.RESTAURANT]: '#F97316',
  [CategoryName.FUEL]: '#F59E0B',
  [CategoryName.PHARMACY]: '#84CC16',
  [CategoryName.OTHER_EXPENSES]: '#64748B',
  [CategoryName.TRANSFER]: '#6366F1',
  [CategoryName.ALLOCATION]: '#8B5CF6',
};

/**
 * Get color for a category (enum or CUSTOM:uuid).
 * @param customCategories - If provided and value is CUSTOM:, use .color or '#64748B'.
 */
export function getCategoryColor(
  categoryName: string,
  customCategories?: CustomCategoryInfo[]
): string {
  if (isCustomCategoryName(categoryName) && customCategories?.length) {
    const id = categoryName.slice(CUSTOM_CATEGORY_PREFIX.length);
    const c = customCategories.find((x) => x.id === id);
    return c?.color ?? '#64748B';
  }
  return CATEGORY_NAME_COLORS[categoryName] ?? '#64748B';
}


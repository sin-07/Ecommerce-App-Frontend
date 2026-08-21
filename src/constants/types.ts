export type Role = 'buyer' | 'seller' | 'admin';

export interface SavedAddress {
  _id?: string;
  id?: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  landmark?: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  companyName?: string;
  isVerified?: boolean;
  addresses?: SavedAddress[];
}

export interface PricingTier {
  minQty: number;
  maxQty?: number | null;
  price: number;
  discountPercentage?: number;
}

export interface ProductSpecification {
  key: string;
  value: string;
}

export interface PriceHistoryEntry {
  price: number;
  date: string;
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  discount?: number;
  stock: number;
  minOrderQuantity: number;
  sku?: string;
  unit?: string;
  packSize?: string;
  badge?: string;
  isBestSeller?: boolean;
  tags?: string[];
  isActive?: boolean;
  availabilityStatus?: 'active' | 'out_of_stock' | 'unavailable';
  isFeatured?: boolean;
  images?: string[];
  pricingTiers?: PricingTier[];
  specifications?: ProductSpecification[];
  priceHistory?: PriceHistoryEntry[];
  imageUrl?: string;
  seller?: {
    _id: string;
    name: string;
    companyName?: string;
  };
}

export interface BuyAgainProduct extends Product {
  previousQuantity: number;
  lastOrderedAt: string;
}

export interface CustomerStats {
  totalOrders: number;
  inTransitOrders: number;
  completedOrders: number;
  totalSpend: number;
  totalPaid: number;
  totalDue: number;
}

export interface AppNotification {
  _id: string;
  title: string;
  message: string;
  type: 'order' | 'payment' | 'delivery' | 'stock' | 'reorder' | 'system';
  metadata?: {
    orderId?: string;
    productId?: string;
    status?: string;
  };
  isRead: boolean;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItem {
  _id?: string;
  product: string | Product;
  seller?: string;
  name: string;
  imageUrl?: string;
  category?: string;
  unit?: string;
  packSize?: string;
  quantity: number;
  unitPrice: number;
  subtotal?: number;
  lineTotal: number;
  status?: 'active' | 'cancelled';
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
}

export interface DeliveryAddressDetails {
  contactName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  notes?: string;
  // Aliases for backward compatibility
  fullName?: string;
  street?: string;
  postalCode?: string;
}

export interface Order {
  _id: string;
  buyer: string | { _id: string; name: string; email: string; phone?: string; companyName?: string };
  customerName: string;
  phoneNumber: string;
  items: OrderItem[];
  subtotal?: number;
  deliveryFee?: number;
  discount?: number;
  totalAmount: number;
  amountPaid?: number;
  amountDue?: number;
  paymentStatus?: 'DUE' | 'PARTIALLY_PAID' | 'PAID' | string;
  status:
    | 'pending'
    | 'processing'
    | 'confirmed'
    | 'packed'
    | 'shipped'
    | 'dispatched'
    | 'delivered'
    | 'cancelled'
    | string;
  shippingAddress: string;
  deliveryAddress?: DeliveryAddressDetails;
  deliveryAddressDetails?: DeliveryAddressDetails;
  notes?: string;
  estimatedDeliveryDate?: string | null;
  estimatedDeliverySlot?: string;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  idempotencyKey?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ChatMessage {
  _id?: string;
  sender: User | string;
  text: string;
  createdAt?: string;
}

export interface ChatConversation {
  _id: string;
  order: string;
  buyer: User;
  seller: User;
  messages: ChatMessage[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PersonalizedRecommendationsResponse {
  title: string;
  reasonCategory: string;
  products: Product[];
}

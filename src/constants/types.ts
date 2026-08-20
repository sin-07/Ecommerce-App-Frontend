export type Role = 'buyer' | 'seller' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  companyName?: string;
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
  isFeatured?: boolean;
  pricingTiers?: Array<{
    minQty: number;
    unitPrice: number;
  }>;
  imageUrl?: string;
  seller?: {
    _id: string;
    name: string;
    companyName?: string;
  };
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItem {
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
}

export interface DeliveryAddressDetails {
  fullName?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
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
  status: 'pending' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: string;
  deliveryAddressDetails?: DeliveryAddressDetails;
  notes?: string;
  createdAt: string;
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

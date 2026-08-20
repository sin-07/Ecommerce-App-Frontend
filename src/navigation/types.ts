import { Product } from '../constants/types';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  Home: { initialCategory?: string } | undefined;
  Wishlist: undefined;
  ProductDetails: { productId: string; product?: Product };
  Cart: undefined;
  Orders: undefined;
  AddProduct: { product?: Product } | undefined;
  AdminProducts: undefined;
  Chat: { orderId: string };
  SellerDashboard:
    | {
        editProduct?: Product;
        openSection?: 'inventory' | 'marketplace';
      }
    | undefined;
  AdminDashboard: undefined;
};

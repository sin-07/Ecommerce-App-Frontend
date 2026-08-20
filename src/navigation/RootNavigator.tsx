import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { colors } from '../constants/theme';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { restoreSession } from '../redux/slices/authSlice';
import { AdminDashboardScreen } from '../screens/AdminDashboardScreen';
import { AdminProductsScreen } from '../screens/AdminProductsScreen';
import { AddProductScreen } from '../screens/AddProductScreen';
import { CartScreen } from '../screens/CartScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { ProductDetailsScreen } from '../screens/ProductDetailsScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { SellerDashboardScreen } from '../screens/SellerDashboardScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { WishlistScreen } from '../screens/WishlistScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user, restoring } = useAppSelector((state) => state.auth);

  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  const screenOptions = {
    headerStyle: { backgroundColor: colors.card },
    headerTintColor: colors.text,
    headerTitleStyle: { fontWeight: '800' as const },
    headerShadowVisible: false,
    animation: 'slide_from_right' as const,
    contentStyle: { backgroundColor: colors.bg }
  } as const;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {restoring ? <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} /> : null}

        {!restoring && !user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create Wholesale Account' }} />
          </>
        ) : null}

        {!restoring && user?.role === 'buyer' ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Wishlist" component={WishlistScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} options={{ title: 'Product Details' }} />
            <Stack.Screen name="Cart" component={CartScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
            <Stack.Screen name="Orders" component={OrdersScreen} options={{ headerShown: false }} />
          </>
        ) : null}

        {!restoring && user?.role === 'seller' ? (
          <>
            <Stack.Screen name="SellerDashboard" component={SellerDashboardScreen} options={{ title: 'Seller Dashboard' }} />
            <Stack.Screen name="AddProduct" component={AddProductScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Wishlist" component={WishlistScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} options={{ title: 'Product Details' }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
            <Stack.Screen name="Orders" component={OrdersScreen} options={{ headerShown: false }} />
          </>
        ) : null}

        {!restoring && user?.role === 'admin' ? (
          <>
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AdminProducts" component={AdminProductsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AddProduct" component={AddProductScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SellerDashboard" component={SellerDashboardScreen} options={{ title: 'Edit Product' }} />
            <Stack.Screen name="Wishlist" component={WishlistScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
            <Stack.Screen name="Orders" component={OrdersScreen} options={{ headerShown: false }} />
          </>
        ) : null}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

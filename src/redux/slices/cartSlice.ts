import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../constants/api';
import { CartItem } from '../../constants/types';

type CartState = {
  items: CartItem[];
  loading: boolean;
  pendingItems: Record<string, boolean>; // productId -> boolean
  error: string | null;
};

const initialState: CartState = {
  items: [],
  loading: false,
  pendingItems: {},
  error: null
};

const mapCart = (payload: any): CartItem[] => payload.items || [];
const CART_STORAGE_KEY = '@b2b-cart-v1';

const persistCart = async (items: CartItem[]) => {
  try {
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors so cart API flow remains usable.
  }
};

export const hydrateCart = createAsyncThunk('cart/hydrate', async () => {
  try {
    const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [] as CartItem[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : ([] as CartItem[]);
  } catch {
    return [] as CartItem[];
  }
});

export const fetchCart = createAsyncThunk('cart/fetch', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/cart');
    const items = mapCart(res.data.data);
    await persistCart(items);
    return items;
  } catch (error: any) {
    return rejectWithValue(error?.response?.data?.message || 'Failed to fetch cart');
  }
});

export const addCartItem = createAsyncThunk(
  'cart/addItem',
  async (payload: { productId: string; quantity: number }, { rejectWithValue }) => {
    try {
      const res = await api.post('/cart/items', payload);
      const items = mapCart(res.data.data);
      await persistCart(items);
      return items;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to add item');
    }
  }
);

export const updateCartItem = createAsyncThunk(
  'cart/updateItem',
  async (payload: { productId: string; quantity: number }, { rejectWithValue }) => {
    try {
      const res = await api.put('/cart/items', payload);
      const items = mapCart(res.data.data);
      await persistCart(items);
      return items;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to update item');
    }
  }
);

export const removeCartItem = createAsyncThunk('cart/removeItem', async (productId: string, { rejectWithValue }) => {
  try {
    const res = await api.delete(`/cart/items/${productId}`);
    const items = mapCart(res.data.data);
    await persistCart(items);
    return items;
  } catch (error: any) {
    return rejectWithValue(error?.response?.data?.message || 'Failed to remove item');
  }
});

export const clearCart = createAsyncThunk('cart/clear', async (_, { rejectWithValue }) => {
  try {
    await api.delete('/cart');
    const items = [] as CartItem[];
    await persistCart(items);
    return items;
  } catch (error: any) {
    return rejectWithValue(error?.response?.data?.message || 'Failed to clear cart');
  }
});

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCart.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(hydrateCart.fulfilled, (state, action) => {
        if (!state.items.length && action.payload.length) {
          state.items = action.payload;
        }
      })
      // ADD ITEM PENDING / FULFILLED / REJECTED
      .addCase(addCartItem.pending, (state, action) => {
        state.pendingItems[action.meta.arg.productId] = true;
      })
      .addCase(addCartItem.fulfilled, (state, action) => {
        delete state.pendingItems[action.meta.arg.productId];
        state.items = action.payload;
      })
      .addCase(addCartItem.rejected, (state, action) => {
        delete state.pendingItems[action.meta.arg.productId];
      })
      // UPDATE ITEM PENDING / FULFILLED / REJECTED
      .addCase(updateCartItem.pending, (state, action) => {
        state.pendingItems[action.meta.arg.productId] = true;
      })
      .addCase(updateCartItem.fulfilled, (state, action) => {
        delete state.pendingItems[action.meta.arg.productId];
        state.items = action.payload;
      })
      .addCase(updateCartItem.rejected, (state, action) => {
        delete state.pendingItems[action.meta.arg.productId];
      })
      // REMOVE ITEM PENDING / FULFILLED / REJECTED
      .addCase(removeCartItem.pending, (state, action) => {
        state.pendingItems[action.meta.arg] = true;
      })
      .addCase(removeCartItem.fulfilled, (state, action) => {
        delete state.pendingItems[action.meta.arg];
        state.items = action.payload;
      })
      .addCase(removeCartItem.rejected, (state, action) => {
        delete state.pendingItems[action.meta.arg];
      })
      // CLEAR CART
      .addCase(clearCart.fulfilled, (state, action) => {
        state.items = action.payload;
        state.pendingItems = {};
      });
  }
});

export default cartSlice.reducer;

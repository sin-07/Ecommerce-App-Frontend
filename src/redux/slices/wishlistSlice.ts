import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Product } from '../../constants/types';

const STORAGE_KEY = '@ap_wishlist_items';

interface WishlistState {
  items: Product[];
  loaded: boolean;
}

const initialState: WishlistState = {
  items: [],
  loaded: false
};

export const loadWishlist = createAsyncThunk('wishlist/loadWishlist', async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Product[];
  } catch {
    return [];
  }
});

export const toggleWishlist = createAsyncThunk(
  'wishlist/toggleWishlist',
  async (product: Product, { getState }) => {
    const state = (getState() as { wishlist: WishlistState }).wishlist;
    const exists = state.items.some((item) => item._id === product._id);
    let updated: Product[];

    if (exists) {
      updated = state.items.filter((item) => item._id !== product._id);
    } else {
      updated = [product, ...state.items];
    }

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    return { product, wasAdded: !exists, updated };
  }
);

export const clearWishlist = createAsyncThunk('wishlist/clearWishlist', async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return [];
});

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    setWishlist(state, action: PayloadAction<Product[]>) {
      state.items = action.payload;
      state.loaded = true;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadWishlist.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loaded = true;
      })
      .addCase(toggleWishlist.fulfilled, (state, action) => {
        state.items = action.payload.updated;
      })
      .addCase(clearWishlist.fulfilled, (state) => {
        state.items = [];
      });
  }
});

export const { setWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;

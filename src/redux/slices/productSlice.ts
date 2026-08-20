import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../constants/api';
import { Product } from '../../constants/types';

export interface CategoryInfo {
  name: string;
  count: number;
}

type ProductState = {
  items: Product[];
  selected: Product | null;
  sellerItems: Product[];
  categories: CategoryInfo[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  page: number;
  totalPages: number;
};

const initialState: ProductState = {
  items: [],
  selected: null,
  sellerItems: [],
  categories: [],
  loading: false,
  loadingMore: false,
  error: null,
  page: 1,
  totalPages: 1
};

export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async (
    params: {
      page?: number;
      limit?: number;
      search?: string;
      category?: string;
      isFeatured?: boolean;
      isBestSeller?: boolean;
      sortBy?: string;
    } = {},
    { rejectWithValue }
  ) => {
    try {
      const res = await api.get('/products', { params });
      return res.data;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to fetch products');
    }
  }
);

export const fetchCategories = createAsyncThunk(
  'products/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/products/categories');
      return res.data.data as CategoryInfo[];
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to fetch categories');
    }
  }
);

export const fetchProductById = createAsyncThunk(
  'products/fetchById',
  async (id: string, { rejectWithValue }) => {
    try {
      const res = await api.get(`/products/${id}`);
      return res.data.data as Product;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to fetch product');
    }
  }
);

export const fetchSellerProducts = createAsyncThunk(
  'products/fetchSeller',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/products/seller/me');
      return res.data.data as Product[];
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to fetch seller products');
    }
  }
);

const productSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    clearProducts: (state) => {
      state.items = [];
      state.page = 1;
      state.totalPages = 1;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state, action) => {
        const requestedPage = Number(action.meta.arg?.page || 1);
        state.loading = requestedPage <= 1;
        state.loadingMore = requestedPage > 1;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        const requestedPage = Number(action.meta.arg?.page || action.payload.pagination.page || 1);
        if (requestedPage > 1) {
          const existingIds = new Set(state.items.map((p) => p._id));
          const newItems = (action.payload.data as Product[]).filter((p) => !existingIds.has(p._id));
          state.items = [...state.items, ...newItems];
        } else {
          state.items = action.payload.data;
        }
        state.page = action.payload.pagination.page;
        state.totalPages = action.payload.pagination.totalPages;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        state.error = action.payload as string;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories = action.payload;
      })
      .addCase(fetchProductById.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchProductById.fulfilled, (state, action) => {
        state.loading = false;
        state.selected = action.payload;
      })
      .addCase(fetchProductById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchSellerProducts.fulfilled, (state, action) => {
        state.sellerItems = action.payload;
      });
  }
});

export const { clearProducts } = productSlice.actions;
export default productSlice.reducer;

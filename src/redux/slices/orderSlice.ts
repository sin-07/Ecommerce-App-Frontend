import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../constants/api';
import { Order } from '../../constants/types';

type OrderState = {
  items: Order[];
  loading: boolean;
  error: string | null;
};

const initialState: OrderState = {
  items: [],
  loading: false,
  error: null
};

export const placeOrder = createAsyncThunk(
  'orders/place',
  async (payload: { customerName: string; phoneNumber: string; shippingAddress: string; notes?: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/orders', payload);
      return res.data.data as Order;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to place order');
    }
  }
);

export const fetchBuyerOrders = createAsyncThunk('orders/fetchBuyer', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/orders/buyer');
    return res.data.data as Order[];
  } catch (error: any) {
    return rejectWithValue(error?.response?.data?.message || 'Failed to fetch orders');
  }
});

export const fetchSellerOrders = createAsyncThunk('orders/fetchSeller', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/orders/seller');
    return res.data.data as Order[];
  } catch (error: any) {
    return rejectWithValue(error?.response?.data?.message || 'Failed to fetch seller orders');
  }
});

export const fetchAdminOrders = createAsyncThunk('orders/fetchAdmin', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/orders/admin');
    return res.data.data as Order[];
  } catch (error: any) {
    return rejectWithValue(error?.response?.data?.message || 'Failed to fetch admin orders');
  }
});

export const updateOrderStatus = createAsyncThunk(
  'orders/updateStatus',
  async (payload: { id: string; status: string }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/orders/${payload.id}/status`, { status: payload.status });
      return res.data.data as Order;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to update order');
    }
  }
);

const orderSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(placeOrder.pending, (state) => {
        state.loading = true;
      })
      .addCase(placeOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.items = [action.payload, ...state.items];
      })
      .addCase(placeOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchBuyerOrders.fulfilled, (state, action) => {
        state.items = action.payload;
      })
      .addCase(fetchSellerOrders.fulfilled, (state, action) => {
        state.items = action.payload;
      })
      .addCase(fetchAdminOrders.fulfilled, (state, action) => {
        state.items = action.payload;
      })
      .addCase(updateOrderStatus.pending, (state, action) => {
        const { id, status } = action.meta.arg;
        const order = state.items.find((item) => item._id === id);
        if (order) {
          order.status = status as Order['status'];
        }
      })
      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item._id === action.payload._id);
        if (index >= 0) {
          state.items[index] = action.payload;
        }
      });
  }
});

export default orderSlice.reducer;

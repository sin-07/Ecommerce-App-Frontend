import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../constants/api';
import { DeliveryAddressDetails, Order } from '../../constants/types';

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

export interface PlaceOrderPayload {
  customerName?: string;
  phoneNumber?: string;
  shippingAddress?: string;
  deliveryAddress?: DeliveryAddressDetails;
  deliveryAddressDetails?: DeliveryAddressDetails;
  notes?: string;
  amountPaid?: number;
}

const normalizeOrders = (res: any): Order[] => {
  if (!res) return [];
  const payload = res?.data?.data ?? res?.data?.orders ?? res?.data ?? res;
  if (Array.isArray(payload)) return payload as Order[];
  if (payload && Array.isArray(payload.data)) return payload.data as Order[];
  if (payload && Array.isArray(payload.orders)) return payload.orders as Order[];
  return [];
};

export const placeOrder = createAsyncThunk(
  'orders/place',
  async (payload: PlaceOrderPayload, { rejectWithValue }) => {
    try {
      const res = await api.post('/orders', payload);
      return (res.data?.data || res.data) as Order;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to place order');
    }
  }
);

export const fetchBuyerOrders = createAsyncThunk('orders/fetchBuyer', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/orders/buyer');
    return normalizeOrders(res);
  } catch (error: any) {
    return rejectWithValue(error?.response?.data?.message || 'Failed to fetch orders');
  }
});

export const fetchSellerOrders = createAsyncThunk('orders/fetchSeller', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/orders/seller');
    return normalizeOrders(res);
  } catch (error: any) {
    return rejectWithValue(error?.response?.data?.message || 'Failed to fetch seller orders');
  }
});

export const fetchAdminOrders = createAsyncThunk('orders/fetchAdmin', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/orders/admin');
    return normalizeOrders(res);
  } catch (error: any) {
    return rejectWithValue(error?.response?.data?.message || 'Failed to fetch admin orders');
  }
});

export const updateOrderStatus = createAsyncThunk(
  'orders/updateStatus',
  async (
    payload: { id: string; status: string; amountPaid?: number; paymentStatus?: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await api.patch(`/orders/${payload.id}/status`, {
        status: payload.status,
        amountPaid: payload.amountPaid,
        paymentStatus: payload.paymentStatus
      });
      return (res.data?.data || res.data) as Order;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to update order');
    }
  }
);

const orderSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    clearOrders: (state) => {
      state.items = [];
      state.loading = false;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // PLACE ORDER
      .addCase(placeOrder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(placeOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.items = [action.payload, ...state.items];
      })
      .addCase(placeOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // FETCH BUYER ORDERS
      .addCase(fetchBuyerOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBuyerOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        state.error = null;
      })
      .addCase(fetchBuyerOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // FETCH SELLER ORDERS
      .addCase(fetchSellerOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSellerOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        state.error = null;
      })
      .addCase(fetchSellerOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // FETCH ADMIN ORDERS
      .addCase(fetchAdminOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        state.error = null;
      })
      .addCase(fetchAdminOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // UPDATE ORDER STATUS
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

export const { clearOrders } = orderSlice.actions;
export default orderSlice.reducer;

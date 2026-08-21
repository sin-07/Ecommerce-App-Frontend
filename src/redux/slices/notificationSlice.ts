import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { api } from '../../constants/api';
import { AppNotification } from '../../constants/types';
import { logout } from './authSlice';

interface NotificationState {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

const initialState: NotificationState = {
  items: [],
  unreadCount: 0,
  loading: false,
  error: null
};

export const fetchUnreadCount = createAsyncThunk(
  'notifications/fetchUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/notifications/unread-count');
      return Number(res.data?.data?.unreadCount || 0);
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to fetch unread count');
    }
  }
);

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchAll',
  async (isRefresh: boolean | undefined, { rejectWithValue }) => {
    try {
      const res = await api.get('/notifications');
      const data = res.data?.data || {};
      return {
        notifications: (data.notifications || []) as AppNotification[],
        unreadCount: Number(data.unreadCount || 0)
      };
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to fetch notifications');
    }
  }
);

export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (id: string, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/notifications/${id}/read`);
      return {
        id,
        unreadCount: res.data?.data?.unreadCount,
        readAt: new Date().toISOString()
      };
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to mark notification as read');
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllRead',
  async (_, { rejectWithValue }) => {
    try {
      await api.patch('/notifications/read-all');
      return { nowIso: new Date().toISOString() };
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to mark all notifications as read');
    }
  }
);

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setUnreadCount: (state, action: PayloadAction<number>) => {
      state.unreadCount = Math.max(0, action.payload);
    },
    decrementUnreadCount: (state) => {
      state.unreadCount = Math.max(0, state.unreadCount - 1);
    },
    clearNotifications: (state) => {
      state.items = [];
      state.unreadCount = 0;
      state.loading = false;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchUnreadCount
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = Math.max(0, action.payload);
      })
      // fetchNotifications
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.notifications;
        state.unreadCount = Math.max(0, action.payload.unreadCount);
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // markNotificationRead
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const item = state.items.find((n) => n._id === action.payload.id);
        if (item && !item.isRead) {
          item.isRead = true;
          item.readAt = action.payload.readAt;
        }
        if (action.payload.unreadCount !== undefined) {
          state.unreadCount = Math.max(0, Number(action.payload.unreadCount));
        } else {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      // markAllNotificationsRead
      .addCase(markAllNotificationsRead.fulfilled, (state, action) => {
        state.unreadCount = 0;
        state.items = state.items.map((n) => ({
          ...n,
          isRead: true,
          readAt: n.readAt || action.payload.nowIso
        }));
      })
      // logout
      .addCase(logout.fulfilled, (state) => {
        state.items = [];
        state.unreadCount = 0;
        state.loading = false;
        state.error = null;
      });
  }
});

export const { setUnreadCount, decrementUnreadCount, clearNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;

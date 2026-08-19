import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api, API_BASE_URL } from '../../constants/api';
import { User } from '../../constants/types';

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  restoring: boolean;
  error: string | null;
};

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  restoring: true,
  error: null
};

const setTokenHeader = (token: string | null) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const restoreSession = createAsyncThunk('auth/restoreSession', async () => {
  const raw = await AsyncStorage.getItem('auth_session');
  if (!raw) return null;

  const session = JSON.parse(raw) as { token: string; user: User };
  setTokenHeader(session.token);
  try {
    const response = await api.get('/auth/me');
    const refreshed = { token: session.token, user: response.data.data as User };
    await AsyncStorage.setItem('auth_session', JSON.stringify(refreshed));
    return refreshed;
  } catch {
    await AsyncStorage.removeItem('auth_session');
    setTokenHeader(null);
    return null;
  }
});

export const login = createAsyncThunk(
  'auth/login',
  async (payload: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/login', { ...payload, email: payload.email.trim().toLowerCase() });
      const session = res.data.data as { token: string; user: User };
      setTokenHeader(session.token);
      await AsyncStorage.setItem('auth_session', JSON.stringify(session));
      return session;
    } catch (error: any) {
      if (!error?.response) {
        return rejectWithValue(`Cannot reach backend at ${API_BASE_URL}. Use your PC LAN IP in EXPO_PUBLIC_API_URL.`);
      }
      return rejectWithValue(error?.response?.data?.message || 'Invalid email or password. Please try again.');
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (
    payload: {
      name: string;
      email: string;
      password: string;
      role: 'buyer' | 'seller';
      companyName?: string;
      phone?: string;
      otp: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const res = await api.post('/auth/register', payload);
      const session = res.data.data as { token: string; user: User };
      setTokenHeader(session.token);
      await AsyncStorage.setItem('auth_session', JSON.stringify(session));
      return session;
    } catch (error: any) {
      if (!error?.response) {
        return rejectWithValue(`Cannot reach backend at ${API_BASE_URL}. Check the device network and EXPO_PUBLIC_API_URL.`);
      }
      const status = error.response.status;
      const message = error.response.data?.message;
      if (status === 409) return rejectWithValue('Email already registered. Please sign in instead.');
      if (status === 400 && message?.toLowerCase().includes('otp')) return rejectWithValue('The verification code is incorrect or expired.');
      return rejectWithValue(message || 'Unable to create your account. Please try again.');
    }
  }
);

export const verifyOtp = createAsyncThunk(
  'auth/verifyOtp',
  async (payload: { email: string; otp: string }, { rejectWithValue }) => {
    try {
      await api.post('/auth/verify-otp', payload);
      return true;
    } catch (error: any) {
      if (!error?.response) return rejectWithValue('Unable to connect to the server. Please try again.');
      return rejectWithValue(error.response.data?.message || 'The verification code is incorrect.');
    }
  }
);

export const registerPushToken = createAsyncThunk(
  'auth/registerPushToken',
  async (payload: { expoPushToken: string }, { rejectWithValue }) => {
    try {
      await api.post('/auth/push-token', payload);
      return payload.expoPushToken;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to register push token');
    }
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  await AsyncStorage.removeItem('auth_session');
  setTokenHeader(null);
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.restoring = false;
        state.user = action.payload?.user || null;
        state.token = action.payload?.token || null;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.restoring = false;
      })
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
      });
  }
});

export default authSlice.reducer;

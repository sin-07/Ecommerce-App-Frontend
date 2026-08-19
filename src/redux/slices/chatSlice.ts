import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../constants/api';
import { ChatConversation, ChatMessage } from '../../constants/types';

type ChatState = {
  conversation: ChatConversation | null;
  loading: boolean;
  sending: boolean;
  error: string | null;
};

const initialState: ChatState = {
  conversation: null,
  loading: false,
  sending: false,
  error: null
};

export const fetchConversation = createAsyncThunk('chat/fetchConversation', async (orderId: string, { rejectWithValue }) => {
  try {
    const res = await api.get(`/chats/order/${orderId}`);
    return res.data.data as ChatConversation;
  } catch (error: any) {
    return rejectWithValue(error?.response?.data?.message || 'Failed to fetch conversation');
  }
});

export const sendConversationMessage = createAsyncThunk(
  'chat/sendMessage',
  async (payload: { orderId: string; text: string }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/chats/order/${payload.orderId}/messages`, { text: payload.text });
      return res.data.data as ChatConversation;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to send message');
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addOptimisticMessage: (state, action: { payload: ChatMessage }) => {
      if (!state.conversation) return;
      state.conversation.messages = [...state.conversation.messages, action.payload];
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConversation.fulfilled, (state, action) => {
        state.loading = false;
        state.conversation = action.payload;
      })
      .addCase(fetchConversation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(sendConversationMessage.pending, (state) => {
        state.sending = true;
      })
      .addCase(sendConversationMessage.fulfilled, (state, action) => {
        state.sending = false;
        state.conversation = action.payload;
      })
      .addCase(sendConversationMessage.rejected, (state, action) => {
        state.sending = false;
        state.error = action.payload as string;
      });
  }
});

export const { addOptimisticMessage } = chatSlice.actions;
export default chatSlice.reducer;

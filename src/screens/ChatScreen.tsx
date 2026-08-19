import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { colors } from '../constants/theme';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { addOptimisticMessage, fetchConversation, sendConversationMessage } from '../redux/slices/chatSlice';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export const ChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { orderId } = route.params;
  const dispatch = useAppDispatch();
  const { conversation, loading, sending, error } = useAppSelector((state) => state.chat);
  const { user } = useAppSelector((state) => state.auth);
  const [text, setText] = useState('');

  useEffect(() => {
    dispatch(fetchConversation(orderId));
  }, [dispatch, orderId]);

  const messages = conversation?.messages || [];
  const me = user?.id;

  const title = useMemo(() => {
    const other = conversation
      ? conversation.buyer.id === me
        ? conversation.seller
        : conversation.buyer
      : null;
    return other?.companyName || other?.name || 'Chat';
  }, [conversation, me]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const optimisticId = `temp-${Date.now()}`;
    dispatch(
      addOptimisticMessage({
        _id: optimisticId,
        sender: user || '',
        text: trimmed,
        createdAt: new Date().toISOString()
      })
    );
    setText('');

    try {
      await dispatch(sendConversationMessage({ orderId, text: trimmed })).unwrap();
    } catch (sendError: any) {
      toast.show(sendError || 'Failed to send message', 'error');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenContainer scroll={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Basic buyer-seller conversation tied to the order.</Text>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item, index) => item._id || `${index}-${item.createdAt || item.text}`}
          contentContainerStyle={styles.messages}
          renderItem={({ item }) => {
            const senderId = typeof item.sender === 'string' ? item.sender : item.sender.id;
            const mine = senderId === me;
            return (
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            loading ? <Text style={styles.empty}>Loading conversation...</Text> : <Text style={styles.empty}>No messages yet.</Text>
          }
        />

        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Write a message"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
          />
          <AppButton title={sending ? 'Sending...' : 'Send'} icon="send" onPress={handleSend} loading={sending} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg
  },
  header: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    marginBottom: 12
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800'
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12
  },
  messages: {
    gap: 10,
    paddingBottom: 12
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary
  },
  bubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border
  },
  bubbleText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18
  },
  bubbleTextMine: {
    color: colors.white
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20
  },
  composer: {
    gap: 10,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    minHeight: 84,
    padding: 12,
    textAlignVertical: 'top'
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 6
  }
});

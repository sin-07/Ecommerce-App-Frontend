import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

export const SmartSuggestionBanner: React.FC<{ title: string; message: string }> = ({ title, message }) => {
  return (
    <View style={styles.card}>
      <View style={styles.iconBubble}>
        <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe8ff',
    backgroundColor: '#eef5ff',
    padding: 12,
    alignItems: 'flex-start'
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#dbe8ff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  content: {
    flex: 1,
    gap: 3
  },
  title: {
    color: '#1c3155',
    fontWeight: '800',
    fontSize: 13
  },
  message: {
    color: '#4f6486',
    fontSize: 12,
    lineHeight: 17
  }
});

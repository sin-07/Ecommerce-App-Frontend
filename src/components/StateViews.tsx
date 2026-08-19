import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppButton } from './AppButton';
import { colors } from '../constants/theme';

export const LoadingView: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => (
  <View style={styles.center}>
    <ActivityIndicator color={colors.primary} size="large" />
    <Text style={styles.label}>{label}</Text>
  </View>
);

export const ErrorView: React.FC<{ message?: string }> = ({ message = 'Something went wrong.' }) => (
  <View style={styles.center}>
    <Text style={[styles.label, styles.error]}>{message}</Text>
  </View>
);

export const EmptyState: React.FC<{
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon = 'package-variant-closed', title, description, actionLabel, onAction }) => (
  <View style={styles.emptyCard}>
    <View style={styles.emptyIcon}>
      <MaterialCommunityIcons name={icon} size={28} color={colors.primary} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyDescription}>{description}</Text>
    {actionLabel && onAction ? <AppButton title={actionLabel} icon="arrow-right" onPress={onAction} /> : null}
  </View>
);

const styles = StyleSheet.create({
  center: {
    paddingVertical: 24,
    alignItems: 'center'
  },
  label: {
    color: colors.textMuted,
    marginTop: 8,
    fontSize: 14
  },
  error: {
    color: colors.danger,
    textAlign: 'center'
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    marginTop: 8
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.infoSurface,
    marginBottom: 16
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center'
  },
  emptyDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 7,
    marginBottom: 18
  }
});

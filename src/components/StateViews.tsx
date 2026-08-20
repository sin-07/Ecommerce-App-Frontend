import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { AppButton } from './AppButton';
import { colors, radius } from '../constants/theme';

export const LoadingView: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => (
  <View style={styles.center}>
    <ActivityIndicator color={colors.primary} size="large" />
    <Text style={styles.label}>{label}</Text>
  </View>
);

export const ErrorView: React.FC<{ message?: string; onRetry?: () => void }> = ({
  message = 'Something went wrong.',
  onRetry
}) => (
  <View style={styles.center}>
    <MaterialCommunityIcons name="alert-circle-outline" size={36} color={colors.danger} />
    <Text style={[styles.label, styles.error]}>{message}</Text>
    {onRetry ? (
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
        <Ionicons name="refresh" size={16} color={colors.white} />
        <Text style={styles.retryBtnText}>Try Again</Text>
      </TouchableOpacity>
    ) : null}
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
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  label: {
    color: colors.textMuted,
    marginTop: 4,
    fontSize: 14,
    textAlign: 'center'
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
    fontWeight: '700'
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    marginTop: 6
  },
  retryBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800'
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

import React, { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';

type Props = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: ViewStyle;
  style?: ViewStyle;
  edges?: Edge[];
  hasCustomHeader?: boolean;
  padded?: boolean;
}>;

/**
 * Universal safe-area-aware screen layout wrapper for AP Enterprises.
 * - Automatically applies top safe-area inset on custom-header screens (hasCustomHeader=true).
 * - Avoids duplicate top insets on screens with React Navigation native stack headers (hasCustomHeader=false).
 * - Dynamically adapts to any Android notch, cutout, status bar, or gesture navigation bar.
 */
export const ScreenContainer: React.FC<Props> = ({
  children,
  scroll = true,
  contentStyle,
  style,
  edges,
  hasCustomHeader = false,
  padded = true
}) => {
  const insets = useSafeAreaInsets();

  const resolvedEdges: Edge[] = edges
    ? edges
    : hasCustomHeader
    ? ['top', 'left', 'right', 'bottom']
    : ['left', 'right', 'bottom'];

  if (!scroll) {
    return (
      <SafeAreaView style={[styles.safe, style]} edges={resolvedEdges}>
        <View
          style={[
            styles.wrapper,
            padded && styles.paddedContent,
            { paddingBottom: Math.max(16, insets.bottom + 8) },
            contentStyle
          ]}
        >
          {children}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, style]} edges={resolvedEdges}>
      <ScrollView
        style={styles.wrapper}
        contentContainerStyle={[
          padded && styles.paddedContent,
          { paddingBottom: Math.max(24, insets.bottom + 16) },
          contentStyle
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  wrapper: {
    flex: 1
  },
  paddedContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12
  }
});

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, shadows } from '../constants/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (__DEV__) {
      console.error('[ErrorBoundary caught error]:', error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="alert-circle-outline" size={42} color={colors.danger} />
            </View>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              An unexpected issue occurred while rendering this screen. Please tap below to reload.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={this.handleRetry} activeOpacity={0.88}>
              <MaterialCommunityIcons name="reload" size={18} color={colors.white} />
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: radius.xl,
    padding: 24,
    alignItems: 'center',
    maxWidth: 360,
    width: '100%',
    borderWidth: 1,
    borderColor: '#334155',
    ...shadows.modal
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#450A0A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#991B1B'
  },
  title: {
    fontSize: 19,
    fontWeight: '900',
    color: '#F8FAFC',
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: radius.md,
    width: '100%'
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  }
});

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { colors } from '../constants/theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (val: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
};

export const AppInput: React.FC<Props> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
  keyboardType = 'default'
}) => {
  return (
    <View style={styles.wrapper}>
      <TextInput
        mode="outlined"
        label={label}
        style={styles.input}
        outlineStyle={styles.outline}
        textColor={colors.text}
        placeholderTextColor={colors.textMuted}
        theme={{ colors: { primary: colors.primary, outline: colors.border, background: colors.card, onSurfaceVariant: colors.textSecondary } }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        keyboardType={keyboardType}
        contentStyle={multiline ? styles.multilineContent : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: 6
  },
  input: {
    backgroundColor: colors.card,
    minHeight: 52
  },
  outline: {
    borderRadius: 14
  },
  multilineContent: {
    minHeight: 90,
    textAlignVertical: 'top'
  }
});

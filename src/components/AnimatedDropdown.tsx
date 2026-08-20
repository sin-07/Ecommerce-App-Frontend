import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows } from '../constants/theme';

export type DropdownOption = {
  label: string;
  value: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  badge?: string;
};

type Props = {
  label?: string;
  required?: boolean;
  selectedValue: string;
  options: Array<string | DropdownOption>;
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  helperText?: string;
};

const getCategoryIcon = (
  val: string
): React.ComponentProps<typeof MaterialCommunityIcons>['name'] => {
  const lower = val.toLowerCase();
  if (lower.includes('egg')) return 'egg-outline';
  if (lower.includes('bev') || lower.includes('drink') || lower.includes('soda') || lower.includes('juice'))
    return 'bottle-soda-classic-outline';
  if (lower.includes('can')) return 'cup-water';
  if (lower.includes('tray') || lower.includes('crate')) return 'cube-outline';
  if (lower.includes('snack')) return 'food-apple-outline';
  return 'package-variant-closed';
};

export const AnimatedDropdown: React.FC<Props> = ({
  label,
  required = false,
  selectedValue,
  options,
  onSelect,
  placeholder = 'Select an option',
  disabled = false,
  error,
  helperText
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Animation values
  const animProgress = useRef(new Animated.Value(0)).current;
  const chevronAnim = useRef(new Animated.Value(0)).current;

  // Normalized options
  const normalizedOptions: DropdownOption[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return {
          label: opt,
          value: opt,
          icon: getCategoryIcon(opt)
        };
      }
      return {
        ...opt,
        icon: opt.icon || getCategoryIcon(opt.value || opt.label)
      };
    });
  }, [options]);

  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => opt.value === selectedValue || opt.label === selectedValue);
  }, [normalizedOptions, selectedValue]);

  // Open animation
  const openDropdown = () => {
    if (disabled) return;
    setIsOpen(true);
    Animated.parallel([
      Animated.timing(animProgress, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(chevronAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  };

  // Close animation
  const closeDropdown = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(animProgress, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(chevronAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      })
    ]).start(() => {
      setIsOpen(false);
      if (callback) callback();
    });
  };

  const handleSelect = (value: string) => {
    closeDropdown(() => {
      onSelect(value);
    });
  };

  // Handle Android Back Button
  useEffect(() => {
    if (!isOpen) return;
    const backAction = () => {
      closeDropdown();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isOpen]);

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg']
  });

  const modalOpacity = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });

  const modalScale = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1]
  });

  const modalTranslateY = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0]
  });

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={styles.label}>
          {label} {required ? <Text style={styles.required}>*</Text> : null}
        </Text>
      ) : null}

      {/* TRIGGER ANCHOR BUTTON */}
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={disabled}
        onPress={openDropdown}
        style={[
          styles.trigger,
          isOpen && styles.triggerActive,
          Boolean(error) && styles.triggerError,
          disabled && styles.triggerDisabled
        ]}
      >
        <View style={styles.triggerLeft}>
          {selectedOption ? (
            <View style={styles.selectedIconWrap}>
              <MaterialCommunityIcons
                name={selectedOption.icon || 'tag-outline'}
                size={18}
                color={colors.primary}
              />
            </View>
          ) : null}
          <Text style={[styles.triggerText, !selectedOption && styles.placeholderText]}>
            {selectedOption ? selectedOption.label : placeholder}
          </Text>
        </View>

        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Ionicons name="chevron-down" size={18} color={isOpen ? colors.primary : colors.textSecondary} />
        </Animated.View>
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {helperText && !error ? <Text style={styles.helperText}>{helperText}</Text> : null}

      {/* ANIMATED DROPDOWN MODAL */}
      <Modal visible={isOpen} transparent animationType="none" onRequestClose={() => closeDropdown()}>
        <TouchableWithoutFeedback onPress={() => closeDropdown()}>
          <Animated.View style={[styles.modalBackdrop, { opacity: modalOpacity }]}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.dropdownCard,
                  {
                    opacity: modalOpacity,
                    transform: [{ scale: modalScale }, { translateY: modalTranslateY }]
                  }
                ]}
              >
                {/* HEADER */}
                <View style={styles.dropdownHeader}>
                  <Text style={styles.dropdownHeaderTitle}>{label || 'Select Category'}</Text>
                  <TouchableOpacity
                    onPress={() => closeDropdown()}
                    style={styles.closeButton}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* OPTIONS LIST */}
                <ScrollView
                  style={styles.scrollList}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {normalizedOptions.map((item, index) => {
                    const isSelected = selectedOption?.value === item.value;

                    return (
                      <Pressable
                        key={item.value || index}
                        onPress={() => handleSelect(item.value)}
                        style={({ pressed }) => [
                          styles.optionItem,
                          isSelected && styles.optionItemSelected,
                          pressed && styles.optionItemPressed
                        ]}
                      >
                        <View style={styles.optionLeft}>
                          <View
                            style={[
                              styles.optionIconWrap,
                              isSelected && styles.optionIconWrapSelected
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={item.icon || 'tag-outline'}
                              size={18}
                              color={isSelected ? colors.primary : colors.textSecondary}
                            />
                          </View>
                          <Text
                            style={[
                              styles.optionText,
                              isSelected && styles.optionTextSelected
                            ]}
                          >
                            {item.label}
                          </Text>
                        </View>

                        {isSelected ? (
                          <View style={styles.checkWrap}>
                            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                          </View>
                        ) : item.badge ? (
                          <View style={styles.badgeWrap}>
                            <Text style={styles.badgeText}>{item.badge}</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 6
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800'
  },
  required: {
    color: colors.danger,
    fontWeight: '900'
  },
  trigger: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 50,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    ...shadows.sm
  },
  triggerActive: {
    borderColor: colors.primary,
    backgroundColor: colors.card
  },
  triggerError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSurface
  },
  triggerDisabled: {
    backgroundColor: colors.cardAlt,
    opacity: 0.6
  },
  triggerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9
  },
  selectedIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.infoSurface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  triggerText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1
  },
  placeholderText: {
    color: colors.textMuted,
    fontWeight: '500'
  },
  errorText: {
    color: colors.danger,
    fontSize: 11.5,
    fontWeight: '700',
    marginLeft: 2
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 11.5,
    marginLeft: 2
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  dropdownCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: 460,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.modal
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardAlt
  },
  dropdownHeaderTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollList: {
    maxHeight: 360
  },
  scrollContent: {
    padding: 8,
    gap: 4
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.md
  },
  optionItemSelected: {
    backgroundColor: colors.infoSurface
  },
  optionItemPressed: {
    backgroundColor: colors.cardAlt
  },
  optionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  optionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  optionIconWrapSelected: {
    backgroundColor: colors.infoBorder
  },
  optionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600'
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '800'
  },
  checkWrap: {
    marginLeft: 8
  },
  badgeWrap: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  badgeText: {
    color: '#B45309',
    fontSize: 10.5,
    fontWeight: '800'
  }
});

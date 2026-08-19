import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, shadows } from '../constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export const DeveloperNoteModal: React.FC<Props> = ({ visible, onClose }) => {
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 50,
          useNativeDriver: true
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        })
      ]).start();
    } else {
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPress} onPress={onClose} />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="code-tags" size={20} color={colors.primary} />
              </View>
              <View>
                <View style={styles.badgeRow}>
                  <Text style={styles.badgeLabel}>DEVELOPER NOTE</Text>
                  <View style={styles.trialPill}>
                    <Text style={styles.trialPillText}>TRIAL VERSION</Text>
                  </View>
                </View>
                <Text style={styles.title}>System Notice</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            {/* MESSAGE CONTAINER */}
            <View style={styles.messageBox}>
              <MaterialCommunityIcons
                name="format-quote-open"
                size={24}
                color={colors.primary}
                style={styles.quoteIcon}
              />
              <Text style={styles.messageText}>
                This application is currently in its trial version. If you experience any issue or unexpected behavior, please report it through the available support/report option. Our development team will review the issue and work on resolving it as soon as possible. After reporting an issue, please allow some time for the fix to be implemented and deployed. Thank you for your patience and understanding.
              </Text>
            </View>

            {/* SIGNATURE BLOCK */}
            <View style={styles.signatureCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>AS</Text>
              </View>
              <View style={styles.sigInfo}>
                <View style={styles.sigNameRow}>
                  <Text style={styles.developerName}>Aniket Singh</Text>
                  <MaterialCommunityIcons name="check-decagram" size={15} color={colors.primary} />
                </View>
                <Text style={styles.developerTitle}>Senior App Developer</Text>
              </View>
            </View>
          </ScrollView>

          {/* ACTION BUTTON */}
          <TouchableOpacity style={styles.primaryBtn} onPress={onClose} activeOpacity={0.88}>
            <Text style={styles.primaryBtnText}>Understood</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject
  },
  card: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.modal
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.infoSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  badgeLabel: {
    color: colors.primary,
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  trialPill: {
    backgroundColor: colors.warningSurface,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.warningBorder
  },
  trialPillText: {
    color: '#92400E',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  title: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 1
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bodyScroll: {
    maxHeight: 340,
    marginVertical: 14
  },
  messageBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative'
  },
  quoteIcon: {
    opacity: 0.4,
    marginBottom: 6
  },
  messageText: {
    color: colors.text,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '500'
  },
  signatureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.infoSurface,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm
  },
  avatarText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900'
  },
  sigInfo: {
    flex: 1
  },
  sigNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  developerName: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '900'
  },
  developerTitle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  primaryBtn: {
    minHeight: 46,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800'
  }
});

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  X,
  Building2,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui';
import { expenseColors } from '@/constants/expenseColors';

interface PdfPasswordModalProps {
  visible: boolean;
  fileName?: string;
  onClose: () => void;
  onUnlock: (password: string) => Promise<boolean | void>;
}

const BANK_PASSWORD_HINTS = [
  { bank: 'SBI', hint: 'DOB (DDMM) + Last 4 digits of Mobile (e.g. 15089876)' },
  { bank: 'HDFC', hint: 'Customer ID or First 4 letters of Name + DDMM (e.g. TIRT1508)' },
  { bank: 'ICICI', hint: 'First 4 letters of Name (lowercase) + DDMM (e.g. tirt1508)' },
  { bank: 'Axis', hint: 'First 4 letters of Name (UPPERCASE) + Last 4 digits of Acc No.' },
  { bank: 'Kotak', hint: 'CRN (Customer Relationship No.) or DOB (DDMMYYYY)' },
  { bank: 'Slice', hint: 'Last 4 digits of registered Mobile Number' },
  { bank: 'Paytm', hint: '10-digit registered Mobile Number' },
  { bank: 'Credit Card', hint: 'PAN Card (UPPERCASE) + Date of Birth (DDMM)' },
];

export const PdfPasswordModal: React.FC<PdfPasswordModalProps> = ({
  visible,
  fileName = 'Statement.pdf',
  onClose,
  onUnlock,
}) => {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [selectedHint, setSelectedHint] = useState<string | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setPassword('');
      setShowPassword(false);
      setErrorMsg(null);
      setIsDecrypting(false);
      setSelectedHint(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 350);
    }
  }, [visible]);

  const triggerShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleUnlock = async () => {
    const cleanPwd = password.trim();
    if (!cleanPwd) {
      setErrorMsg('Please enter statement password');
      triggerShake();
      return;
    }

    Keyboard.dismiss();
    setIsDecrypting(true);
    setErrorMsg(null);

    try {
      const result = await onUnlock(cleanPwd);
      if (result === false) {
        setIsDecrypting(false);
        setErrorMsg('Incorrect password for this document');
        triggerShake();
      }
    } catch (err) {
      setIsDecrypting(false);
      const msg = err instanceof Error ? err.message : 'Incorrect password';
      setErrorMsg(msg.includes('Incorrect') ? 'Incorrect password. Check your bank format.' : msg);
      triggerShake();
    }
  };

  const handleSelectHint = (hintItem: { bank: string; hint: string }) => {
    Haptics.selectionAsync().catch(() => {});
    if (selectedHint === hintItem.bank) {
      setSelectedHint(null);
    } else {
      setSelectedHint(hintItem.bank);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        />

        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ translateX: shakeAnim }],
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <KeyRound size={20} color="#FF9D66" strokeWidth={2.4} />
            </View>

            <View style={styles.headerTextCol}>
              <AppText style={styles.headerTitle}>Unlock Statement</AppText>
              <AppText style={styles.headerFileName} numberOfLines={1} ellipsizeMode="middle">
                {fileName}
              </AppText>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                Keyboard.dismiss();
                Haptics.selectionAsync();
                onClose();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={16} color="#8E919D" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          {/* Privacy & Security Badge */}
          <View style={styles.securityBadge}>
            <ShieldCheck size={14} color="#70D6BC" strokeWidth={2.2} />
            <AppText style={styles.securityBadgeText}>
              100% On-Device Decryption • Zero Cloud Upload
            </AppText>
          </View>

          {/* Password Input Box */}
          <View
            style={[
              styles.inputBox,
              errorMsg ? styles.inputBoxError : null,
              isDecrypting ? styles.inputBoxDisabled : null,
            ]}
          >
            <Lock size={17} color={errorMsg ? '#FF5C5C' : '#8E919D'} strokeWidth={2.2} />
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="Enter PDF password"
              placeholderTextColor="#696C75"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorMsg) setErrorMsg(null);
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleUnlock}
              editable={!isDecrypting}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setShowPassword(!showPassword);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {showPassword ? (
                <EyeOff size={18} color="#8E919D" strokeWidth={2} />
              ) : (
                <Eye size={18} color="#8E919D" strokeWidth={2} />
              )}
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {errorMsg && (
            <View style={styles.errorRow}>
              <AlertCircle size={13} color="#FF5C5C" strokeWidth={2.2} />
              <AppText style={styles.errorText}>{errorMsg}</AppText>
            </View>
          )}

          {/* Common Bank Password Patterns Guide */}
          <View style={styles.hintSection}>
            <View style={styles.hintHeaderRow}>
              <Building2 size={13} color="#FF9D66" strokeWidth={2} />
              <AppText style={styles.hintHeaderTitle}>COMMON BANK PASSWORD PATTERNS</AppText>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hintScroll}
            >
              {BANK_PASSWORD_HINTS.map((item) => {
                const isSelected = selectedHint === item.bank;
                return (
                  <TouchableOpacity
                    key={item.bank}
                    style={[styles.hintChip, isSelected && styles.hintChipSelected]}
                    onPress={() => handleSelectHint(item)}
                    activeOpacity={0.7}
                  >
                    <AppText
                      style={[styles.hintChipText, isSelected && styles.hintChipTextSelected]}
                    >
                      {item.bank}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Active Bank Hint Info Card */}
            {selectedHint && (
              <View style={styles.hintInfoCard}>
                <Sparkles size={13} color="#FF9D66" strokeWidth={2.2} />
                <AppText style={styles.hintInfoText}>
                  {BANK_PASSWORD_HINTS.find((h) => h.bank === selectedHint)?.hint}
                </AppText>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                Keyboard.dismiss();
                Haptics.selectionAsync();
                onClose();
              }}
              activeOpacity={0.7}
              disabled={isDecrypting}
            >
              <AppText style={styles.cancelBtnText}>Cancel</AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.unlockBtn,
                (!password.trim() || isDecrypting) && styles.unlockBtnDisabled,
              ]}
              onPress={handleUnlock}
              activeOpacity={0.85}
              disabled={!password.trim() || isDecrypting}
            >
              {isDecrypting ? (
                <ActivityIndicator size="small" color="#0F1015" />
              ) : (
                <>
                  <Unlock size={16} color="#0F1015" strokeWidth={2.6} />
                  <AppText style={styles.unlockBtnText}>Unlock & Import</AppText>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#16171E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerFileName: {
    color: '#8E919D',
    fontSize: 11.5,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(112, 214, 188, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(112, 214, 188, 0.2)',
  },
  securityBadgeText: {
    color: '#70D6BC',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0F1017',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    height: 50,
  },
  inputBoxError: {
    borderColor: '#FF5C5C',
    backgroundColor: 'rgba(255, 92, 92, 0.05)',
  },
  inputBoxDisabled: {
    opacity: 0.6,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '600',
    padding: 0,
  },
  eyeBtn: {
    padding: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
  },
  errorText: {
    color: '#FF5C5C',
    fontSize: 11.5,
    fontWeight: '600',
  },
  hintSection: {
    gap: 8,
  },
  hintHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hintHeaderTitle: {
    color: '#8E919D',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  hintScroll: {
    gap: 6,
  },
  hintChip: {
    backgroundColor: '#0F1017',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hintChipSelected: {
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
    borderColor: '#FF9D66',
  },
  hintChipText: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '700',
  },
  hintChipTextSelected: {
    color: '#FF9D66',
    fontWeight: '800',
  },
  hintInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 157, 102, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.2)',
  },
  hintInfoText: {
    color: '#FF9D66',
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelBtnText: {
    color: '#8E919D',
    fontSize: 13.5,
    fontWeight: '700',
  },
  unlockBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FF9D66',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  unlockBtnDisabled: {
    opacity: 0.45,
  },
  unlockBtnText: {
    color: '#0F1015',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});

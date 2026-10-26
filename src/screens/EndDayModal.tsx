import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import Icon from '../components/Ionicons';

const EndDayModal = ({ visible, onClose, onConfirm, missedVisits = [] }) => {
  const [comment, setComment] = useState('');
  const [missedReasons, setMissedReasons] = useState({});
  const [isValid, setIsValid] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const getuser = async () => {
      const result = await UniversalUpdateInsert({
        ObjectName: "User",
        Type: "get",
      });
      setUser(result?.[0] || null);
    };
    getuser();
  }, []);

  const isCommentOptional =
    user?.DeveloperName === 'MT_Merchandiser' ||
    user?.DeveloperName === 'MT_SO';

  const hasMissedVisits = Array.isArray(missedVisits) && missedVisits.length > 0;

  const handleReasonChange = (key, text) => {
    setMissedReasons(prev => ({
      ...prev,
      [key]: text,
    }));
  };

  useEffect(() => {
    const commentValid = isCommentOptional ? true : comment.trim().length > 0;
    const allMissedReasonsValid = !hasMissedVisits || missedVisits.every((item) => {
      const key = item.sfId || item.id || item.visitId;
      return (missedReasons[key] || '').trim().length > 0;
    });

    setIsValid(commentValid && allMissedReasonsValid);
  }, [comment, missedReasons, isCommentOptional, hasMissedVisits, missedVisits]);

  const handleConfirm = () => {
    if (isValid) {
      onClose();
      onConfirm({
        comment: comment.trim(),
        missedReasonsMap: missedReasons,
        missedVisitReason: Object.values(missedReasons).filter(Boolean).map(r => r.trim()).join('; '),
      });
      setComment('');
      setMissedReasons({});
    }
  };

  const handleClose = () => {
    setComment('');
    setMissedReasons({});
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
      statusBarTranslucent={false}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardAvoidingContainer}
          >
            <View style={styles.modalContainer}>
              <View style={styles.dragIndicator} />

              <Text style={styles.modalTitle}>End Your Day</Text>
              <View style={styles.underline} />

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={styles.scrollContent}
              >
                {/* 🔹 INDIVIDUAL MISSED VISITS LIST IN MODAL */}
                {hasMissedVisits && (
                  <View style={styles.missedSection}>
                    <View style={styles.missedHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Icon name="alert-circle-outline" size={18} color="#C9A24D" />
                        <Text style={styles.missedTitle}>Missed Outlets ({missedVisits.length})</Text>
                      </View>
                      <View style={styles.missedCountBadge}>
                        <Text style={styles.missedCountText}>{missedVisits.length}</Text>
                      </View>
                    </View>
                    <Text style={styles.missedSubtitle}>
                      Please provide a reason for each missed visit:
                    </Text>

                    <View style={styles.missedListContainer}>
                      {missedVisits.map((item, idx) => {
                        const key = item.sfId || item.id || item.visitId || `missed_${idx}`;
                        return (
                          <View key={key} style={styles.missedCard}>
                            <View style={styles.missedCardHeader}>
                              <Text style={styles.missedOutletName} numberOfLines={1}>
                                {idx + 1}. {item.accountName}
                              </Text>
                              <View style={styles.missedTag}>
                                <Text style={styles.missedTagText}>Missed</Text>
                              </View>
                            </View>
                            {item.accountCode || item.beatName ? (
                              <Text style={styles.missedOutletSub} numberOfLines={1}>
                                {[item.accountCode ? `Code: ${item.accountCode}` : '', item.beatName].filter(Boolean).join(' • ')}
                              </Text>
                            ) : null}

                            <Text style={styles.missedReasonLabel}>
                              Reason for missing <Text style={styles.required}>*</Text>
                            </Text>
                            <TextInput
                              style={styles.missedTextInput}
                              multiline
                              numberOfLines={2}
                              placeholder={`Enter reason for ${item.accountName}...`}
                              placeholderTextColor="#7A7266"
                              value={missedReasons[key] || ''}
                              onChangeText={(text) => handleReasonChange(key, text)}
                              returnKeyType="done"
                              onSubmitEditing={Keyboard.dismiss}
                            />
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 🔹 COMMENT FIELD */}
                <Text style={styles.label}>
                  Comment {!isCommentOptional && <Text style={styles.required}>*</Text>}
                </Text>
                <TextInput
                  style={styles.textInput}
                  multiline
                  numberOfLines={3}
                  placeholder="Write your comment here..."
                  placeholderTextColor="#7A7266"
                  value={comment}
                  onChangeText={setComment}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </ScrollView>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={handleClose}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.confirmButton,
                    !isValid && styles.disabledButton,
                  ]}
                  onPress={handleConfirm}
                  disabled={!isValid}
                >
                  <Text style={styles.buttonText}>End Day</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  keyboardAvoidingContainer: {
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
  },
  scrollContent: {
    maxHeight: 420,
  },
  dragIndicator: {
    width: 50,
    height: 5,
    backgroundColor: '#ccc',
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'left',
    marginBottom: 5,
  },
  underline: {
    height: 1,
    backgroundColor: '#D9D2C3',
    width: '100%',
    marginBottom: 15,
  },
  missedSection: {
    backgroundColor: '#FFF7F7',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  missedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  missedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#A67C2E',
    marginLeft: 6,
  },
  missedCountBadge: {
    backgroundColor: '#C9A24D',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  missedCountText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  missedSubtitle: {
    fontSize: 12,
    color: '#7A7266',
    marginBottom: 8,
  },
  missedListContainer: {
    maxHeight: 220,
    marginBottom: 8,
  },
  missedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  missedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  missedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1EADB',
  },
  missedTag: {
    backgroundColor: '#F1EADB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  missedTagText: {
    color: '#A67C2E',
    fontSize: 10,
    fontWeight: '700',
  },
  missedOutletName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F1D1A',
    flex: 1,
  },
  missedOutletSub: {
    fontSize: 11,
    color: '#7A7266',
    marginTop: 2,
    marginBottom: 6,
  },
  missedReasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F1D1A',
    marginTop: 4,
    marginBottom: 4,
  },
  missedTextInput: {
    borderColor: '#D9D2C3',
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 50,
    padding: 8,
    textAlignVertical: 'top',
    backgroundColor: '#F9FAFB',
    color: '#1F1D1A',
    fontSize: 13,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1D1A',
    marginBottom: 6,
    marginTop: 4,
  },
  required: {
    color: '#B3261E',
    fontWeight: 'bold',
  },
  textInput: {
    borderColor: '#D1D5DB',
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 70,
    padding: 10,
    textAlignVertical: 'top',
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
    color: '#1F1D1A',
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    flex: 1,
    padding: 14,
    marginHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#7A7266',
  },
  confirmButton: {
    backgroundColor: '#C9A24D',
  },
  disabledButton: {
    backgroundColor: '#FCA5A5',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default EndDayModal;
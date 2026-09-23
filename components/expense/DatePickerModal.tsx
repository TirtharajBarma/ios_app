import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { expenseColors } from '@/constants/expenseColors';

interface DatePickerModalProps {
  visible: boolean;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
  title?: string;
}

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
  title = 'Select Date',
}) => {
  const [viewYear, setViewYear] = useState<number>(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(selectedDate.getMonth()); // 0-indexed

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startOffset = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun

  const rows: (number | null)[][] = [];
  let curRow: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) {
    curRow.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    curRow.push(d);
    if (curRow.length === 7) {
      rows.push(curRow);
      curRow = [];
    }
  }
  if (curRow.length > 0) {
    while (curRow.length < 7) {
      curRow.push(null);
    }
    rows.push(curRow);
  }

  const isCurrentSelected = (day: number) => {
    return (
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day
    );
  };

  const handleDaySelect = (day: number) => {
    const newDate = new Date(viewYear, viewMonth, day);
    onSelectDate(newDate);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.titleWithIcon}>
                  <CalendarIcon size={18} color={expenseColors.accentPeach} />
                  <AppText style={styles.modalTitle}>{title}</AppText>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={20} color="#A0A5B5" />
                </TouchableOpacity>
              </View>

              {/* Month / Year Navigator */}
              <View style={styles.navRow}>
                <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
                  <ChevronLeft size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <AppText style={styles.monthYearText}>
                  {monthNames[viewMonth]} {viewYear}
                </AppText>
                <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
                  <ChevronRight size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Weekdays */}
              <View style={styles.weekdaysRow}>
                {weekdays.map(w => (
                  <View key={w} style={styles.weekdayCol}>
                    <AppText style={styles.weekdayText}>{w}</AppText>
                  </View>
                ))}
              </View>

              {/* Days Grid */}
              <View style={styles.grid}>
                {rows.map((row, rIdx) => (
                  <View key={rIdx} style={styles.gridRow}>
                    {row.map((day, cIdx) => {
                      if (day === null) {
                        return <View key={`b-${cIdx}`} style={styles.dayTile} />;
                      }
                      const selected = isCurrentSelected(day);
                      return (
                        <TouchableOpacity
                          key={`d-${day}`}
                          onPress={() => handleDaySelect(day)}
                          activeOpacity={0.7}
                          style={[styles.dayTile, selected && styles.dayTileSelected]}
                        >
                          <AppText style={[styles.dayText, selected && styles.dayTextSelected]}>
                            {day}
                          </AppText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>

              {/* Quick Actions */}
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => {
                    const today = new Date();
                    onSelectDate(today);
                    onClose();
                  }}
                >
                  <AppText style={styles.quickBtnText}>Today</AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => {
                    const nextMonth = new Date();
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    onSelectDate(nextMonth);
                    onClose();
                  }}
                >
                  <AppText style={styles.quickBtnText}>Next Month</AppText>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#16171E',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22242F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F222E',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 12,
  },
  navBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weekdayCol: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    color: expenseColors.textSubtle,
    fontSize: 11,
    fontWeight: '600',
  },
  grid: {
    gap: 4,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayTile: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginHorizontal: 1,
  },
  dayTileSelected: {
    backgroundColor: expenseColors.accentPeach,
  },
  dayText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  dayTextSelected: {
    color: '#0F1015',
    fontWeight: '800',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#22242F',
  },
  quickBtnText: {
    color: expenseColors.accentPeach,
    fontSize: 12,
    fontWeight: '600',
  },
});

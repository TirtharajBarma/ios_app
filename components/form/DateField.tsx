import React, { useState, useMemo, memo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isBefore,
  getYear,
  getMonth,
  setMonth,
  setYear,
} from "date-fns";
import { AppText } from "@/components/ui";
import { colors, spacing } from "@/constants";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface DateFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
}

type ViewMode = "calendar" | "monthPicker" | "yearPicker";

function DateField({ label, value, onChange, minimumDate }: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [calendarMonth, setCalendarMonth] = useState(value);

  const handleOpen = () => {
    setCalendarMonth(value);
    setViewMode("calendar");
    setShowPicker(true);
  };

  const handleClose = () => {
    setShowPicker(false);
    setViewMode("calendar");
  };

  const handleDayPress = (day: Date) => {
    onChange(day);
    setShowPicker(false);
    setViewMode("calendar");
  };

  const handleMonthSelect = (monthIndex: number) => {
    const updated = setMonth(calendarMonth, monthIndex);
    setCalendarMonth(updated);
    setViewMode("calendar");
  };

  const handleYearSelect = (year: number) => {
    const updated = setYear(calendarMonth, year);
    setCalendarMonth(updated);
    setViewMode("monthPicker");
  };

  // ── Calendar grid days ───────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    const days: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [calendarMonth]);

  // ── Year range for year picker ──────────────────────────────────
  const currentYear = getYear(calendarMonth);
  const yearRange = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear - 60; y <= currentYear + 10; y++) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  // ── Android fallback ────────────────────────────────────────────
  if (Platform.OS === "android") {
    return <AndroidDateField label={label} value={value} onChange={onChange} minimumDate={minimumDate} />;
  }

  // ── iOS: tappable row → modal calendar ──────────────────────────
  return (
    <>
      <Pressable onPress={handleOpen} style={styles.row}>
        <AppText variant="body" weight="600" color={colors.white}>
          {label}
        </AppText>
        <AppText variant="body" color={colors.textSecondary}>
          {format(value, "MMM d, yyyy")}
        </AppText>
      </Pressable>

      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          <View style={styles.modalSheet}>
            {/* Header: Done button */}
            <View style={styles.modalHeader}>
              <View style={{ width: 60 }} />
              <TouchableOpacity onPress={handleClose}>
                <AppText variant="callout" weight="600" color={colors.accent}>
                  Done
                </AppText>
              </TouchableOpacity>
            </View>

            {/* Calendar View */}
            {viewMode === "calendar" && (
              <>
                {/* Month/Year Navigation */}
                <View style={styles.monthNav}>
                  <TouchableOpacity
                    onPress={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                    style={styles.navArrow}
                  >
                    <AppText variant="title3" color={colors.white}>{"<"}</AppText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setViewMode("monthPicker")}
                    style={styles.monthTitleBtn}
                  >
                    <AppText variant="headline" weight="700" color={colors.white} numberOfLines={1}>
                      {format(calendarMonth, "MMMM yyyy")}
                    </AppText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                    style={styles.navArrow}
                  >
                    <AppText variant="title3" color={colors.white}>{">"}</AppText>
                  </TouchableOpacity>
                </View>

                {/* Weekday headers */}
                <View style={styles.weekdayRow}>
                  {WEEKDAYS.map((d) => (
                    <View key={d} style={styles.weekdayCell}>
                      <AppText variant="caption2" weight="700" color={colors.textMuted}>
                        {d}
                      </AppText>
                    </View>
                  ))}
                </View>

                {/* Day grid */}
                <View style={styles.dayGrid}>
                  {calendarDays.map((day, idx) => {
                    const inMonth = isSameMonth(day, calendarMonth);
                    const isSelected = isSameDay(day, value);
                    const isDisabled = minimumDate && isBefore(day, minimumDate) && !isSameDay(day, minimumDate);
                    return (
                      <Pressable
                        key={idx}
                        onPress={() => !isDisabled && inMonth && handleDayPress(day)}
                        style={[
                          styles.dayCell,
                          isSelected && styles.dayCellSelected,
                        ]}
                        disabled={!inMonth || isDisabled}
                      >
                        <AppText
                          variant="footnote"
                          weight={isSelected ? "700" : "500"}
                          color={
                            !inMonth
                              ? "transparent"
                              : isSelected
                                ? colors.white
                                : isDisabled
                                  ? colors.textMuted
                                  : colors.white
                          }
                        >
                          {format(day, "d")}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {/* Month Picker View */}
            {viewMode === "monthPicker" && (
              <>
                <View style={styles.monthNav}>
                  <TouchableOpacity
                    onPress={() => setCalendarMonth(setYear(calendarMonth, currentYear - 1))}
                    style={styles.navArrow}
                  >
                    <AppText variant="title3" color={colors.white}>{"<"}</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setViewMode("yearPicker")}>
                    <AppText variant="headline" weight="700" color={colors.white}>
                      {currentYear}
                    </AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCalendarMonth(setYear(calendarMonth, currentYear + 1))}
                    style={styles.navArrow}
                  >
                    <AppText variant="title3" color={colors.white}>{">"}</AppText>
                  </TouchableOpacity>
                </View>

                <View style={styles.monthGrid}>
                  {MONTHS.map((monthName, idx) => {
                    const isActive = getMonth(calendarMonth) === idx;
                    return (
                      <TouchableOpacity
                        key={monthName}
                        onPress={() => handleMonthSelect(idx)}
                        style={[
                          styles.monthCell,
                          isActive && styles.monthCellActive,
                        ]}
                      >
                        <AppText
                          variant="footnote"
                          weight={isActive ? "700" : "500"}
                          color={isActive ? colors.white : colors.textSecondary}
                        >
                          {SHORT_MONTHS[idx]}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Year Picker View */}
            {viewMode === "yearPicker" && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.yearScrollContent}
              >
                <View style={styles.yearGrid}>
                  {yearRange.map((year) => {
                    const isActive = year === currentYear;
                    return (
                      <TouchableOpacity
                        key={year}
                        onPress={() => handleYearSelect(year)}
                        style={[
                          styles.yearCell,
                          isActive && styles.yearCellActive,
                        ]}
                      >
                        <AppText
                          variant="footnote"
                          weight={isActive ? "700" : "500"}
                          color={isActive ? colors.white : colors.textSecondary}
                        >
                          {year}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

// ── Android fallback (unchanged) ──────────────────────────────────
function AndroidDateField({ label, value, onChange, minimumDate }: DateFieldProps) {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.container}>
      <AppText variant="body" weight="600" color={colors.white}>{label}</AppText>
      <View>
        <Pressable onPress={() => setShow(true)} style={styles.triggerAndroid}>
          <AppText variant="body" weight="500" color={colors.textSecondary}>
            {format(value, "yyyy-MM-dd")}
          </AppText>
        </Pressable>
        {show && (
          <DateTimePicker
            value={value}
            mode="date"
            display="default"
            minimumDate={minimumDate}
            onChange={(_: DateTimePickerEvent, date?: Date) => {
              setShow(false);
              if (date) onChange(date);
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[8],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 36,
  },
  triggerAndroid: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[12],
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
  },
  // ── Modal ─────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing[24],
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[16],
  },
  // ── Month navigation ──────────────────────────────────────────
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[12],
    paddingBottom: spacing[16],
  },
  navArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitleBtn: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing[8],
  },
  // ── Weekday row ───────────────────────────────────────────────
  weekdayRow: {
    flexDirection: "row",
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[8],
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
  },
  // ── Day grid ──────────────────────────────────────────────────
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing[4],
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellSelected: {
    backgroundColor: colors.accent,
    borderRadius: 999,
  },
  // ── Month grid ────────────────────────────────────────────────
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing[12],
    gap: spacing[8],
  },
  monthCell: {
    width: "30%",
    paddingVertical: spacing[12],
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  monthCellActive: {
    backgroundColor: colors.accent,
  },
  // ── Year grid ─────────────────────────────────────────────────
  yearScrollContent: {
    paddingHorizontal: spacing[12],
    paddingBottom: spacing[16],
  },
  yearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  yearCell: {
    width: "30%",
    paddingVertical: spacing[12],
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  yearCellActive: {
    backgroundColor: colors.accent,
  },
});

export default memo(DateField);

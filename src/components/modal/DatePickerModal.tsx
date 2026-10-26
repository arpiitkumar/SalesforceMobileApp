import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import Feather from '@react-native-vector-icons/feather';
import moment from 'moment';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const DatePickerModal = ({
  visible,
  onClose,
  onSelectDate,
  selectedDate,
  maxDate = new Date(),
  minDate = null,
  title = 'Select Date',
}) => {
  const [calendarMonth, setCalendarMonth] = useState(
    selectedDate ? moment(selectedDate) : moment()
  );

  const isCurrentCalendarMonth = useMemo(() => {
    const now = moment();
    return (
      calendarMonth.year() === now.year() && calendarMonth.month() === now.month()
    );
  }, [calendarMonth]);

  const monthMatrix = useMemo(() => {
    const start = calendarMonth.clone().startOf('month');
    const daysInMonth = calendarMonth.daysInMonth();
    const startDay = start.day();
    const matrix = [];
    let week = new Array(7).fill(null);
    let day = 1;
    for (let i = startDay; i < 7 && day <= daysInMonth; i++) {
      week[i] = day++;
    }
    matrix.push(week);
    while (day <= daysInMonth) {
      week = new Array(7).fill(null);
      for (let i = 0; i < 7 && day <= daysInMonth; i++) {
        week[i] = day++;
      }
      matrix.push(week);
    }
    return matrix;
  }, [calendarMonth]);

  const goPrevMonth = () => {
    setCalendarMonth(prev => prev.clone().subtract(1, 'month'));
  };

  const goNextMonth = () => {
    if (!isCurrentCalendarMonth) {
      setCalendarMonth(prev => prev.clone().add(1, 'month'));
    }
  };

  const handleSelectDay = (day) => {
    const selected = calendarMonth.clone().date(day).format('YYYY-MM-DD');
    onSelectDate(selected);
    onClose();
  };

  const isDateDisabled = (day) => {
    const cellDate = calendarMonth.clone().date(day);
    if (maxDate && cellDate.isAfter(moment(maxDate).endOf('day'))) return true;
    if (minDate && cellDate.isBefore(moment(minDate).startOf('day'))) return true;
    return false;
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
            <View style={styles.sheet}>
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="x" size={22} color="#1F1D1A" />
                </TouchableOpacity>
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity onPress={goPrevMonth} style={styles.navBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="chevron-left" size={20} color="#1F1D1A" />
                </TouchableOpacity>
                <Text style={styles.monthLabel}>{calendarMonth.format('MMMM YYYY')}</Text>
                <TouchableOpacity
                  onPress={goNextMonth}
                  disabled={isCurrentCalendarMonth}
                  style={styles.navBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather name="chevron-right" size={20} color={isCurrentCalendarMonth ? '#D9D2C3' : '#1F1D1A'} />
                </TouchableOpacity>
              </View>

              <View style={styles.weekRow}>
                {WEEKDAYS.map((wd) => (
                  <Text key={wd} style={styles.weekLabel}>{wd}</Text>
                ))}
              </View>

              <View style={styles.grid}>
                {monthMatrix.map((week, wIdx) =>
                  week.map((day, dIdx) => {
                    if (!day) return <View key={`${wIdx}-${dIdx}`} style={styles.cell} />;
                    const disabled = isDateDisabled(day);
                    const cellDate = calendarMonth.clone().date(day);
                    const isSelected = selectedDate === cellDate.format('YYYY-MM-DD');
                    const isToday = cellDate.isSame(moment(), 'day');
                    return (
                      <TouchableOpacity
                        key={`${wIdx}-${dIdx}`}
                        style={styles.cell}
                        disabled={disabled}
                        onPress={() => handleSelectDay(day)}
                      >
                        <View
                          style={[
                            styles.dayCircle,
                            isSelected && styles.daySelected,
                            isToday && !isSelected && styles.dayToday,
                            disabled && styles.dayDisabled,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              isSelected && styles.dayTextSelected,
                              isToday && !isSelected && styles.dayTextToday,
                              disabled && styles.dayTextDisabled,
                            ]}
                          >
                            {day}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default DatePickerModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    width: '100%',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1D1A',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FBF8F1',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1D1A',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F5',
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#7A7266',
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  daySelected: {
    backgroundColor: '#C9A24D',
    shadowColor: '#C9A24D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  dayToday: {
    backgroundColor: '#F1EADB',
    borderWidth: 1.5,
    borderColor: '#C9A24D',
  },
  dayDisabled: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F1D1A',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  dayTextToday: {
    color: '#A67C2E',
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: '#7A7266',
  },
});

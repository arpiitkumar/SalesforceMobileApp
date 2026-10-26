// FilterComponent.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import DatePicker from 'react-native-modern-datepicker';

const PRESETS = [
  { label: 'All', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: 'last7' },
  { label: 'Last 30 Days', value: 'last30' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'Custom Range', value: 'custom' },
];

const formatDateISO = (d) => {
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d) : d;
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const computeRange = (preset) => {
  const now = new Date();
  let from = null;
  let to = null;

  switch (preset) {
    case 'today':
      from = to = new Date();
      break;
    case 'yesterday': {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      from = to = d;
      break;
    }
    case 'last7': {
      to = new Date();
      from = new Date();
      from.setDate(to.getDate() - 6);
      break;
    }
    case 'last30': {
      to = new Date();
      from = new Date();
      from.setDate(to.getDate() - 29);
      break;
    }
    case 'thisMonth': {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      // to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      to = new Date();
      break;
    }
    case 'lastMonth': {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    }
    default:
      return { from: null, to: null };
  }

  return { from: formatDateISO(from), to: formatDateISO(to) };
};

/**
 * Props:
 * - onApply({ from, to }) => called whenever effective filter changes.
 * - initial (optional): { from: 'YYYY-MM-DD' | null, to: 'YYYY-MM-DD' | null }
 * - gradient (optional): gradient array for Apply button
 */
const FilterComponent = ({ onApply, initial = { from: null, to: null },initialPreset = 'all', visiblePresets = null, gradient = ['#1E3A8A', '#153D8E'] }) => {

  const resolveInitialPreset = () => {
  if (initialPreset === 'custom') {
    return initial.from && initial.to ? 'custom' : 'all';
  }
  return initialPreset;
};

const [selectedPreset, setSelectedPreset] = useState(resolveInitialPreset);
  // const [selectedPreset, setSelectedPreset] = useState(initial.from || initial.to ? 'custom' : 'all');

  // Applied dates (the effective filter applied to the data)
  const [fromDate, setFromDate] = useState(initial.from || null);
  const [toDate, setToDate] = useState(initial.to || null);

  // Custom modal visible state
  const [customModalVisible, setCustomModalVisible] = useState(false);

  // DatePicker modal used inside the custom dialog (for picking one date)
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerFor, setDatePickerFor] = useState('from'); // 'from'|'to'

  // Temporary edits inside custom dialog (so Cancel can discard them)
  const [tempFrom, setTempFrom] = useState(fromDate);
  const [tempTo, setTempTo] = useState(toDate);
  const [error, setError] = useState(null);

  // previousApplied keeps the previously applied filter+preset so Cancel reverts
  // const previousApplied = useRef({ preset: initial.from || initial.to ? 'custom' : 'all', from: initial.from || null, to: initial.to || null });

  const previousApplied = useRef({
  preset: resolveInitialPreset(),
  from: initial.from || null,
  to: initial.to || null,
});

  // detect real changes to initial prop (so parent won't clobber us on unrelated re-renders)
  const prevInitialRef = useRef(JSON.stringify(initial));
  useEffect(() => {
    const prev = prevInitialRef.current;
    const next = JSON.stringify(initial);
    if (prev !== next) {
      setFromDate(initial.from || null);
      setToDate(initial.to || null);
      setSelectedPreset(initial.from || initial.to ? 'custom' : 'all');
      previousApplied.current = { preset: initial.from || initial.to ? 'custom' : 'all', from: initial.from || null, to: initial.to || null };
      prevInitialRef.current = next;
    }
  }, [initial]);

  // When user taps a non-custom preset chip, update selectedPreset only.
  // A useEffect below will compute and apply the range so the highlight paints first.
  const handlePresetTap = (value) => {
    if (value === 'custom') {
      // open modal dialog for custom (do not change selectedPreset yet)
      // initialize temp values so user sees current applied dates (or empty)
      setTempFrom(fromDate);
      setTempTo(toDate);
      setError(null);
      setCustomModalVisible(true);
      return;
    }

    setSelectedPreset(value);
  };

  // Apply presets (non-custom) after selectedPreset change so UI highlight updates first
  useEffect(() => {
    setError(null);

    if (selectedPreset === 'custom') {
      // don't auto-apply custom here
      return;
    }

    if (selectedPreset === 'all') {
      setFromDate(null);
      setToDate(null);
      previousApplied.current = { preset: 'all', from: null, to: null };
      onApply && onApply({ from: null, to: null });
      return;
    }

    // compute & apply
    const { from, to } = computeRange(selectedPreset);
    setFromDate(from);
    setToDate(to);
    previousApplied.current = { preset: selectedPreset, from, to };
    onApply && onApply({ from, to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPreset]);

  useEffect(() => {
  if (initialPreset === 'custom') {
    if (initial.from && initial.to) {
      onApply?.({ from: initial.from, to: initial.to });
    }
    return;
  }

  if (initialPreset === 'all') {
    onApply?.({ from: null, to: null });
    return;
  }

  const { from, to } = computeRange(initialPreset);
  setFromDate(from);
  setToDate(to);
  onApply?.({ from, to });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  // Open the small datepicker (inside custom modal) for either From or To
  const openDatePicker = (which) => {
    setDatePickerFor(which);
    setDatePickerVisible(true);
  };

  // Called when datepicker returns a date (format usually 'YYYY/MM/DD')
  const onDatePicked = (raw) => {
    const normalized = raw ? raw.replace(/\//g, '-') : null;
    if (datePickerFor === 'from') setTempFrom(normalized);
    else setTempTo(normalized);
    setDatePickerVisible(false);
  };

  // When user hits Apply in custom dialog
  const onCustomApply = () => {
    setError(null);
    if (!tempFrom || !tempTo) {
      setError('Please select both From and To dates.');
      return;
    }
    const f = new Date(tempFrom);
    const t = new Date(tempTo);
    if (t < f) {
      setError('To date cannot be earlier than From date.');
      return;
    }

    // commit temp -> applied
    setFromDate(tempFrom);
    setToDate(tempTo);
    setSelectedPreset('custom'); // make the custom chip active
    previousApplied.current = { preset: 'custom', from: tempFrom, to: tempTo };
    onApply && onApply({ from: tempFrom, to: tempTo });

    // close dialog
    setCustomModalVisible(false);
  };

  // When user hits Cancel in custom dialog
  const onCustomCancel = () => {
    // revert any temp edits
    const prev = previousApplied.current || { preset: 'all', from: null, to: null };

    // restore applied values
    setFromDate(prev.from || null);
    setToDate(prev.to || null);

    // set selectedPreset to previous preset so chips reflect previous selection
    setSelectedPreset(prev.preset || 'all');

    // notify parent to ensure data reverts (parent likely already has prev, but safe to call)
    onApply && onApply({ from: prev.from || null, to: prev.to || null });

    // close dialog
    setCustomModalVisible(false);
  };

  const filteredPresets = React.useMemo(() => {
  if (!Array.isArray(visiblePresets) || visiblePresets.length === 0) {
    return PRESETS;
  }
  return PRESETS.filter(p => visiblePresets.includes(p.value));
}, [visiblePresets]);


  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {filteredPresets.map((p) => {
          const active = selectedPreset === p.value;
          return (
            <TouchableOpacity
              key={p.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => handlePresetTap(p.value)}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Custom dialog modal */}
      <Modal visible={customModalVisible} transparent animationType="fade">
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Custom Range</Text>

            <View style={styles.row}>
              <TouchableOpacity style={styles.dateBox} onPress={() => openDatePicker('from')}>
                <Text style={styles.smallLabel}>From</Text>
                <Text style={styles.dateText}>{tempFrom || 'Select date'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.dateBox} onPress={() => openDatePicker('to')}>
                <Text style={styles.smallLabel}>To</Text>
                <Text style={styles.dateText}>{tempTo || 'Select date'}</Text>
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.dialogButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCustomCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <LinearGradient colors={gradient} style={styles.applyGradient}>
                <TouchableOpacity style={styles.applyTouchable} onPress={onCustomApply}>
                  <Text style={styles.applyText}>Apply</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </View>
      </Modal>

      {/* DatePicker modal (used by the custom dialog) */}
      <Modal visible={datePickerVisible} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>{datePickerFor === 'from' ? 'Select From date' : 'Select To date'}</Text>
            <DatePicker
              mode="calendar"
              onSelectedChange={(d) => onDatePicked(d)}
              current={(datePickerFor === 'from' ? tempFrom : tempTo) || formatDateToday()}
              options={{
                mainColor: '#1E3A8A',
                textHeaderColor: '#000',
                textDefaultColor: '#000',
                selectedTextColor: '#fff',
                textSecondaryColor: '#7f8c8d',
                backgroundColor: '#fff',
              }}
            />
            <TouchableOpacity style={styles.pickerClose} onPress={() => setDatePickerVisible(false)}>
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const formatDateToday = () => {
  const d = new Date();
  return formatDateISO(d);
};

const styles = StyleSheet.create({
  // container: { padding: 12 },
  container: { paddingHorizontal: 16, paddingVertical: 12 },
  chipsRow: { alignItems: 'center', paddingRight: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#17a508ff' },
  chipText: { color: '#1F1D1A', fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  /* Dialog styles */
  dialogOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  dialogCard: { width: '90%', backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 6 },
  dialogTitle: { fontSize: 16, fontWeight: '700', color: '#1F1D1A', marginBottom: 12 },

  row: { flexDirection: 'row', justifyContent: 'space-between' },
  dateBox: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#F7FAFF', marginRight: 8 },
  smallLabel: { fontSize: 12, color: '#6B7B8A', marginBottom: 6 },
  dateText: { fontSize: 14, color: '#1F1D1A' },

  errorText: { color: '#B3261E', marginTop: 8 },

  dialogButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, alignItems: 'center' },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#F2F4F7', borderRadius: 8, marginRight: 10 },
  cancelText: { color: '#1F1D1A', fontWeight: '700' },
  applyGradient: { borderRadius: 10, overflow: 'hidden' },
  applyTouchable: { paddingVertical: 10, paddingHorizontal: 18 },
  applyText: { color: '#fff', fontWeight: '700' },

  /* DatePicker modal */
  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  pickerCard: { backgroundColor: '#fff', padding: 12, borderTopLeftRadius: 12, borderTopRightRadius: 12, maxHeight: '75%' },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#1F1D1A', marginBottom: 8 },
  pickerClose: { marginTop: 8, alignItems: 'flex-end' },
  pickerCloseText: { color: '#1E3A8A', fontWeight: '700' },
});

export default FilterComponent;

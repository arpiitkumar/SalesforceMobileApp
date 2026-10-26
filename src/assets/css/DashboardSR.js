// EmamiScreen.styles.ts
import { Dimensions, StyleSheet } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PADDING = 16;
const GAP = 8;
const NUM_COLUMNS = 3;

export const getDashboardSRStyle = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', padding: 12 },
  dropdownWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#DDD',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 16,
  },
  userIcon: { marginRight: 8 },
  dropdown: { flex: 1, height: '100%' },
  dropdownContainer: { zIndex: 1000 },
  renderItem: { padding: 12 },
  renderItemText: { fontSize: 16 },
  tabRow: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden' },
  tab: { flex: 1, height: 40 },
  checkInGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabInactive: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    borderWidth: 0.6,
    borderColor: '#D3D3D3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabTextActive: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  tabTextInactive: { color: '#555', fontSize: 13 },
  content: { paddingBottom: 32, marginTop: 12 },
  beatRow: { flexDirection: 'row', marginBottom: 16 },
  beatCard: {
    backgroundColor: '#F1EADB',
    borderRadius: 12,
    padding: 12,
  },
  beatText: { marginTop: 5, color: '#A67C2E', fontSize: 12, fontWeight: '500' },
  currentBeat: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    justifyContent: 'center',
    paddingLeft: 12,
    alignItems: 'flex-start',
  },
  currentTitle: { fontSize: 16, fontWeight: '700', color: '#1F1D1A' },
  currentSubtitle: { fontSize: 12, color: '#1F1D1A', marginTop: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D9D2C3',
    borderRadius: 12,
    padding: 12,
    minWidth: (SCREEN_WIDTH - H_PADDING * 2 - GAP * 2) / NUM_COLUMNS,
  },
  metricValueWrapper: {

  },
  metricValue: { fontSize: 18, fontWeight: '700', color: 'black' },
  metricSubtitle: { fontSize: 12, color: '#1F1D1A', marginTop: 4 },
  orderSummary: { marginTop: 12, gap: 12 },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeText: { color: '#4CAF50', fontSize: 18, fontWeight: '700', },
  orderValue: { fontSize: 20, fontWeight: '700', color: '#000' },
  orderLabel: { fontSize: 14, color: '#1F1D1A', flex: 1, fontWeight: '500' },
  colAlign: { flexDirection: 'column', gap: 8 },
  performance: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  metricCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderColor: '#D9D2C3',
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    width: '32%',
    minHeight: 80,
    position: 'relative',
  },
  cardLarge: { width: '100%', minHeight: 11 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end' },
  valueMain: { fontSize: 20, fontWeight: '700', color: '#111' },
  valueSuffix: { fontSize: 20, fontWeight: '700', color: '#111', marginLeft: 4 },
  subtitle: { marginTop: 4, fontSize: 12, color: '#555' },
  labelText: { color: 'black', fontSize: 12, fontWeight: 'bold' },
  subtitleText: { fontSize: 12, color: '#555' },
  icon: { width: 40, height: 40, marginLeft: 8 },
  trendContainer: { position: 'absolute', top: 12, right: 12 },
  // add to your styles object
  filterWrapper: {
    // ensure parent allows children to overflow
    overflow: 'visible',
    zIndex: 9999,        // iOS stacking
    elevation: 9999,     // Android stacking
  },









  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D9D2C3',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 4,
    gap: 5,
    zIndex: 9999,
  },
  filterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#A67C2E',
  },

  menuText: {
    fontSize: 14,
    color: '#333',
  },


  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  filterMenu: {
    position: 'absolute',
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  menuItemActive: {
    backgroundColor: '#eaf3ff',
  },
});

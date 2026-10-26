import { StyleSheet } from 'react-native';
 
 export const DashboardWorkingSummaryStyle = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  content: {
    padding: 16,
  },
 
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  smallCard: {
    width: '32%',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9D2C3',
  },
  statusCard: {
    width: '48%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D9D2C3',
  },
  cardValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: 'black',
  },
  cardLabel: {
    fontSize: 13,
    color: 'black',
  },
  statusTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // For RN 0.73+; replace with marginRight if lower
    marginBottom: 4,
  },
  statusNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },
 
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 10,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderColor: '#C9A24D',
    borderWidth: 1,
    backgroundColor: '#F1EADB',
  },
  activeTabButton: {
    backgroundColor: '#1B4FB5',
  },
  tabText: {
    fontSize: 13,
    color: '#000',
  },
  activeTabText: {
    color: '#FFF',
    fontWeight: '600',
  },
 
  listContainer: {
    borderWidth: 1,
    borderColor: '#D9D2C3',
    borderRadius: 10,
    padding: 12,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#FFF',
    padding: 12,
    marginBottom: 6,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderColor: '#D9D2C3',
  },
  storeRank: {
    fontWeight: 'bold',
    width: 24,
  },
  storeName: {
    marginLeft: 10,
    fontSize: 14,
    color: '#000',
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3FFE9',
    height: 20,
    marginLeft: 10,
    width: 35,
    borderRadius: 30,
  },
  changeText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 2,
    color: '#000',
  },
});
 
export default DashboardWorkingSummaryStyle;
 
 
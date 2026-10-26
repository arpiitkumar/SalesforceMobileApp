import { StyleSheet } from 'react-native';
 
export const getDashboardSPStyle = ()  => StyleSheet.create({
  safe: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: 'white',
  },
  container: {
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderColor: '#D9D2C3',
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    width: '31%',
    minHeight: 80,
  },
  cardLarge: {
    width: '100%',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  valueMain: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  valueSuffix: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginLeft: 4,
  },
  trendArrow: {
    marginLeft: 6,
    marginTop: 2,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#555',
  },
  labelText: {
    fontSize: 18,
    color: '#000',
    fontWeight: '800',
  },
  subtitleText: {
    fontSize: 12,
    color: '#666',
  },
  icon: {
    width: 36,
    height: 36,
    marginLeft: 6,
  },
});
 
 
 
 
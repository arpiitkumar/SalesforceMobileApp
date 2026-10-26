import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  Image,
  ImageSourcePropType,
} from 'react-native';

import DownArrow from '../../assets/images/arrowDown.svg';
import UpArrow from '../../assets/images/arrowUp.svg';
import { getDashboardSPStyle } from '../../assets/css/DashboardSP.js';

const styles = getDashboardSPStyle(); // Call once globally

interface Metric {
  key: string;
  title: string;
  value: string;
  suffix?: string;
  subtitle?: string;
  labels?: string;
  icon?: ImageSourcePropType;
  trend?: number;
  large?: boolean;
  customWidth?: string;
}

const metrics: Metric[] = [
  {
    key: '1',
    title: 'Food',
    value: '13.2K',
    suffix: '/21.6K',
    labels: 'Food',
    subtitle: '(In Thousands)',
    icon: require('../../assets/images/food.png'),
    large: true,
  },
  {
    key: '2',
    title: 'Oil',
    value: '112L',
    suffix: '/220L',
    labels: 'Oil',
    subtitle: '(In Liters)',
    icon: require('../../assets/images/oil.png'),
    large: true,
  },
  { key: '3', title: 'TLS', value: '22', trend: -1, subtitle: 'TLS (Total Lines Sold)', customWidth: '48%' },
  { key: '4', title: 'UTLS', value: '22', trend: 1, subtitle: 'UTLS (Unique Total Lines Sold)', customWidth: '48%' },
  { key: '5', title: 'MBO', value: '30/78', trend: -1, subtitle: 'MBO' },
  { key: '6', title: '2 Cat MBO', value: '26/21', trend: 1, subtitle: '2 Cat MBO' },
  { key: '7', title: '3 Cat MBO', value: '3/11', trend: -1, subtitle: '3 Cat MBO' },
  { key: '8', title: 'Bill Cuts', value: '11', trend: -1, subtitle: 'Bill Cuts' },
  { key: '9', title: 'A‑Stores', value: '11/19', trend: 1, subtitle: 'A‑Stores' },
  { key: '10', title: 'Wholesale', value: '32/40', trend: 1, subtitle: 'Wholesale' },
];

type MetricCardProps = Metric;

const MetricCard: React.FC<MetricCardProps> = ({
  value,
  suffix = '',
  subtitle,
  labels,
  icon,
  trend,
  large,
  customWidth,
}) => {
  const hasTrend = typeof trend === 'number';
  const isUp = (trend ?? 0) > 0;
  const isGreenSpecialValue = value === '26/21';

  return (
    <View
      style={[
        styles.card,
        large && styles.cardLarge,
        customWidth ? { width: customWidth } : {},
      ]}
    >
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.valueRow}>
            <Text
              style={[
                styles.valueMain,
                isGreenSpecialValue && { color: '#239D3E' },
              ]}
            >
              {value}
            </Text>
            {suffix ? (
              <Text style={styles.valueSuffix}>{suffix}</Text>
            ) : null}
            {hasTrend && (
              <View style={styles.trendArrow}>
                {isUp ? (
                  <UpArrow width={12} height={12} />
                ) : (
                  <DownArrow width={12} height={12} />
                )}
              </View>
            )}
          </View>

          {(labels || subtitle) && (
            <Text style={styles.subtitle}>
              {labels && <Text style={styles.labelText}>{labels} </Text>}
              {subtitle && <Text style={styles.subtitleText}>{subtitle}</Text>}
            </Text>
          )}
        </View>

        {icon && (
          <Image source={icon} style={styles.icon} resizeMode="contain" />
        )}
      </View>
    </View>
  );
};

const Dashboard: React.FC = () => (
  <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      {metrics.map((m) => (
        <MetricCard key={m.key} {...m} />
      ))}
    </ScrollView>
  </SafeAreaView>
);

export default Dashboard;


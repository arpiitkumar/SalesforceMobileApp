import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Ionicons from "../../components/Ionicons";

const { width } = Dimensions.get('window');
const primaryColor = '#C9A24D'; // change this to match your app theme

const topThree = [
  {
    id: '1',
    name: 'Jane Smith',
    avatar: 'https://i.pravatar.cc/300?img=32',
    points: 1280,
  },
  {
    id: '2',
    name: 'Sam Black',
    avatar: 'https://i.pravatar.cc/300?img=12',
    points: 1024,
  },
  {
    id: '3',
    name: 'Jessica Cher',
    avatar: 'https://i.pravatar.cc/300?img=47',
    points: 980,
  },
];

const others = [
  { id: '4', name: 'Darlene Robertson', avatar: 'https://i.pravatar.cc/300?img=5', rank: 4, change: +1 },
  { id: '5', name: 'Theresa Webb', avatar: 'https://i.pravatar.cc/300?img=6', rank: 5, change: -1 },
  { id: '6', name: 'Floyd Miles', avatar: 'https://i.pravatar.cc/300?img=7', rank: 6, change: +1 },
  { id: '7', name: 'Annette Black', avatar: 'https://i.pravatar.cc/300?img=8', rank: 7, change: 0 },
  { id: '8', name: 'Marvin McKinney', avatar: 'https://i.pravatar.cc/300?img=9', rank: 8, change: +2 },
];

export default function Leaderboard({ style }) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Leaderboardssss</Text>
        <TouchableOpacity style={styles.infoBtn} activeOpacity={0.7}>
          <Ionicons name="information-circle-outline" size={20} color="#444" />
        </TouchableOpacity>
      </View>

      <View style={styles.podiumArea}>
        <View style={styles.sidePodium}>
          <View style={[styles.avatarWrap, styles.second]}> 
            <Image source={{ uri: topThree[1].avatar }} style={styles.avatarSmall} />
            <View style={styles.medalSmall}>
              <Text style={styles.medalText}>2</Text>
            </View>
          </View>
          <Text style={styles.pName}>{topThree[1].name.split(' ')[0]}</Text>
        </View>

        <View style={styles.centerPodium}>
          <View style={styles.avatarWrapCenter}>
            <Image source={{ uri: topThree[0].avatar }} style={styles.avatarLarge} />
            <View style={styles.crownWrap}>
              <Text style={styles.crown}>👑</Text>
            </View>
            <View style={styles.medalCenter}>
              <Text style={styles.medalTextCenter}>1</Text>
            </View>
          </View>
          <Text style={[styles.pName, { fontWeight: '700' }]}>{topThree[0].name.split(' ')[0]}</Text>
        </View>

        <View style={styles.sidePodium}>
          <View style={[styles.avatarWrap, styles.third]}> 
            <Image source={{ uri: topThree[2].avatar }} style={styles.avatarSmall} />
            <View style={styles.medalSmall}>
              <Text style={styles.medalText}>3</Text>
            </View>
          </View>
          <Text style={styles.pName}>{topThree[2].name.split(' ')[0]}</Text>
        </View>
      </View>

      <View style={styles.rankPill}>
        <Text style={styles.rankPillText}>You Currently Rank</Text>
        <View style={styles.rankNumberWrap}>
          <Text style={styles.rankNumber}>239</Text>
          <Ionicons name="chevron-up" size={18} color="#fff" />
        </View>
      </View>

      <FlatList
        data={others}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Image source={{ uri: item.avatar }} style={styles.rowAvatar} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub}>{item.points ? `${item.points} pts` : 'Member'}</Text>
              </View>
            </View>

            <View style={styles.rowRight}>
              <Text style={styles.rankText}>#{item.rank}</Text>
              <View style={[styles.changeBadge, item.change > 0 ? styles.up : item.change < 0 ? styles.down : styles.neutral]}>
                <Ionicons name={item.change > 0 ? 'arrow-up' : item.change < 0 ? 'arrow-down' : 'remove'} size={12} color="#fff" />
                <Text style={styles.changeText}>{item.change > 0 ? ` ${item.change}` : item.change < 0 ? ` ${Math.abs(item.change)}` : ''}</Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
  },
  infoBtn: {
    padding: 6,
    borderRadius: 8,
  },
  podiumArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginVertical: 18,
    paddingHorizontal: 10,
  },
  sidePodium: {
    width: (width - 36) / 3 - 10,
    alignItems: 'center',
  },
  centerPodium: {
    width: (width - 36) / 3 + 20,
    alignItems: 'center',
  },
  avatarWrap: {
    backgroundColor: '#fff',
    borderRadius: 999,
    padding: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  avatarWrapCenter: {
    backgroundColor: '#fff',
    borderRadius: 999,
    padding: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLarge: {
    width: 110,
    height: 110,
    borderRadius: 110,
  },
  avatarSmall: {
    width: 72,
    height: 72,
    borderRadius: 72,
  },
  crownWrap: {
    position: 'absolute',
    top: -12,
    right: -6,
    backgroundColor: 'transparent',
  },
  crown: {
    fontSize: 22,
  },
  medalSmall: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    backgroundColor: primaryColor,
    width: 28,
    height: 28,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  medalText: {
    color: '#fff',
    fontWeight: '700',
  },
  medalCenter: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    backgroundColor: primaryColor,
    width: 36,
    height: 36,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  medalTextCenter: {
    color: '#fff',
    fontWeight: '800',
  },
  pName: {
    marginTop: 8,
    fontSize: 14,
    color: '#222',
  },

  rankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f6fb',
    borderRadius: 24,
    padding: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  rankPillText: {
    color: '#556',
    fontWeight: '600',
  },
  rankNumberWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: primaryColor,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  rankNumber: {
    color: '#fff',
    fontWeight: '700',
    marginRight: 6,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomColor: '#F1EADB',
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowAvatar: {
    width: 44,
    height: 44,
    borderRadius: 44,
  },
  name: {
    fontSize: 16,
    color: '#222',
    fontWeight: '600',
  },
  sub: {
    fontSize: 12,
    color: '#888',
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  rankText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '700',
  },
  changeBadge: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  up: { backgroundColor: '#27ae60' },
  down: { backgroundColor: '#e74c3c' },
  neutral: { backgroundColor: '#95a5a6' },
});

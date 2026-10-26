import React, { FC } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { RFValue } from "react-native-responsive-fontsize";

const { width } = Dimensions.get("window");

const EngagementScreen: FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaProvider style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={["#C9A24D", "#A67C2E"]}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Engagement</Text>
            <Text style={styles.headerSubtitle}>Team Performance & Surveys</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Engagement Container */}
        <View style={styles.engagementContainer}>
          <View style={styles.containerHeaderRow}>
            <LinearGradient
              colors={["#C9A24D", "#A67C2E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientBar}
            />
            <View style={{ flex: 1, paddingLeft: 8 }}>
              <Text style={styles.containerTitle}>Engagement Modules</Text>
              <Text style={styles.containerSubtitle}>
                Select a module to view team performance reports
              </Text>
            </View>
          </View>

          {/* Survey Summary Card */}
          <TouchableOpacity
            style={styles.moduleCard}
            activeOpacity={0.75}
            onPress={() => navigation.navigate("SurveySummary")}
          >
            <View style={styles.cardLeft}>
              <View style={[styles.iconWrap, { backgroundColor: "#E0F2FE" }]}>
                <MaterialCommunityIcons
                  name="clipboard-text-search-outline"
                  size={26}
                  color="#3B5BB5"
                />
              </View>
              <View style={styles.cardTextWrap}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.cardTitle}>Survey Summary</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Active</Text>
                  </View>
                </View>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  Role-based hierarchy report for submitted vs pending surveys
                </Text>
              </View>
            </View>
            <View style={styles.arrowWrap}>
              <Ionicons name="chevron-forward" size={20} color="#3B5BB5" />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF8F1",
  },
  header: {
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: "#fff",
    fontSize: RFValue(16),
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 11,
    fontWeight: "500",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  engagementContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1EADB",
    shadowColor: "rgba(26, 29, 46, 0.08)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
    position: "relative",
    overflow: "hidden",
  },
  containerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    position: "relative",
  },
  gradientBar: {
    position: "absolute",
    left: -16,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  containerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F1D1A",
  },
  containerSubtitle: {
    fontSize: 11.5,
    color: "#7A7266",
    marginTop: 2,
  },
  moduleCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#BAE6FD",
    shadowColor: "#3B5BB5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  badge: {
    backgroundColor: "#E3F1EA",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E7D5B",
  },
  cardDesc: {
    fontSize: 11.5,
    color: "#7A7266",
    marginTop: 3,
    lineHeight: 16,
  },
  arrowWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F9FF",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default EngagementScreen;

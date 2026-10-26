import React, { useState } from "react";
import axios from "axios";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Colors } from "../theme";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import { getCurrentLocation } from "../utils/getCurrentLocation";
import { useDispatch } from "react-redux";
import { showToast } from "../redux/slices/toastSlice";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371; // Radius of the earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

export default function NearbyRetailerSearch() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  const [retailerName, setRetailerName] = useState("");
  const [distanceKm, setDistanceKm] = useState("5");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!retailerName.trim() || !distanceKm.trim()) {
      dispatch(
        showToast({
          message: "Please enter both Retailer Name and Distance Limit.",
          type: "error",
        })
      );
      return;
    }

    const parsedDist = parseFloat(distanceKm);
    if (!/^\d+(\.\d+)?$/.test(distanceKm.trim()) || isNaN(parsedDist) || parsedDist <= 0) {
      dispatch(
        showToast({
          message: "Please enter a valid positive number for Distance Limit.",
          type: "error",
        })
      );
      return;
    }

    if (parsedDist > 50) {
      dispatch(
        showToast({
          message: "Distance Limit cannot exceed 50 KM.",
          type: "error",
        })
      );
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      // 1. Get current user location
      let coords: { latitude: number; longitude: number } | null = null;
      try {
        const locationRes: any = await getCurrentLocation();
        coords = {
          latitude: locationRes.latitude,
          longitude: locationRes.longitude,
        };
      } catch (err) {
        console.warn("Location error:", err);
        dispatch(
          showToast({
            message: "Unable to retrieve your current location. Please check your GPS settings.",
            type: "error",
          })
        );
        setLoading(false);
        return;
      }

      if (!coords || !coords.latitude || !coords.longitude) {
        dispatch(
          showToast({
            message: "GPS Coordinates not found.",
            type: "error",
          })
        );
        setLoading(false);
        return;
      }

      // 2. Fetch from Google Places Nearby Search API
      const GOOGLE_API_KEY = 'REDACTED_SECRET';
      const limitDistKm = parseFloat(distanceKm) || 5;
      const radiusMeters = Math.round(limitDistKm * 1000);

      let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coords.latitude},${coords.longitude}&radius=${radiusMeters}&type=liquor_store&key=${GOOGLE_API_KEY}`;
      if (retailerName.trim()) {
        url += `&keyword=${encodeURIComponent(retailerName)}`;
      }

      console.log("Calling Google Places API:", url);
      const response = await axios.get(url);
      
      if (response.data?.status === 'OK' || response.data?.status === 'ZERO_RESULTS') {
        const places = response.data.results || [];
        const mapped = places.map((item: any) => {
          const lat = item.geometry?.location?.lat;
          const lng = item.geometry?.location?.lng;
          const dist = calculateDistance(coords!.latitude, coords!.longitude, lat, lng);
          return {
            id: item.place_id,
            Name: item.name,
            BillingAddress: item.vicinity || "",
            Phone: "",
            distance: dist,
            latitude: lat,
            longitude: lng,
          };
        }).sort((a: any, b: any) => a.distance - b.distance);

        setResults(mapped);
      } else {
        console.warn("Google Places status warning:", response.data?.status, response.data?.error_message);
        dispatch(
          showToast({
            message: response.data?.error_message || "Places API search failed.",
            type: "error",
          })
        );
        setResults([]);
      }
    } catch (error: any) {
      console.error("Error searching nearby retailers:", error);
      dispatch(
        showToast({
          message: error.message || "An error occurred during search.",
          type: "error",
        })
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
      
      {/* Header */}
      <LinearGradient
        colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top || 16 }]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nearby Retailers Search</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Search Box Inputs */}
        <View style={styles.searchCard}>
          <Text style={styles.inputLabel}>RETAILER NAME</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter Retailer name..."
            placeholderTextColor="#999"
            value={retailerName}
            onChangeText={setRetailerName}
          />

          <Text style={[styles.inputLabel, { marginTop: 12 }]}>DISTANCE LIMIT (KM)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter Distance in KM..."
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={distanceKm}
            maxLength={3}
            onChangeText={(text) => {
              const sanitized = text.replace(/[^0-9.]/g, "").slice(0, 3);
              const parts = sanitized.split(".");
              if (parts.length > 2) {
                setDistanceKm(parts[0] + "." + parts.slice(1).join(""));
              } else {
                setDistanceKm(sanitized);
              }
            }}
          />

          {(!retailerName.trim() || !distanceKm.trim()) && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color="#B3261E" style={{ marginRight: 6 }} />
              <Text style={styles.infoText}>
                Please enter both Retailer Name and Distance Limit to search.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.searchBtn, (!retailerName.trim() || !distanceKm.trim()) && { opacity: 0.6 }]}
            onPress={handleSearch}
            disabled={loading || !retailerName.trim() || !distanceKm.trim()}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="search" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.searchBtnText}>Search</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Results List */}
        {searched && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsHeader}>
              Search Results ({results.length} found)
            </Text>

            {results.map((item) => (
              <TouchableOpacity
                key={item.id || item.Sf_Id}
                style={styles.resultCard}
                onPress={() => {
                  navigation.navigate("AccountAddForm", {
                    prefilled: {
                      name: item.Name,
                      latitude: item.latitude,
                      longitude: item.longitude,
                      address: item.BillingAddress,
                    },
                  });
                }}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.resultName}>{item.Name}</Text>
                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceText}>
                      {item.distance.toFixed(2)} KM
                    </Text>
                  </View>
                </View>

                {item.BillingAddress ? (
                  <View style={styles.cardDetailRow}>
                    <Ionicons name="location-outline" size={14} color="#666" style={{ marginRight: 4 }} />
                    <Text style={styles.cardDetailText}>{item.BillingAddress}</Text>
                  </View>
                ) : null}

                {item.Phone ? (
                  <View style={styles.cardDetailRow}>
                    <Ionicons name="call-outline" size={14} color="#666" style={{ marginRight: 4 }} />
                    <Text style={styles.cardDetailText}>{item.Phone}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}

            {results.length === 0 && !loading && (
              <View style={styles.emptyState}>
                <Ionicons name="alert-circle-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No nearby retailers found within this distance.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Create Button (Always Visible) */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.navigate("AccountAddForm", { prefilled: null })}
        >
          <LinearGradient
            colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createBtnInner}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.createBtnText}>Create New Retailer</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    paddingHorizontal: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  searchCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#666",
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#D9D2C3",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    color: "#000",
    fontSize: 14,
    backgroundColor: "#FAFBFD",
  },
  searchBtn: {
    backgroundColor: "#A67C2E",
    borderRadius: 8,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    flexDirection: "row",
  },
  searchBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  resultsContainer: {
    marginTop: 10,
  },
  resultsHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  resultCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F1EADB",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  resultName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    flex: 1,
    marginRight: 8,
  },
  distanceBadge: {
    backgroundColor: "#E3F1EA",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  distanceText: {
    color: "#2E7D5B",
    fontSize: 11,
    fontWeight: "700",
  },
  cardDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  cardDetailText: {
    fontSize: 12,
    color: "#666",
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    color: "#888",
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1EADB",
  },
  createBtn: {
    borderRadius: 8,
    overflow: "hidden",
  },
  createBtnInner: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  createBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9E5E3",
    padding: 10,
    borderRadius: 8,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#FFCDD2",
  },
  infoText: {
    color: "#B3261E",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
});

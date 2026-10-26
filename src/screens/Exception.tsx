// ExceptionsScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import ExceptionDetailsModal from "../components/modal/ExceptionDetails";
import CompetitorStockModal from "../components/modal/CreateException";
import HeaderMain from '../components/HeaderMain';
import LinearGradient from "react-native-linear-gradient";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { getSanitizedPhotoUrl } from '../utils/getSanitizedPhotoUrl';

const { width } = Dimensions.get("window");

export default function ExceptionsScreen() {
  const [activeTab, setActiveTab] = useState("Product");
  const [users, setUsers] = useState([]);
  const [selectedException, setSelectedException] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [compModalVisible, setCompModalVisible] = useState(false);
  const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
  const [productMap, setProductMap] = useState({}); // { Sf_Id: Name }
  // store fetched exceptions
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const selectedAccount = useSelector(state => state.selectedAccount?.selectedAccount);


  const handleCardPress = (item) => {
    setSelectedException(item);
    setModalVisible(true);
  };


  // replace existing resolveImageUri with this improved version
  const isLikelyBase64 = (s) => {
    // base64 contains only A-Z a-z 0-9 + / = and may contain newlines
    // require at least ~100 chars to avoid false positives for short strings
    return typeof s === "string" && s.length > 100 && /^[A-Za-z0-9+/=\r\n]+$/.test(s);
  };

  const resolveImageUri = (rec) => {
    const raw = rec?.Image__c ?? rec?.ImageUrl__c ?? rec?.ImageBase64__c ?? rec?.ImageUri__c ?? null;
    if (!raw) return null;

    // If it's already a http/https URL — return as-is
    if (typeof raw === "string" && (raw.startsWith("http://") || raw.startsWith("https://"))) {
      let sanitizedUrl = getSanitizedPhotoUrl(raw);
      return sanitizedUrl;
    }

    // If it's already a data: URI, return as-is
    if (typeof raw === "string" && raw.startsWith("data:")) {
      return raw;
    }

    // If it looks like base64 content (only base64 chars) -> prepend data: URI
    if (isLikelyBase64(raw)) {
      return `data:image/jpeg;base64,${raw}`;
    }

    // file/content URIs (android/local)
    if (typeof raw === "string" && (raw.startsWith("file://") || raw.startsWith("content://"))) {
      return raw;
    }

    // otherwise we don't know — return null
    return null;
  };

  const loadExceptions = useCallback(async () => {
    try {
      setLoading(true);


      const prods = await UniversalUpdateInsert({
        ObjectName: 'Product2',
        Type: 'get',
      });

      const map = {};
      if (Array.isArray(prods)) {
        prods.forEach(p => {
          // adjust field names if different; we expect p.Sf_Id and p.Name
          if (p?.Sf_Id) map[p.Sf_Id] = p.Name || p.Name__c || null;
        });
      }
      setProductMap(map);
      // NOTE: change ObjectName to the exact object name you store exceptions in (MT_Exception__c used earlier)
      const res = await UniversalUpdateInsert({
        ObjectName: 'MT_Exception__c',
        Type: 'get',
        filters: [
          { field: 'Retailer__c', value: selectedVisit?.AccountId },
        ],
      });


      // res is expected to be an array of records
      if (!Array.isArray(res)) {
        setExceptions([]);
        setLoading(false);
        return;
      }

      // Normalize fields and store - keep original record in 'raw'
      const normalized = res.map((r) => ({
        id: r.Sf_Id || r.id || r.Sf_Id__c || r._id || String(Math.random()),
        Sf_Id: r.Sf_Id || r.Sf_Id__c || null,
        Name: r.Name || r.Name || null,
        ExceptionDate__c: r.ExceptionDate__c || r.ExceptionDate || null,
        Category__c: r.Category__c || r.category || null,
        Product__c: r.Product__c || r.Product || null,
        ProductLabel: r.Product__c ? (map[r.Product__c] || r.Product__c) : null,
        IssueType__c: r.IssueType__c || r.IssueType || null,
        Location__c: r.Location__c || r.Location || null,
        Remarks__c: r.Remarks__c || r.Remarks || r.remark || null,
        Status__c: r.Status__c || r.Status || null,
        Image__c: r.Image__c || r.ImageUrl__c || r.ImageBase64__c || r.ImageUri__c || null,
        raw: r,
      }));

      // sort by date if you want (newest first) — guard for null
      normalized.sort((a, b) => {
        const da = a.ExceptionDate__c ? new Date(a.ExceptionDate__c).getTime() : 0;
        const db = b.ExceptionDate__c ? new Date(b.ExceptionDate__c).getTime() : 0;
        return db - da;
      });
      console.log("Loaded exceptions:", normalized);

      setExceptions(normalized);
    } catch (err) {
      console.error("Failed to load exceptions:", err);
      setExceptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const loggedInUser = await UniversalUpdateInsert({
        ObjectName: "User",
        Type: "get",
      });

      const devName = loggedInUser?.[0]?.DeveloperName || "";
      setUsers(loggedInUser || []);
    } catch (err) {
      console.error("Failed to load user data:", err);
    }
  }, []);


  useEffect(() => {
    loadExceptions();
    loadUser()
  }, [loadExceptions]);

  // Refresh when competitor modal closes or after a submit: we'll provide onSubmit that triggers refresh.
  // We'll pass loadExceptions into modal via onSubmit handler below.

  // Split lists by whether Product__c exists (product list) or Category__c exists (store list)
  const productList = exceptions.filter((ex) => ex.Product__c && ex.Product__c !== "");
  const storeList = exceptions.filter((ex) => (!ex.Product__c || ex.Product__c === "") && (ex.Category__c && ex.Category__c !== ""));

  // Render each row: use Image with proper uri handling
  const renderItem = ({ item }) => {
    const imgUri = resolveImageUri(item);
    // For display title: Product (when activeTab Product) or Category (when store)
    const rightLabel = activeTab === "Product"
      ? (item.ProductLabel || item.Product__c || "")
      : (item.Category__c || ""); return (
        <TouchableOpacity style={styles.card} onPress={() => handleCardPress(item)}>
          <View style={{ flexDirection: "row", width: "100%" }}>
            {imgUri ? (
              <Image
                source={{ uri: imgUri }}
                style={styles.thumb}
                resizeMode="cover"
                onLoad={() => console.log("Image loaded OK for", item.Sf_Id, imgUri)}
                onError={(e) => {
                  //console.warn("Image load error for", item.Sf_Id, "uri=", imgUri, "error=", e.nativeEvent?.error || e);
                }}
              />
            ) : (
              <View style={[styles.thumb, { backgroundColor: "#F1EADB", justifyContent: "center", alignItems: "center" }]}>
                <Text style={{ fontSize: 10, color: "#888" }}>No image</Text>
              </View>
            )}

            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={styles.rowBetween}>
                <Text
                  style={[styles.code, { maxWidth: 150 }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item?.Name || "Not Available"}
                </Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{item.Status__c || "Unknown"}</Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={styles.field}>
                  <Text style={styles.label}>Date</Text>
                  <Text style={styles.value}>
                    {item.ExceptionDate__c ? (new Date(item.ExceptionDate__c)).toLocaleDateString() : "-"}
                  </Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{activeTab === "Product" ? "Product" : "Category"}</Text>
                  <Text style={[styles.value, { maxWidth: 130 }]} numberOfLines={1} ellipsizeMode="tail">{rightLabel || "-"}</Text>
                </View>


              </View>
            </View>
          </View>

          <View style={{ flexDirection: "row", justifyContent: 'space-between' }}>
            <View style={styles.field}>
              <Text style={styles.label}>Location</Text>
              <Text style={styles.value}>{item.Location__c || "-"}</Text>
            </View>

            <View style={[styles.field]}>
              <Text style={styles.label}>Remark</Text>
              <Text style={styles.value}>{item.Remarks__c || "-"}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Issue Type</Text>
              <Text style={styles.value}>{item.IssueType__c || "-"}</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
  };

  // Which data to render depending on active tab
  const dataToRender = activeTab === "Product" ? productList : storeList;

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
      <View style={styles.headerContainer}>
        <HeaderMain screenName="Exception" />
      </View>

      <View style={{ padding: 7, backgroundColor: "white", borderTopRightRadius: 20, borderTopLeftRadius: 20, flex: 1 }}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "Product" && styles.activeTab]}
            onPress={() => setActiveTab("Product")}
          >
            <Text style={[styles.tabText, activeTab === "Product" && styles.activeTabText]}>Product</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "Store" && styles.activeTab]}
            onPress={() => setActiveTab("Store")}
          >
            <Text style={[styles.tabText, activeTab === "Store" && styles.activeTabText]}>Store</Text>
          </TouchableOpacity>
        </View>

        {users[0]?.DeveloperName !== "MT_SO" && (

          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => setCompModalVisible(true)}
          >
            <Text style={styles.createText}>+ Create Exception</Text>
          </TouchableOpacity>


        )}


        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 40 }}>
            <ActivityIndicator size="large" color="#C9A24D" />
            <Text style={{ marginTop: 8, color: "#666" }}>Loading exceptions...</Text>
          </View>
        ) : (
          <FlatList
            data={dataToRender}
            keyExtractor={(i) => (i.Sf_Id || i.id || i._id || Math.random()).toString()}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={() => (
              <View style={{ padding: 20 }}>
                <Text style={{ color: "#666", textAlign: "center" }}>
                  No exceptions to show in "{activeTab}".
                </Text>
              </View>
            )}
          />
        )}

        {/* Exception Details Modal */}
        {selectedException && (
          <ExceptionDetailsModal
            visible={modalVisible}
            onClose={() => {
              setModalVisible(false)
              loadExceptions();
            }}
            exception={selectedException}
          />
        )}

        {/* Competitor Stock Modal */}
        <CompetitorStockModal
          visible={compModalVisible}
          onClose={() => {
            setCompModalVisible(false);
            loadExceptions();
          }}
          productTitle="Balaji Crunchex Tadka Wafers"
          activeTab={activeTab}
          heightPercent={0.6}
          onSubmit={async (payload) => {
            console.log("Competitor submitted:", payload);
            setTimeout(() => {
              loadExceptions();
            }, 300);
            setCompModalVisible(false);
          }}
        />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#A67C2E' },
  headerContainer: { backgroundColor: '#A67C2E' },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "white",
    margin: 12,
    borderRadius: 8,
    justifyContent: "space-between",
  },
  tab: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    width: "48%",
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  tabText: { fontSize: 14, fontWeight: "500", color: "#444" },
  activeTab: {
    backgroundColor: "#eaf1ff",
    borderWidth: 1,
    borderColor: "#C9A24D",
  },
  activeTabText: { color: "#2b6cb0", fontWeight: "700" },

  createBtn: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  createText: { color: "#2b6cb0", fontWeight: "600", fontSize: 14 },

  field: { marginBottom: 6 },
  label: { fontSize: 11, color: "#777", marginBottom: 2 },
  value: { fontSize: 13, fontWeight: "500", color: "#222" },

  card: {
    backgroundColor: "#ffffffff",
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  thumb: { width: 60, height: 60, borderRadius: 8, resizeMode: 'contain' },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  code: { fontSize: 14, fontWeight: "600", color: "#222" },
  statusBadge: {
    backgroundColor: "#e6f9ef",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 12, fontWeight: "600", color: "#2dbf6d" },

});
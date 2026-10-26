import React, { useMemo, useState, useCallback, memo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Pressable,
  Dimensions,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  TextInput,
} from "react-native";
import Ionicons from "../Ionicons";
 
const { width, height } = Dimensions.get("window");
 
// enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
 
function configureLayoutAnimation() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}
 
/* ---------- SchemeCard (pure, with Min formatting) ---------- */
const SchemeCard = memo(
  function SchemeCard({ scheme, open, onToggle }) {
    const categories = scheme.categories || [];
 
    // helper: format min display based on buyType
    function formatMin(slab) {
      const buyType = (slab.buyType || "").toString().toLowerCase();
      // slab.minQty or slab.minBuy or fallback to slab.min
      let min = slab.minQty ?? slab.minBuy ?? slab.min ?? null;
      if (min == null) return "-";
 
      // normalize string numbers that may contain commas
      if (typeof min === "string") {
        const cleaned = min.replace(/,/g, "").trim();
        const parsed = Number(cleaned);
        if (!Number.isNaN(parsed)) min = parsed;
      }
 
      // treat anything containing 'val' as Value (currency)
      if (buyType.includes("val")) {
        const n = Number(min);
        if (Number.isNaN(n)) return `${min}`;
        // use en-IN thousands grouping for rupee-like formatting
        try {
          return `₹ ${n.toLocaleString("en-IN")}`;
        } catch (e) {
          // fallback
          return `₹ ${n}`;
        }
      }
 
      // treat anything containing 'vol' or 'voul' as Volume/Qty
      if (buyType.includes("vol") || buyType.includes("voul") || buyType.includes("qty") || buyType.includes("quantity")) {
        const uom = slab.buyUOM || slab.focUom || "qty";
        return `${min} ${uom}`;
      }
 
      // fallback: show raw min with uom if present
      const uom = slab.buyUOM || slab.focUom || "";
      return uom ? `${min} ${uom}` : `${min}`;
    }
 
    return (
      <View style={styles.schemeCard}>
        {/* Make the top area tappable to toggle expand */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            configureLayoutAnimation();
            onToggle(scheme.id);
          }}
          style={styles.schemeTop}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.schemeName} numberOfLines={2}>
              {scheme.name}
            </Text>
 
            <View style={styles.metaRow}>
              {categories.map((c, i) => (
                <View key={`cat-${i}`} style={[styles.metaPill, styles.categoryPill]}>
                  <Text style={[styles.metaText, styles.categoryText]} numberOfLines={1}>
                    {c}
                  </Text>
                </View>
              ))}
 
              {scheme.tag && (
                <View style={[styles.metaPill, styles.greenPill]}>
                  <Text style={styles.greenText}>{scheme.tag}</Text>
                </View>
              )}
 
              {typeof scheme.rewardDiscountPercentage === "number" && (
                <View style={styles.metaPill}>
                  <Text style={styles.metaText}>Reward: {scheme.rewardDiscountPercentage}%</Text>
                </View>
              )}
            </View>
          </View>
 
          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => {
              configureLayoutAnimation();
              onToggle(scheme.id);
            }}
          >
            <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color="#444" />
          </TouchableOpacity>
        </TouchableOpacity>
 
        {/* Show slabs inside the card when expanded */}
        {open && (
          <View style={styles.expandArea}>
            <Text style={styles.slabMeta}>{scheme.slabs.length} slab(s)</Text>
 
            {scheme.slabs.map((slab, idx) => (
              <View key={slab.slabId ?? idx} style={styles.slabCard}>
                <View style={styles.slabHeader}>
                  <Text style={styles.phaseText}>Phase: {slab.phase ?? "-"}</Text>
                  <Text style={styles.discountText}>{slab.buyType ?? "-"}</Text>
                </View>
 
                <Text style={styles.slabMeta}>
                  Buy Type: {slab.buyType ?? "-"} {slab.buyUOM ? `(${slab.buyUOM})` : ""}
                </Text>
 
                {/* Conditionally formatted Min */}
                <Text style={styles.slabMeta}>Min: {formatMin(slab)}</Text>
 
                {/* Optional: show free product or reward details */}
                {slab.rewardType ? (
                  <Text style={styles.slabMeta}>
                    Reward: {slab.rewardType}{" "}
                    {slab.rewardDiscountValue ? `· ${slab.rewardDiscountValue}` : slab.rewardDiscountPercentage ? `· ${slab.rewardDiscountPercentage}%` : ""}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  },
  // comparator: rely on stable ids rather than whole object identity
  (prev, next) => prev.open === next.open && prev.scheme?.id === next.scheme?.id
);
 
/* ---------- Modal (main schemes only) ---------- */
export default function SchemeModal({
  visible,
  onClose,
  schemeResponse,
  loading = false,
}) {
  const [expanded, setExpanded] = useState({});
  const [filterText, setFilterText] = useState("");
 
  const toggleExpand = useCallback((id) => {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  }, []);
 
  // normalize input -> productsWithSchemes array
  const productsWithSchemes = useMemo(() => {
    if (!schemeResponse) return [];
    if (Array.isArray(schemeResponse?.productsWithSchemes)) return schemeResponse.productsWithSchemes;
    if (Array.isArray(schemeResponse)) return schemeResponse;
    return [];
  }, [schemeResponse]);
 
  // Build schemes grouped by schemeId (main schemes only). Deduplicate slabs by slabId.
  const schemes = useMemo(() => {
    const map = {};
 
    productsWithSchemes.forEach((p) => {
      (p.schemeWrappers || []).forEach((sw) => {
        if (!sw?.schemeId) return;
 
        const id = sw.schemeId;
        if (!map[id]) {
          map[id] = {
            id,
            name: sw.schemeName || "Scheme",
            min: sw.minBuy ?? null,
            tag: sw.rewardType || null,
            rewardValue: sw.rewardValue ?? null,
            rewardDiscountPercentage: sw.rewardDiscountPercentage ?? null,
            totalDiscount: 0,
            slabs: [], // will convert from map to array
            _slabIds: new Set(), // internal dedupe
            _categories: new Set(),
          };
        }
 
        // accumulate totalDiscount (optional)
        const discount = Number(sw.rewardDiscountValue ?? sw.rewardDiscountPercentage ?? 0);
        map[id].totalDiscount += discount;
 
        // add category if present
        if (sw.productCategory) map[id]._categories.add(sw.productCategory);
 
        // build slab id (dedupe)
        const slabId = sw.schemeSlabId ?? `${id}-${sw.phaseNumber ?? "0"}-${sw.minBuy ?? ""}`;
        if (!map[id]._slabIds.has(slabId)) {
          map[id]._slabIds.add(slabId);
          map[id].slabs.push({
            slabId,
            phase: sw.phaseNumber ?? null,
            buyType: sw.buyType ?? null,
            buyUOM: sw.buyUOM ?? null,
            minQty: sw.minBuy ?? null,
            rewardType: sw.rewardType ?? null,
            rewardDiscountValue: sw.rewardDiscountValue ?? null,
            rewardDiscountPercentage: sw.rewardDiscountPercentage ?? null,
            productName: sw.productName ?? null,
            focUom: sw.focUom ?? null,
            minBuy: sw.minBuy ?? null, // keep original name in case
          });
        }
      });
    });
 
    // finalize: convert sets to arrays and sort slabs by phase
    const out = Object.values(map).map((s) => {
      return {
        id: s.id,
        name: s.name,
        min: s.min,
        tag: s.tag,
        rewardValue: s.rewardValue,
        rewardDiscountPercentage: s.rewardDiscountPercentage,
        totalDiscount: s.totalDiscount,
        categories: Array.from(s._categories),
        slabs: s.slabs.sort((a, b) => (a.phase || 0) - (b.phase || 0)),
      };
    });
 
    // Optional: stable sort schemes (by name)
    out.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
 
    return out;
  }, [productsWithSchemes]);
 
  // Filter schemes by scheme name or category
  const filteredSchemes = useMemo(() => {
    const q = (filterText || "").trim().toLowerCase();
    if (!q) return schemes;
    return schemes.filter((s) => {
      if ((s.name || "").toLowerCase().includes(q)) return true;
      return (s.categories || []).some((c) => (c || "").toLowerCase().includes(q));
    });
  }, [schemes, filterText]);
 
  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <Ionicons name="information-circle-outline" size={22} color="#999" />
      <Text style={styles.emptyText}>No schemes available</Text>
    </View>
  );
 
  const renderItem = useCallback(
    ({ item }) => {
      const open = Boolean(expanded[item.id]);
      return <SchemeCard scheme={item} open={open} onToggle={toggleExpand} />;
    },
    [expanded, toggleExpand]
  );
 
  const keyExtractor = useCallback((item) => `${item.id}`, []);
 
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="pricetags" size={22} color="#A67C2E" />
              <Text style={styles.title}>Available Schemes</Text>
            </View>
 
            <View style={styles.headerRight}>
              <View style={styles.countPill}>
                <Text style={styles.countText}>{filteredSchemes.length}</Text>
              </View>
            </View>
          </View>
 
          <View style={styles.separator} />
 
          {/* PRODUCT FILTER + BODY */}
          <View style={styles.bodyContainer}>
            {/* Filter — search by scheme name or category */}
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <View style={styles.searchRow}>
                <TextInput
                  placeholder="Filter by scheme name or category"
                  value={filterText}
                  onChangeText={setFilterText}
                  style={styles.searchInput}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {filterText.length > 0 ? (
                  <TouchableOpacity onPress={() => setFilterText("")} style={styles.clearBtn}>
                    <Ionicons name="close-circle" size={20} color="#666" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
 
            {/* show loader inline */}
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" />
                <Text style={{ marginTop: 8 }}>Loading schemes...</Text>
              </View>
            ) : filteredSchemes.length === 0 ? (
              renderEmpty()
            ) : (
              <FlatList
                data={filteredSchemes}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                contentContainerStyle={styles.body}
                initialNumToRender={6}
                maxToRenderPerBatch={8}
                windowSize={7}
                removeClippedSubviews
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
 
          {/* FOOTER */}
          <View style={styles.footer}>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
 
/* ---------- styles (same as before) ---------- */
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  dialog: {
    width: Math.min(width - 32, 900),
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
  },
  header: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 8,
    color: "#1B3A57",
  },
  countPill: {
    backgroundColor: "#EEF3FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  countText: { fontWeight: "700", color: "#1E5BE0" },
  separator: { height: 1, backgroundColor: "#EEE" },
  bodyContainer: {
    maxHeight: Math.min(height * 0.75, 740),
    minHeight: 120,
  },
  body: { padding: 16, paddingBottom: 24 },
  loadingBox: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
  },
  emptyText: { marginLeft: 6, color: "#888" },
  schemeCard: {
    backgroundColor: "#F9FBFF",
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5ECFF",
    overflow: "hidden",
  },
  schemeTop: { padding: 14, flexDirection: "row", alignItems: "center" },
  schemeName: { fontSize: 15, fontWeight: "700", color: "#1B3A57" },
  metaRow: { flexDirection: "row", marginTop: 8, flexWrap: "wrap" },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF1F5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 8,
    marginTop: 6,
  },
  metaText: { fontSize: 12, marginLeft: 4 },
  greenPill: { backgroundColor: "#E7F7EF" },
  greenText: { color: "#137A45", fontSize: 12, fontWeight: "600" },
  categoryPill: { backgroundColor: "#EEF8FF" },
  categoryText: { color: "#0B66D1", fontSize: 12, fontWeight: "600" },
  expandArea: { paddingHorizontal: 14, paddingBottom: 14 },
  slabCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#EEF2F8",
  },
  slabHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  phaseText: { fontWeight: "600", color: "#333" },
  discountText: { fontWeight: "700", color: "#1E5BE0" },
  slabMeta: { fontSize: 12, color: "#666" },
  footer: { padding: 14, borderTopWidth: 1, borderTopColor: "#EEE", alignItems: "flex-end" },
  closeBtn: { backgroundColor: "#A67C2E", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24 },
  closeBtnText: { color: "#fff", fontWeight: "700" },
  // search row
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F6F7FB",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    padding: 0,
  },
  clearBtn: {
    marginLeft: 8,
  },
});
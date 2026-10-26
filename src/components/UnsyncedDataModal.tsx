import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  StatusBar,
  View,
} from "react-native";
import Feather from "@react-native-vector-icons/feather";
import HeaderMain from "./HeaderMain";
import LinearGradient from "react-native-linear-gradient";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import { CLEAR_TABLES } from "../../config";
import { SafeAreaProvider } from "react-native-safe-area-context";

const OPERATION_LABELS = new Set([
  "insert",
  "update",
  "delete",
  "delete_bulk",
  "delete_all",
]);
const EXCLUDED_DETAIL_FIELDS = new Set([
  "id",
  "_changed",
  "_status",
  "is_locally_changed",
  "operation_type",
  "last_modified",
  "is_synced",
  "SoftDelete",
  "ErrorMsg",
  "errorMsg",
]);

const getErrorMessage = (operationType: any) => {
  if (!operationType) return null;
  const value = String(operationType).trim();
  if (!value) return null;
  if (OPERATION_LABELS.has(value.toLowerCase())) return null;
  return value;
};

const getDisplayDate = (record: Record<string, any>) => {
  const rawValue =
    record.last_modified ||
    record.ReceivedAt ||
    record.CreatedDate ||
    record.OrderSubmissionTime__c ||
    record.VisitDate__c ||
    record.AttendanceDate__c ||
    record.BeatDate__c ||
    record.InvoiceDate__c ||
    record.MTPEditDate__c ||
    null;

  if (!rawValue) return "-";

  const date = new Date(rawValue);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleString();
  }

  return String(rawValue);
};

const getMainDetails = (record: Record<string, any>) => {
  return Object.entries(record)
    .filter(
      ([key, value]) =>
        !EXCLUDED_DETAIL_FIELDS.has(key) &&
        value !== null &&
        value !== undefined &&
        value !== ""
    )
    .slice(0, 5)
    .map(([label, value]) => ({
      label,
      value: String(value),
    }));
};

const getStableId = (record: Record<string, any>, index: number) => {
  return record.Sf_Id || record.Name || record.id || `row-${index}`;
};

const objectNames = [...new Set(CLEAR_TABLES)];

const UnsyncedDataModal = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sections, setSections] = useState<any[]>([]);

  const totalRecords = useMemo(
    () => sections.reduce((sum, section) => sum + section.records.length, 0),
    [sections]
  );

  const loadUnsyncedData = async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        objectNames.map(async (objectName) => {
          try {
            const records = await UniversalUpdateInsert({
              ObjectName: objectName,
              Type: "get",
              filters: [{ field: "is_synced", value: false }],
            });

            if (!records?.length) return null;

            return {
              objectName,
              records,
            };
          } catch (error) {
            return null;
          }
        })
      );

      setSections(results.filter(Boolean));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUnsyncedData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUnsyncedData();
  };

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
      <View style={styles.headerContainer}>
        <HeaderMain screenName="Not Sync Data" />
      </View>

      <View
        style={{
          flex: 1,
          backgroundColor: "white",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        }}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color="#C9A24D" />
              <Text style={styles.stateText}>Loading unsynced data...</Text>
            </View>
          ) : sections.length === 0 ? (
            <View style={styles.centerState}>
              <Feather name="check-circle" size={42} color="#2E7D5B" />
              <Text style={styles.emptyTitle}>All data is synced</Text>
              <Text style={styles.emptyText}>
                No pending records found right now.
              </Text>
            </View>
          ) : (
            sections.flatMap((section) =>
              section.records.map(
                (record: Record<string, any>, index: number) => {
                  const errorMessage = getErrorMessage(record.ErrorMsg);
                  const details = getMainDetails(record);

                  return (
                    <View
                      key={`${section.objectName}-${getStableId(
                        record,
                        index
                      )}`}
                      style={styles.card}
                    >
                      <Text style={styles.objectName}>
                        {section.objectName}
                      </Text>
                      <Text style={styles.recordTitle}>Record {index + 1}</Text>
                      {details.map((detail) => (
                        <View
                          key={`${detail.label}-${detail.value}`}
                          style={styles.detailRow}
                        >
                          <Text style={styles.detailLabel}>
                            {detail.label}:
                          </Text>
                          <Text style={styles.detailValue} numberOfLines={1}>
                            {detail.value}
                          </Text>
                        </View>
                      ))}
                      <Text style={styles.dateText}>
                        Date: {getDisplayDate(record)}
                      </Text>

                      {errorMessage ? (
                        <Text style={styles.errorText}>
                          Error: {errorMessage}
                        </Text>
                      ) : null}
                    </View>
                  );
                }
              )
            )
          )}
        </ScrollView>
      </View>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#A67C2E",
  },
  headerContainer: {
    backgroundColor: "#A67C2E",
  },
  container: {
    flex: 1,
    //backgroundColor: '#fff',
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: "#DCE7FF",
    fontSize: 13,
    marginTop: 4,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 28,
  },
  centerState: {
    flex: 1,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  stateText: {
    marginTop: 12,
    color: "#7A7266",
    fontSize: 14,
  },
  emptyTitle: {
    marginTop: 5,
    color: "#1F1D1A",
    fontSize: 18,
    fontWeight: "700",
  },
  emptyText: {
    marginTop: 3,
    color: "#7A7266",
    fontSize: 14,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  objectName: {
    color: "#1E3A8A",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
  },
  recordTitle: {
    color: "#1F1D1A",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  dateText: {
    marginTop: 6,
    color: "#7A7266",
    fontSize: 13,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  detailLabel: {
    color: "#1F1D1A",
    fontSize: 13,
    fontWeight: "700",
    marginRight: 6,
  },
  detailValue: {
    flex: 1,
    color: "#1F1D1A",
    fontSize: 13,
  },
  errorText: {
    marginTop: 8,
    color: "#B3261E",
    fontSize: 13,
    lineHeight: 18,
  },
});

export default UnsyncedDataModal;

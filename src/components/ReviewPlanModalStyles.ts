import { StyleSheet } from "react-native";
import { Colors } from "../theme";

export const styles = StyleSheet.create({
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  reviewModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "85%",
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  pullBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D9D2C3",
    alignSelf: "center",
    marginBottom: 16,
  },
  reviewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  reviewModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  reviewModalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  reviewCloseBtn: {
    padding: 4,
  },
  reviewWeeksContainer: {
    marginBottom: 16,
  },
  reviewWeeksScrollContent: {
    gap: 8,
    paddingVertical: 4,
  },
  reviewWeekTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    backgroundColor: Colors.white,
  },
  reviewWeekTabSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryUltraLight,
  },
  reviewWeekTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  reviewWeekTabTextSelected: {
    color: Colors.primary,
    fontWeight: "700",
  },
  reviewDaysScroll: {
    flex: 1,
  },
  reviewDaysScrollContent: {
    paddingBottom: 20,
  },
  reviewEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  reviewEmptyText: {
    fontSize: 14,
    color: Colors.textDisabled,
    marginTop: 12,
  },
  reviewDayCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reviewDayCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  reviewDayCardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewDayNumber: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  reviewDayName: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  reviewMonthLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  reviewBadgeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#D32F2F",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: "700",
  },
  reviewBeatBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F7",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  reviewBeatLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#8E8E93",
  },
  reviewBeatText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4A4D5C",
    textTransform: "uppercase",
  },
  reviewVisitsList: {
    backgroundColor: Colors.white,
  },
  reviewVisitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  reviewVisitType: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    width: 80,
  },
  reviewVisitName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
    borderWidth: 1,
  },
  statusApproved: {
    backgroundColor: "#E3F1EA",
    borderColor: "#A5D6A7",
  },
  statusPending: {
    backgroundColor: "#FBEFD8",
    borderColor: "#FFB74D",
  },
  statusRejected: {
    backgroundColor: "#F9E5E3",
    borderColor: "#EF9A9A",
  },
  statusDraft: {
    backgroundColor: "#F5F5F7",
    borderColor: "#D9D2C3",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  statusTextApproved: {
    color: "#2E7D5B",
  },
  statusTextPending: {
    color: "#E65100",
  },
  statusTextRejected: {
    color: "#B3261E",
  },
  statusTextDraft: {
    color: "#7A7266",
  },
});

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Colors } from "../theme";
import { styles } from "./ReviewPlanModalStyles";

interface ReviewPlanModalProps {
  visible: boolean;
  onClose: () => void;
  planBeat: "None" | "Daily" | "Weekly" | "Monthly";
  months: string[];
  selectedMonth: string;
  selectedWeek: string;
  datePlans: Record<
    string,
    {
      checkedBeats: Record<string, boolean>;
      checkedItems: Record<string, boolean>;
      selectedBeatId: string | null;
    }
  >;
  existingBeatDays: Record<string, { sfId: string; beatId: string | null; jointWorkingUser?: string | null; jointWorkingUserName?: string | null; jointWorkingReason?: string | null; approvalStatus?: string | null }>;
  mappings: any[];
  workType?: string | null;
  allUsers?: any[];
  loggedInUserId?: string | null;
  userName?: string;
  onJointWorkPress?: (dateStr: string) => void;
  onBulkJointWorkPress?: () => void;
  managerJointWorkings?: Record<string, { sfId: string; ownerId: string; ownerName: string; jointWorkingReason?: string | null }>;
  selectedWorkingUserId?: string | null;
}

export default function ReviewPlanModal({
  visible,
  onClose,
  planBeat,
  months,
  selectedMonth,
  selectedWeek,
  datePlans,
  existingBeatDays,
  mappings,
  workType,
  allUsers,
  loggedInUserId,
  userName,
  onJointWorkPress,
  onBulkJointWorkPress,
  managerJointWorkings,
  selectedWorkingUserId,
}: ReviewPlanModalProps) {
  const [reviewSelectedWeek, setReviewSelectedWeek] = useState<
    "All" | "Week 1" | "Week 2" | "Week 3" | "Week 4" | "Week 5" | "Week 6"
  >("All");

  useEffect(() => {
    if (visible) {
      if (planBeat === "Weekly") {
        setReviewSelectedWeek(selectedWeek as any);
      } else {
        setReviewSelectedWeek("All");
      }
    }
  }, [visible, planBeat, selectedWeek]);

  const getNumberOfWeeksInMonth = (monthYearStr: string): number => {
    const { monthIndex, year } = parseMonthYear(monthYearStr);
    const firstDayIndex = new Date(year, monthIndex, 1).getDay(); // Sunday=0, Monday=1, ...
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const totalSlots = firstDayIndex + daysInMonth;
    return Math.ceil(totalSlots / 7);
  };

  const parseMonthYear = (monthYearStr: string) => {
    const today = new Date();
    let year = today.getFullYear();
    let monthIndex = today.getMonth();

    if (monthYearStr) {
      const parts = monthYearStr.split(" ");
      if (parts.length === 2) {
        const y = parseInt(parts[1], 10);
        if (!isNaN(y)) year = y;

        const monthName = parts[0].toLowerCase();
        const monthNames = [
          "january",
          "february",
          "march",
          "april",
          "may",
          "june",
          "july",
          "august",
          "september",
          "october",
          "november",
          "december",
        ];
        const foundIdx = monthNames.indexOf(monthName);
        if (foundIdx !== -1) {
          monthIndex = foundIdx;
        }
      }
    }

    return { monthIndex, year };
  };

  const isDayInSelectedWeek = (
    dayNum: number,
    weekName: string,
    monthYearStr: string,
  ): boolean => {
    if (!weekName || !monthYearStr) return false;
    const match = weekName.match(/\d+/);
    const weekNum = match ? parseInt(match[0], 10) : 1; // 1 to 5

    const { monthIndex, year } = parseMonthYear(monthYearStr);
    const firstDayIndex = new Date(year, monthIndex, 1).getDay(); // Sunday=0, Monday=1, ...
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const days: number[] = [];
    for (let s = 0; s < 7; s++) {
      const d = (weekNum - 1) * 7 + s - firstDayIndex + 1;
      if (d > 0 && d <= daysInMonth) {
        days.push(d);
      }
    }
    return days.includes(dayNum);
  };

  const getMonthTotalVisitsCount = (monthStr: string) => {
    const { monthIndex, year } = parseMonthYear(monthStr);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    let total = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(monthIndex + 1).padStart(
        2,
        "0",
      )}-${String(d).padStart(2, "0")}`;
      const plan = datePlans[dateStr];
      if (plan) {
        total += Object.values(plan.checkedItems).filter(Boolean).length;
      }
    }
    return total;
  };

  const getReviewPlanData = () => {
    const monthToShow = planBeat === "None" ? months[0] : selectedMonth;
    const { monthIndex, year } = parseMonthYear(monthToShow);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const plannedDays: Array<{
      dayNum: number;
      dayName: string;
      dateStr: string;
      beatName: string;
      visits: Array<{ id: string; name: string; type: string }>;
    }> = [];

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = `${year}-${String(monthIndex + 1).padStart(
        2,
        "0",
      )}-${String(dayNum).padStart(2, "0")}`;
      const plan = datePlans[dateStr];
      const checkedItemIds = plan
        ? Object.keys(plan.checkedItems).filter((id) => plan.checkedItems[id])
        : [];

      let resolvedBeatId = plan?.selectedBeatId;
      let resolvedBeatName = null;
      if (!resolvedBeatId) {
        const existingRecord = existingBeatDays[dateStr];
        if (existingRecord && existingRecord.beatId) {
          resolvedBeatId = existingRecord.beatId;
          resolvedBeatName = existingRecord.beatName;
        }
      }
      if (!resolvedBeatId && checkedItemIds.length > 0) {
        const match = mappings.find(
          (m) =>
            m.Account__c === checkedItemIds[0] ||
            m.Beat__r?.Distributor__c === checkedItemIds[0],
        );
        if (match) {
          resolvedBeatId = match.Beat__c;
          resolvedBeatName = match.Beat__r?.Name || match.Name;
        }
      }

      const hasValidBeatId = !!(resolvedBeatId && resolvedBeatId !== "null" && resolvedBeatId !== "undefined");
      const beatName = hasValidBeatId
        ? resolvedBeatName ||
        mappings.find((m) => m.Beat__c === resolvedBeatId)?.Beat__r?.Name ||
        mappings.find((m) => m.Beat__c === resolvedBeatId)?.Name ||
        "Unnamed Beat"
        : "No Beat Selected";

      const visits = checkedItemIds.map((itemId) => {
        const mappingAsRetailer = mappings.find(
          (m) => m.Account__c === itemId && m.Beat__c === resolvedBeatId,
        );
        if (mappingAsRetailer) {
          return {
            id: itemId,
            name: mappingAsRetailer.Account__r?.Name || "Unnamed Retailer",
            type: "Retailer",
          };
        }
        const mappingAsDistributor = mappings.find(
          (m) => m.Beat__r?.Distributor__c === itemId && m.Beat__c === resolvedBeatId,
        );
        if (mappingAsDistributor) {
          return {
            id: itemId,
            name:
              mappingAsDistributor.Beat__r.Distributor__r?.Name ||
              "Unnamed Distributor",
            type: "Distributor",
          };
        }
        return null;
      }).filter(Boolean) as Array<{ id: string; name: string; type: string }>;

      const hasValidExistingBeat = !!(
        existingBeatDays[dateStr] &&
        existingBeatDays[dateStr].beatId &&
        mappings.some((m) => m.Beat__c === existingBeatDays[dateStr].beatId)
      );

      const hasPlan =
        visits.length > 0 ||
        (hasValidBeatId && beatName !== "Unnamed Beat" && beatName !== "No Beat Selected") ||
        hasValidExistingBeat;

      if (hasPlan) {
        const dayOfWeekIndex = new Date(year, monthIndex, dayNum).getDay();
        const dayName = dayNames[dayOfWeekIndex];

        plannedDays.push({
          dayNum,
          dayName,
          dateStr,
          beatName,
          visits,
        });
      }
    }

    if (reviewSelectedWeek !== "All") {
      return plannedDays.filter((d) =>
        isDayInSelectedWeek(d.dayNum, reviewSelectedWeek, monthToShow),
      );
    }

    return plannedDays;
  };

  const monthToShow = planBeat === "None" ? months[0] : selectedMonth;
  const reviewPlanData = getReviewPlanData();
  const totalVisitsCount = getMonthTotalVisitsCount(monthToShow);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.reviewModalOverlay}>
        <View style={styles.reviewModalContent}>
          {/* Pull Bar Indicator */}
          <View style={styles.pullBar} />

          {/* Header Container */}
          <View style={styles.reviewHeaderRow}>
            <View>
              <Text style={styles.reviewModalTitle}>Review Plan</Text>
              <Text style={styles.reviewModalSubtitle}>
                {monthToShow} • {totalVisitsCount} visits
              </Text>
            </View>
            <TouchableOpacity style={styles.reviewCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Horizontal Weeks Scroll Filter */}
          <View style={styles.reviewWeeksContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reviewWeeksScrollContent}
            >
              {(
                ["All", "Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"] as const
              ).map((wk) => {
                const isSelected = reviewSelectedWeek === wk;
                const match = wk.match(/\d+/);
                const weekNum = match ? parseInt(match[0], 10) : 0;
                const numWeeks = getNumberOfWeeksInMonth(selectedMonth);
                const isDisabled = weekNum > numWeeks;
                return (
                  <TouchableOpacity
                    key={wk}
                    disabled={isDisabled}
                    style={[
                      styles.reviewWeekTab,
                      isSelected && styles.reviewWeekTabSelected,
                      isDisabled && { opacity: 0.4, backgroundColor: "#F1EADB" },
                    ]}
                    onPress={() => setReviewSelectedWeek(wk)}
                  >
                    <Text
                      style={[
                        styles.reviewWeekTabText,
                        isSelected && styles.reviewWeekTabTextSelected,
                      ]}
                    >
                      {wk}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>



          {/* Scrollable list of Day Cards */}
          <ScrollView
            style={styles.reviewDaysScroll}
            contentContainerStyle={styles.reviewDaysScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {reviewPlanData.length === 0 ? (
              <View style={styles.reviewEmptyState}>
                <Ionicons name="calendar-outline" size={48} color="#ccc" />
                <Text style={styles.reviewEmptyText}>
                  No visits planned for this filter
                </Text>
              </View>
            ) : (
              reviewPlanData.map((day) => {
                const monthText = monthToShow.split(" ")[0].slice(0, 3);
                const isJWActive = !!existingBeatDays[day.dateStr]?.jointWorkingUser;
                const jwReason = existingBeatDays[day.dateStr]?.jointWorkingReason;
                const approvalStatus = existingBeatDays[day.dateStr]?.approvalStatus;

                return (
                  <View key={day.dateStr} style={styles.reviewDayCard}>
                    {/* Day Card Header */}
                    <View style={styles.reviewDayCardHeader}>
                      <View style={styles.reviewDayCardHeaderLeft}>
                        <Text style={styles.reviewDayNumber}>{day.dayNum}</Text>
                        <View style={{ marginLeft: 8 }}>
                          <Text style={styles.reviewDayName}>{day.dayName}</Text>
                          <Text style={styles.reviewMonthLabel}>
                            {monthText}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        {approvalStatus ? (
                          <View
                            style={[
                              styles.statusBadge,
                              approvalStatus === "Approved"
                                ? styles.statusApproved
                                : approvalStatus === "Pending Approval" || approvalStatus === "Pending"
                                  ? styles.statusPending
                                  : approvalStatus === "Rejected"
                                    ? styles.statusRejected
                                    : styles.statusDraft,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                approvalStatus === "Approved"
                                  ? styles.statusTextApproved
                                  : approvalStatus === "Pending Approval" || approvalStatus === "Pending"
                                    ? styles.statusTextPending
                                    : approvalStatus === "Rejected"
                                      ? styles.statusTextRejected
                                      : styles.statusTextDraft,
                              ]}
                            >
                              {approvalStatus}
                            </Text>
                          </View>
                        ) : null}
                        <View style={styles.reviewBadgeCircle}>
                          <Text style={styles.reviewBadgeText}>
                            {day.visits.length}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Beat Title Banner */}
                    <View style={styles.reviewBeatBanner}>
                      <Text style={styles.reviewBeatLabel}>BEAT: </Text>
                      <Text style={styles.reviewBeatText}>{day.beatName}</Text>
                    </View>

                    {/* Visits rows */}
                    <View style={styles.reviewVisitsList}>
                      {day.visits.map((visit, index) => {
                        return (
                          <View
                            key={visit.id}
                            style={[
                              styles.reviewVisitRow,
                              index === day.visits.length - 1 && {
                                borderBottomWidth: 0,
                              },
                            ]}
                          >
                            <Text style={styles.reviewVisitType}>
                              {visit.type}
                            </Text>
                            <Text
                              style={styles.reviewVisitName}
                              numberOfLines={1}
                            >
                              {visit.name}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Card-Level Joint Working Action / Read-only details */}
                    {(() => {
                      const today = new Date();
                      const todayZero = new Date(
                        today.getFullYear(),
                        today.getMonth(),
                        today.getDate(),
                      );
                      const dateParts = day.dateStr.split("-");
                      const targetDate = new Date(
                        parseInt(dateParts[0], 10),
                        parseInt(dateParts[1], 10) - 1,
                        parseInt(dateParts[2], 10),
                      );
                      const isPast = targetDate < todayZero;

                      if (workType === "JOURNEY_MODIFICATION") {
                        return null;
                      }

                      if (isJWActive) {
                        return (
                          <View style={{ paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: "#F1EADB", paddingTop: 12 }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                              <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={{ color: "#2E7D5B", fontWeight: "700", fontSize: 12 }}>✓ Joint Work Active</Text>
                                {(() => {
                                  const jwUser = existingBeatDays[day.dateStr]?.jointWorkingUser;
                                  if (jwUser) {
                                    const isCurrentUser = jwUser === loggedInUserId;
                                    const mappedUser = allUsers?.find(u => u.Id === jwUser || u.Sf_Id === jwUser);
                                    const jwUserName = existingBeatDays[day.dateStr]?.jointWorkingUserName || (isCurrentUser ? userName : (mappedUser ? mappedUser.Name : jwUser));
                                    return <Text style={{ color: "#7A7266", fontSize: 11, marginTop: 2 }}>Working User: {jwUserName}</Text>;
                                  }
                                  return null;
                                })()}
                                {jwReason ? (
                                  <Text style={{ color: "#7A7266", fontSize: 11, marginTop: 2 }}>
                                    Reason: {jwReason}
                                  </Text>
                                ) : null}
                              </View>
                              {/* Edit option removed to prevent modifying already configured joint work */}
                            </View>
                          </View>
                        );
                      }

                      const jwConflict = !!(
                        managerJointWorkings &&
                        managerJointWorkings[day.dateStr] &&
                        (managerJointWorkings[day.dateStr].ownerId || "").substring(0, 15) !== (selectedWorkingUserId || "").substring(0, 15)
                      );
                      const conflictUser = jwConflict ? managerJointWorkings[day.dateStr].ownerName : null;

                      if (workType === "JOINT_WORKING" && jwConflict) {
                        return (
                          <View style={{ paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: "#F1EADB", paddingTop: 12 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F9E5E3", padding: 8, borderRadius: 6, borderWidth: 1, borderColor: "#EF9A9A" }}>
                              <Ionicons name="warning-outline" size={16} color="#B3261E" style={{ marginRight: 6 }} />
                              <Text style={{ color: "#B3261E", fontSize: 11, fontWeight: "600", flex: 1 }}>
                                Conflict: Mapped with {conflictUser}
                              </Text>
                            </View>
                          </View>
                        );
                      }

                      const dayRec = existingBeatDays?.[day.dateStr];
                      const approvalStatus = dayRec?.approvalStatus?.toLowerCase();
                      const isPlanLocked = ["pending approval", "pending", "submitted", "rejected"].includes(approvalStatus || "");

                      if (workType === "JOINT_WORKING" && isPlanLocked) {
                        return (
                          <View style={{ paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: "#F1EADB", paddingTop: 12 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#FBEFD8", padding: 8, borderRadius: 6, borderWidth: 1, borderColor: "#FFE0B2" }}>
                              <Ionicons name="lock-closed-outline" size={16} color="#E65100" style={{ marginRight: 6 }} />
                              <Text style={{ color: "#E65100", fontSize: 11, fontWeight: "600", flex: 1 }}>
                                Locked: Plan Pending Approval ({dayRec?.approvalStatus || "Pending"})
                              </Text>
                            </View>
                          </View>
                        );
                      }

                      if (workType === "JOINT_WORKING" && onJointWorkPress && !isPast) {
                        return (
                          <View style={{ paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: "#F1EADB", paddingTop: 12 }}>
                            <TouchableOpacity
                              style={{
                                backgroundColor: Colors.primary,
                                borderRadius: 6,
                                paddingVertical: 8,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onPress={() => onJointWorkPress(day.dateStr)}
                            >
                              <Text style={{ color: Colors.white, fontSize: 12, fontWeight: "700" }}>Joint Work</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }



                      return null;
                    })()}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

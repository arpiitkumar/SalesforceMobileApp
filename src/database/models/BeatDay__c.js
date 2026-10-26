import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class BeatDay__c extends Model {
  static table = "BeatDay__c";

  @field("Sf_Id") sfId;

  @field("Productivity__c") productivity;
  @field("EOD_Comment__c") eodCommentExact;
  @field("Missed_Outlet_Reasons__c") missedOutletReasons;
  @field("End_Time__c") endTime;
  @field("Not_Visited_Outlets__c") notVisitedOutletsExact;
  @field("Total_Time_in_Outlet__c") totalTimeInOutletExact;
  @field("Visited_Outlets__c") visitedOutlets;
  @field("Beat__Name") beatName;
  @field("OwnerId") ownerId;
  @field("Beat__c") beatId;
  @field("Changed_Beat__c") changedBeat;
  @field("Planned_Beat__c") plannedBeat;
  @field("First_Call_Time__c") firstCall;
  @field("Last_Call_Time__c") lastCall;
  @field("Planned_Outlets__c") plannedOutlets;
  @field("NotVisitedOutlets__c") notVisitedOutlets;
  @field("TimeSpentOnField__c") timeSpentOnField;
  @field("AvgTimeSpentinOlforCalls__c") avgTimeOLCalls;
  @field("EndOfDayTime__c") endOfDay;
  @field("PjpOutletVisited__c") pjpVisited;
  @field("NonPjpOutletVisited__c") nonPjpVisited;
  @field("NonPjpProductiveCalls__c") nonPjpProductiveCall;
  @field("TotalDistanceTravelledKm__c") distanceKM;
  @field("NonPjpTc__c") nonPjpTc;
  @field("Productive_Calls__c") productiveCalls;
  @field("NonProductiveCalls__c") nonProductiveCalls;
  @field("TotalProductiveCallsDuration__c") productiveCallDuration;
  @field("AvgTimeSpentinOlforPc__c") avgTimePc;
  @field("Beat_Date__c") beatDate;
  @field("EodComment__c") eodComment;
  @field("Tour_Plan__c") tourPlan;
  @field("Sec_Order_Value__c") secOrderValue;
  @field("SecOrderQuantityPcs__c") secOrderQtyPcs;
  @field("Secondary_Order_Qty_in_KG") secOrderQtyKg;
  @field("Secondary_Order_Qty_in_Value") secOrderQtyValue;
  @field("Planned_Outlets_Coverage__c") plannedOutletCoverage;
  @field("ChangeBeatReason__c") change_Beat_Reason__c;
  @field("Total_Calls__c") total_Call__c;
  @field("Attendance__c") attendance__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;
  @field("ErrorMsg") errorMsg;
  @field("Approval_Status__c") approvalStatus;
  @field("Joint_Working_Reason__c") jointWorkingReason;
  @field("Joint_Working_User__c") jointWorkingUser;
  @field("Joint_Working_User_Name__c") jointWorkingUserName;

  static columns = {
    sfId: "Sf_Id",
    ownerId: "OwnerId",
    productivity: "Productivity__c",
    eodCommentExact: "EOD_Comment__c",
    missedOutletReasons: "Missed_Outlet_Reasons__c",
    endTime: "End_Time__c",
    notVisitedOutletsExact: "Not_Visited_Outlets__c",
    totalTimeInOutletExact: "Total_Time_in_Outlet__c",
    visitedOutlets: "Visited_Outlets__c",
    beatId: "Beat__c",
    firstCall: "First_Call_Time__c",
    lastCall: "Last_Call_Time__c",
    plannedOutlets: "Planned_Outlets__c",
    notVisitedOutlets: "NotVisitedOutlets__c",
    timeSpentOnField: "TimeSpentOnField__c",
    avgTimeOLCalls: "AvgTimeSpentinOlforCalls__c",
    endOfDay: "EndOfDayTime__c",
    pjpVisited: "PjpOutletVisited__c",
    nonPjpVisited: "NonPjpOutletVisited__c",
    nonPjpProductiveCall: "NonPjpProductiveCalls__c",
    distanceKM: "TotalDistanceTravelledKm__c",
    nonPjpTc: "NonPjpTc__c",
    productiveCalls: "Productive_Calls__c",
    nonProductiveCalls: "NonProductiveCalls__c",
    productiveCallDuration: "TotalProductiveCallsDuration__c",
    avgTimePc: "AvgTimeSpentinOlforPc__c",
    beatDate: "Beat_Date__c",
    eodComment: "EodComment__c",
    tourPlan: "Tour_Plan__c",
    secOrderValue: "Sec_Order_Value__c",
    secOrderQtyPcs: "SecOrderQuantityPcs__c",
    secOrderQtyKg: "Secondary_Order_Qty_in_KG",
    secOrderQtyValue: "Secondary_Order_Qty_in_Value",
    plannedOutletCoverage: "Planned_Outlets_Coverage__c",
    beatName: "Beat__Name",
    change_Beat_Reason__c: "ChangeBeatReason__c",
    total_Call__c: "Total_Calls__c",
    attendance__c: "Attendance__c",
    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    softDelete: "SoftDelete",
    errorMsg: "ErrorMsg",
    approvalStatus: "Approval_Status__c",
    jointWorkingReason: "Joint_Working_Reason__c",
    jointWorkingUser: "Joint_Working_User__c",
    jointWorkingUserName: "Joint_Working_User_Name__c",
  };
}

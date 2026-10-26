import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Attendant__c extends Model {
  static table = "Attendant__c";

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    base64: "AttendanceBase64",
    userId: "User__c",
    attendanceDate: "AttendanceDate__c",
    startTime: "StartTime__c",
    endTime: "EndTime__c",
    geoLocation: "GeoLocation__c",
    reason: "Reason__c",
    attendanceStatus: "AttendanceStatus__c",
    approvalStatus: "Approval_Status__c",
    leaveDuration: "LeaveDuration__c",
    capturedSelfie: "CapturedSelfie__c",
    selfieUrl: "SelfieURL__c",
    base64Image: "base64Image",
    other_Leave_Reason__c: "Other_Leave_Reason__c",
    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    softDelete: "SoftDelete",
    mobile_Unique_Id__c: "Mobile_Unique_Id__c",
    fromDate: "From_Date__c",
    toDate: "To_Date__c",
    deviceid: "Deviceid__c",
    errorMsg: "ErrorMsg",
  };

  @field("Sf_Id") sfId;
  @field("Name") name;
  @field("AttendanceBase64") base64;
  @field("User__c") userId;
  @field("AttendanceDate__c") attendanceDate;
  @field("StartTime__c") startTime;
  @field("EndTime__c") endTime;
  @field("GeoLocation__c") geoLocation;
  @field("Reason__c") reason;
  @field("AttendanceStatus__c") attendanceStatus;
  @field("Approval_Status__c") approvalStatus;
  @field("LeaveDuration__c") leaveDuration;
  @field("CapturedSelfie__c") capturedSelfie;
  @field("SelfieURL__c") selfieUrl;
  @field("base64Image") base64Image;
  @field("Other_Leave_Reason__c") other_Leave_Reason__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;
  @field("Mobile_Unique_Id__c") mobile_Unique_Id__c;
  @field("From_Date__c") fromDate;
  @field("To_Date__c") toDate;
  @field("Deviceid__c") deviceid;
  @field("ErrorMsg") errorMsg;
}

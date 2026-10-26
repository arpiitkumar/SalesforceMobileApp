import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Route_Plan__c extends Model {
  static table = "Route_Plans__c";

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    salesRep: "Assigned_To__c",
    approvedBy: "Approved_By__c",
    approvalStatus: "Status__c",
    startDate: "Start_Date__c",
    endDate: "End_Date__c",
    rejectReason: "Reject_Reason__c",
    salespersonRole: "Salesperson_Role__c",
    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    softDelete: "SoftDelete",
    errorMsg: "ErrorMsg",
  };

  @field("Sf_Id") sfId;

  @field("Name") name;
  @field("Assigned_To__c") salesRep;
  @field("Approved_By__c") approvedBy;
  @field("Status__c") approvalStatus;
  @field("Start_Date__c") startDate;
  @field("End_Date__c") endDate;
  @field("Reject_Reason__c") rejectReason;
  @field("Salesperson_Role__c") salespersonRole;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  @field("ErrorMsg") errorMsg;
}

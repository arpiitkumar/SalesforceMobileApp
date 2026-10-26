// models/SalaryAcknowledgement.js
import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class SalaryAcknowledgement extends Model {
  static table = "Salary_Acknowledgement__c";

  @field("Sf_Id") sfId;

  @field("Submitted_Date__c") submittedDate;
  @field("Month__c") month;
  @field("Description__c") description;
  @field("Year__c") year;
  @field("Amount__c") amount;
  @field("DB_Name__c") dbName;
  @field("Assigned_To__c") Assigned_To__c;
  @field("Claim_Generated__c") claim_Generated__c;

  // sync fields
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    submittedDate: "Submitted_Date__c",
    month: "Month__c",
    description: "Description__c",
    year: "Year__c",
    amount: "Amount__c",
    dbName: "DB_Name__c",
    Assigned_To__c: "Assigned_To__c",
    claim_Generated__c: "Claim_Generated__c",

    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    softDelete: "SoftDelete",
    errorMsg: "ErrorMsg",
  };

  @field("ErrorMsg") errorMsg;
}

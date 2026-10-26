import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Survey_Assignment__c extends Model {
  static table = "Survey_Assignment__c";

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    survey_Template__c: "Survey_Template__c",
    active__c: "Active__c",
    assignment_Type__c: "Assignment_Type__c",

    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    SoftDelete: "SoftDelete",
    errorMsg: "ErrorMsg",
  };

  @field("Sf_Id") sfId;
  @field("Name") name;
  @field("Survey_Template__c") survey_Template__c;
  @field("Active__c") active__c;
  @field("Assignment_Type__c") assignment_Type__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;
  @field("ErrorMsg") errorMsg;
}

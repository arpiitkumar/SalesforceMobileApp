import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Survey_Question_Option__c extends Model {
  static table = "Survey_Question_Option__c";

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    survey_Question__c: "Survey_Question__c",
    option__c: "Option__c",
    sequence__c: "Sequence__c",

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
  @field("Survey_Question__c") survey_Question__c;
  @field("Option__c") option__c;
  @field("Sequence__c") sequence__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;
  @field("ErrorMsg") errorMsg;
}

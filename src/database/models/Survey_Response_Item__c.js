import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Survey_Response_Item__c extends Model {
  static table = "Survey_Response_Item__c";

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    survey_Response__c: "Survey_Response__c",
    survey_Question__c: "Survey_Question__c",
    answer_Text__c: "Answer_Text__c",
    answer_Number__c: "Answer_Number__c",
    answer_Decimal__c: "Answer_Decimal__c",
    answer_Date__c: "Answer_Date__c",
    answer_Time__c: "Answer_Time__c",
    answer_Boolean__c: "Answer_Boolean__c",
    rating__c: "Rating__c",

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
  @field("Survey_Response__c") survey_Response__c;
  @field("Survey_Question__c") survey_Question__c;
  @field("Answer_Text__c") answer_Text__c;
  @field("Answer_Number__c") answer_Number__c;
  @field("Answer_Decimal__c") answer_Decimal__c;
  @field("Answer_Date__c") answer_Date__c;
  @field("Answer_Time__c") answer_Time__c;
  @field("Answer_Boolean__c") answer_Boolean__c;
  @field("Rating__c") rating__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;
  @field("ErrorMsg") errorMsg;
}

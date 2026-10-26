import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Survey_Question__c extends Model {
  static table = "Survey_Question__c";

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    survey_Template__c: "Survey_Template__c",
    question__c: "Question__c",
    question_Order__c: "Question_Order__c",
    response_Type__c: "Response_Type__c",
    mandatory__c: "Mandatory__c",
    allow_Image__c: "Allow_Image__c",

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
  @field("Question__c") question__c;
  @field("Question_Order__c") question_Order__c;
  @field("Response_Type__c") response_Type__c;
  @field("Mandatory__c") mandatory__c;
  @field("Allow_Image__c") allow_Image__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;
  @field("ErrorMsg") errorMsg;
}

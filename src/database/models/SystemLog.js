import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class SystemLog extends Model {
  static table = "System_Log__c";

  @field("Sf_Id") sfId;
  @field("Stacktrace__c") stacktrace;
  @field("Log_Request__c") logRequest;
  @field("Log_Response__c") logResponse;
  @field("Log_Status_Code__c") logStatusCode;
  @field("Type__c") type;
  @field("UserId__c") userId;
  @field("Source__c") source;
  @field("Logging_Type__c") loggingType;
  @field("SyncStatus") syncStatus;
  @field("CreatedDate") createdDate;

  static columns = {
    sfId: "Sf_Id",
    stacktrace: "Stacktrace__c",
    logRequest: "Log_Request__c",
    logResponse: "Log_Response__c",
    logStatusCode: "Log_Status_Code__c",
    type: "Type__c",
    userId: "UserId__c",
    source: "Source__c",
    loggingType: "Logging_Type__c",
    syncStatus: "SyncStatus",
    createdDate: "CreatedDate",
    errorMsg: "ErrorMsg",
    retryCount: "RetryCount",
  };

  @field("ErrorMsg") errorMsg;
  @field("RetryCount") retryCount;
}

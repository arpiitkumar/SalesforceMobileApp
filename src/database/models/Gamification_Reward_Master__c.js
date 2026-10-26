import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Gamification_Reward_Master__c extends Model {
  static table = "Gamification_Reward_Master__c";

  @field("Sf_Id") sfId;
  @field("Active__c") active;
  @field("Reward_Type__c") reward_Type__c;
  @field("Gamification_Master__c") gamification_Master__c;
  @field("Start_Date__c") start_Date__c;
  @field("End_Date__c") end_Date__c;
  @field("Required_Point__c") required_Point__c;

  // 🔁 Local / Sync fields
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    active: "Active__c",
    reward_Type__c: "Reward_Type__c",
    gamification_Master__c: "Gamification_Master__c",
    start_Date__c: "Start_Date__c",
    end_Date__c: "End_Date__c",
    required_Point__c: "Required_Point__c",

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

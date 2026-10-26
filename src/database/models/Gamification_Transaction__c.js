import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Gamification_Transaction__c extends Model {
  static table = "Gamification_Transaction__c";

  @field("Sf_Id") sfId;
  @field("User__c") userId;
  @field("User_Name__c") userName;
  @field("Points_Earned__c") pointsEarned;
  @field("Gamification_Master__c") gamificationMasterId;
  @field("Category__c") category__c;
  @field("Transaction_Type__c") transaction_Type__c;
  @field("Gamification_Reward_Master__c") gamification_Reward_Master__c;
  @field("Points_Redeem__c") points_Redeem__c;
  @field("Gamification_Transaction_Master__c")
  gamification_Transaction_Master__c;

  // 🔁 Local / Sync fields
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    userId: "User__c",
    userName: "User_Name__c",
    pointsEarned: "Points_Earned__c",
    gamificationMasterId: "Gamification_Master__c",
    category__c: "Category__c",
    transaction_Type__c: "Transaction_Type__c",
    gamification_Reward_Master__c: "Gamification_Reward_Master__c",
    points_Redeem__c: "Points_Redeem__c",
    gamification_Transaction_Master__c: "Gamification_Transaction_Master__c",

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

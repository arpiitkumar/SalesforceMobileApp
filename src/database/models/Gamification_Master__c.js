import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Gamification_Master__c extends Model {
  static table = "Gamification_Master__c";

  @field("Sf_Id") sfId;
  @field("Active__c") active;
  // @field('Frequency__c') frequency;
  @field("Description__c") description;
  @field("StartDate__c") startDate;
  @field("EndDate__c") endDate;
  @field("RewardPoint__c") rewardPoint;
  @field("Region__c") region;
  // @field('Role__c') role;
  @field("Gamification_Category__c") gamification_Category__c;
  @field("Number_of_Badges_to_Show__c") number_of_Badges_to_Show__c;
  @field("Gamification_Label__c") gamification_Label__c;
  @field("Master_Id") master_Id;
  @field("Transaction_Master_Id") transaction_Master_Id;
  // @field('User__c') user;

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
    // frequency: 'Frequency__c',
    description: "Description__c",
    startDate: "StartDate__c",
    endDate: "EndDate__c",
    rewardPoint: "RewardPoint__c",
    region: "Region__c",
    // role: 'Role__c',
    gamification_Category__c: "Gamification_Category__c",
    number_of_Badges_to_Show__c: "Number_of_Badges_to_Show__c",
    gamification_Label__c: "Gamification_Label__c",
    master_Id: "Master_Id",
    transaction_Master_Id: "Transaction_Master_Id",
    // user: 'User__c',

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

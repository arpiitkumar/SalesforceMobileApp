import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class BeatMapping extends Model {
  static table = "Beat_Mapping__c";

  @field("Sf_Id") sfId;
  @field("Beat__c") beatId;
  @field("Account__c") accountId;
  @field("is_synced") isSynced;
  @field("last_modified") lastModified;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    beatId: "Beat__c",
    accountId: "Account__c",
    isSynced: "is_synced",
    lastModified: "last_modified",
    softDelete: "SoftDelete",
  };
}

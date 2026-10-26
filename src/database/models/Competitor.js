import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Competitor extends Model {
  static table = "Competitor__c";

  @field("Sf_Id") sfId;
  @field("AreaTown__c") areaTown;
  @field("CompetitorBrand__c") competitorBrand;
  @field("ProductName__c") productName;
  @field("PackSize__c") packSize;
  @field("PTC__c") ptc;
  @field("PTR__c") ptr;
  @field("PTD__c") ptd;
  @field("Notes__c") notes;
  @field("Visit__c") visit;
  @field("BeatDay__c") beatDay;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    areaTown: "AreaTown__c",
    competitorBrand: "CompetitorBrand__c",
    productName: "ProductName__c",
    packSize: "PackSize__c",
    ptc: "PTC__c",
    ptr: "PTR__c",
    ptd: "PTD__c",
    notes: "Notes__c",
    visit: "Visit__c",
    beatDay: "BeatDay__c",

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

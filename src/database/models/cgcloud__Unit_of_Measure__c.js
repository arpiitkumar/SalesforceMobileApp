import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class cgcloud__Unit_of_Measure__c extends Model {
  static table = "cgcloud__Unit_of_Measure__c";

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    product: "cgcloud__Product__c",
    piecesPerParentUnit: "cgcloud__Pieces_per_parent_unit__c",
    weightPerUnitInKg: "Weight_Per_Unit_in_KG__c",

    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    softDelete: "SoftDelete",
    errorMsg: "ErrorMsg",
  };

  @field("Sf_Id") sfId;
  @field("Name") name;
  @field("cgcloud__Product__c") product;
  @field("cgcloud__Pieces_per_parent_unit__c") piecesPerParentUnit;
  @field("Weight_Per_Unit_in_KG__c") weightPerUnitInKg;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  @field("ErrorMsg") errorMsg;
}

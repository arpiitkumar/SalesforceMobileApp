import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class HNT_Competitor_Price__c extends Model {
  static table = "HNT_Competitor_Price__c";

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    brand__c: "Brand__c",
    benchmark__c: "Benchmark__c",
    date__c: "Date__c",
    depot__c: "Depot__c",
    grammage__c: "Grammage__c",
    nPTD__c: "NPTD__c",
    nPTR__c: "NPTR__c",
    oil_Type__c: "Oil_Type__c",
    others_To_Be_Field_By_HO__c: "Others_To_Be_Field_By_HO__c",
    pack_Type__c: "Pack_Type__c",
    product__c: "Product__c",
    pTD__c: "PTD__c",
    pTR__c: "PTR__c",
    remarks__c: "Remarks__c",
    scheme__c: "Scheme__c",
    price_Zone__c: "Price_Zone__c",

    // Sync fields
    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    softDelete: "SoftDelete",
    errorMsg: "ErrorMsg",
  };

  // Core fields
  @field("Sf_Id") sfId;
  @field("Name") name;

  @field("Brand__c") brand__c;
  @field("Benchmark__c") benchmark__c;
  @field("Date__c") date__c;
  @field("Depot__c") depot__c;
  @field("Grammage__c") grammage__c;
  @field("NPTD__c") nPTD__c;
  @field("NPTR__c") nPTR__c;
  @field("Oil_Type__c") oil_Type__c;
  @field("Others_To_Be_Field_By_HO__c") others_To_Be_Field_By_HO__c;
  @field("Pack_Type__c") pack_Type__c;
  @field("Product__c") product__c;
  @field("PTD__c") pTD__c;
  @field("PTR__c") pTR__c;
  @field("Remarks__c") remarks__c;
  @field("Scheme__c") scheme__c;
  @field("Price_Zone__c") price_Zone__c;

  // Sync fields
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  @field("ErrorMsg") errorMsg;
}

// SchemeProduct model (SchemeProduct.js)
import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class SchemeProduct extends Model {
  static table = "Scheme_Product__c";

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    definitionType: "Definition_Type__c",
    minBuy: "MinBuy__c",
    maxBuy: "MaxBuy__c",
    productWhereCondition: "Product_Where_Condition__c",
    schemeSlabPhase: "Scheme_Slab_Phase__c",
    discountValue: "DiscountValue__c",
    discountPercentage: "DiscountPercentage__c",
    quantity: "Quantity__c",
    schemeTitle: "Scheme_Title__c",
    schemeProduct: "Scheme_Product__c",
    scheme__c: "Scheme__c",

    // metadata
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
  @field("Definition_Type__c") definitionType;
  @field("MinBuy__c") minBuy;
  @field("MaxBuy__c") maxBuy;
  @field("Product_Where_Condition__c") productWhereCondition;
  @field("Scheme_Slab_Phase__c") schemeSlabPhase;
  @field("DiscountValue__c") discountValue;
  @field("DiscountPercentage__c") discountPercentage;
  @field("Quantity__c") quantity;
  @field("Scheme_Title__c") schemeTitle;
  @field("Scheme_Product__c") schemeProduct;
  @field("Scheme__c") scheme__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  @field("ErrorMsg") errorMsg;
}

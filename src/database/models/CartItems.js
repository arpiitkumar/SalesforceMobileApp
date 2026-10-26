import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class CartItem extends Model {
  static table = "CartItems";
  @field("Sf_Id") sfId;
  @field("GSTPercentage__c") gstPercentage__c;
  @field("Weight_Per_Unit_in_KG__c") weight_Per_Unit_in_KG__c;
  @field("SGST__c") sGST__c;
  @field("CGST__c") cGST__c;
  @field("OrderId") orderId;
  @field("Product2Id") product2Id;
  @field("PriceBookId") priceBookId;
  @field("Name") name;
  @field("ProductImageURL__c") productImageUrl;
  @field("PTD__c") ptd;
  @field("PTR__c") ptr;
  @field("UnitperCase__c") unitPerCase;
  @field("Quantity") quantity;
  @field("UnitMode") unitMode;
  @field("CreatedAt") createdAt;
  @field("AppliedDiscount__c") appliedDiscount__c;
  @field("SchemeSlabIds__c") schemeSlabIds__c;
  @field("IsFree__c") isFree__c;
  @field("Nudge") nudge;
  @field("SectionHead") sectionHead;
  @field("SchemeGenerated__c") schemeGenerated__c;
  @field("RewardType__c") rewardType__c;
  @field("FileName__c") fileName__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;
  @field("VisitId") visitId;

  static columns = {
    sfId: "Sf_Id",
    gstPercentage__c: "GSTPercentage__c",
    weight_Per_Unit_in_KG__c: "Weight_Per_Unit_in_KG__c",
    sGST__c: "SGST__c",
    cGST__c: "CGST__c",
    orderId: "OrderId",
    product2Id: "Product2Id",
    priceBookId: "PriceBookId",
    name: "Name",
    productImageUrl: "ProductImageURL__c",
    ptd: "PTD__c",
    ptr: "PTR__c",
    unitPerCase: "UnitperCase__c",
    quantity: "Quantity",
    unitMode: "UnitMode",
    createdAt: "CreatedAt",
    visitId: "VisitId",
    appliedDiscount__c: "AppliedDiscount__c",
    schemeSlabIds__c: "SchemeSlabIds__c",
    isFree__c: "IsFree__c",
    nudge: "Nudge",
    sectionHead: "SectionHead",
    fileName__c: "FileName__c",
    rewardType__c: "RewardType__c",
    schemeGenerated__c: "SchemeGenerated__c",

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

// ProductPricing.js

import { Model } from "@nozbe/watermelondb";

import { field } from "@nozbe/watermelondb/decorators";

export default class Product_Pricing___c extends Model {
  static table = "Product_Pricing___c";

  /* 🔹 CORE FIELDS */

  @field("Sf_Id") sfId;

  @field("SubDbPrice") subDbPrice;

  @field("Ptr") ptr;

  @field("Ptd") ptd;

  @field("ProductId") productId;

  @field("AccountId") accountId;

  /* 🔹 SYNC / COMMON FIELDS */

  @field("is_locally_changed") isLocallyChanged;

  @field("operation_type") operationType;

  @field("last_modified") lastModified;

  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;

  @field("SoftDelete") softDelete;

  /* 🔹 COLUMN MAP */

  static columns = {
    sfId: "Sf_Id",

    subDbPrice: "SubDbPrice",

    ptr: "Ptr",

    ptd: "Ptd",

    productId: "ProductId",

    accountId: "AccountId",

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

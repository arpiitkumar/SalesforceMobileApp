import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Target extends Model {
  static table = "Target__c";

  // Salesforce Id
  @field("Sf_Id") sfId;

  // Basic descriptors
  @field("Category__c") category;
  @field("SubCategory__c") subCategory__c;

  // Dates (stored as ISO strings)
  @field("StartDate__c") startDate;
  @field("EndDate__c") endDate;

  // Frequency / meta
  @field("Frequency__c") frequency;

  // Numeric targets (stored as strings in DB; helpers below convert to numbers)
  @field("TotalTarget__c") totalTarget;
  @field("TargetSetFor__c") targetSetFor__c;
  @field("ValueTarget__c") valueTarget;
  @field("VolumeTarget__c") volumeTarget;
  @field("CoverageTarget__c") coverageTarget;
  @field("ProductivityTarget__c") productivityTarget;
  @field("TLSTarget__c") tlsTarget;
  @field("UTLSTarget__c") utlsTarget;
  @field("NCatMBOTarget__c") nCatMBOTarget;
  @field("NSubCatMBOTarget__c") nSubCatMBOTarget;
  @field("FocusBrandTarget__c") focusBrandTarget;

  // Multi-select / JSON / CSV style fields (store as string)
  @field("SelectedCategories__c") selectedCategories;
  @field("SelectedSubCategories__c") selectedSubCategories;
  @field("Selected_Focus_Brand__c") selectedFocusBrand;

  @field("ValueTargetAchieved__c") valueTargetAchieved__c;
  @field("NCatMBOTargetAchieved__c") nCatMBOTargetAchieved__c;
  @field("NSubCatMBOTargetAchieved__c") nSubCatMBOTargetAchieved__c;
  @field("FocusBrandTargetAchieved__c") focusBrandTargetAchieved__c;
  @field("VolumeTargetAchieved__c") volumeTargetAchieved__c;
  @field("MBO_Target_Achieved__c") mBO_Target_Achieved__c;
  @field("MBO_Target__c") mBO_Target__c;
  @field("MBO_Type__c") mBO_Type__c;

  // Sync / local flags
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  // optional helpers to convert/parse values (use as this.totalTargetValue, this.startDateObj, etc.)
  get totalTargetValue() {
    const v = this.totalTarget;
    return v == null || v === "" ? null : Number(v);
  }

  get valueTargetValue() {
    const v = this.valueTarget;
    return v == null || v === "" ? null : Number(v);
  }

  get startDateObj() {
    return this.startDate ? new Date(this.startDate) : null;
  }

  get endDateObj() {
    return this.endDate ? new Date(this.endDate) : null;
  }

  // add more helpers as needed...

  static columns = {
    sfId: "Sf_Id",
    category: "Category__c",
    subCategory__c: "SubCategory__c",
    targetSetFor__c: "TargetSetFor__c",
    startDate: "StartDate__c",
    endDate: "EndDate__c",
    frequency: "Frequency__c",
    totalTarget: "TotalTarget__c",
    valueTarget: "ValueTarget__c",
    volumeTarget: "VolumeTarget__c",
    coverageTarget: "CoverageTarget__c",
    productivityTarget: "ProductivityTarget__c",
    tlsTarget: "TLSTarget__c",
    utlsTarget: "UTLSTarget__c",
    nCatMBOTarget: "NCatMBOTarget__c",
    nSubCatMBOTarget: "NSubCatMBOTarget__c",
    focusBrandTarget: "FocusBrandTarget__c",
    selectedCategories: "SelectedCategories__c",
    selectedSubCategories: "SelectedSubCategories__c",
    selectedFocusBrand: "Selected_Focus_Brand__c",
    valueTargetAchieved__c: "ValueTargetAchieved__c",
    nCatMBOTargetAchieved__c: "NCatMBOTargetAchieved__c",
    nSubCatMBOTargetAchieved__c: "NSubCatMBOTargetAchieved__c",
    focusBrandTargetAchieved__c: "FocusBrandTargetAchieved__c",
    volumeTargetAchieved__c: "VolumeTargetAchieved__c",
    mBO_Target_Achieved__c: "MBO_Target_Achieved__c",
    mBO_Target__c: "MBO_Target__c",
    mBO_Type__c: "MBO_Type__c",
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

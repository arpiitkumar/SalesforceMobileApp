import UniversalUpdateInsert from './UniversalUpdateInsert';
import updateReferences from './updateReferences';
import { InsertNSyncLog } from '../../utils/InsertNSyncLog';


const normalizeDateTime = (value) => {
    if (!value) return null;
    try {
        value = value.replace(/^"|"$/g, "");
        const dateObj = new Date(value);
        if (!isNaN(dateObj.getTime())) {
            return dateObj.toISOString();
        }
        return null;
    } catch (e) {
        return null;
    }
};

const normalizeDateTimeIST = (value) => {
    if (!value) return null;

    try {
        value = value.replace(/^"|"$/g, "");
        const dateObj = new Date(value);
        if (!isNaN(dateObj.getTime())) {
            const istOffset = 5.5 * 60 * 60 * 1000;
            const istDate = new Date(dateObj.getTime() + istOffset);
            return istDate.toISOString().replace('Z', '+05:30');
        }
        return null;
    } catch (e) {
        return null;
    }
};

export const syncAttendanceRecords = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const attendanceFalseRecord = await UniversalUpdateInsert({
            ObjectName: "Attendant__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });

        if (!attendanceFalseRecord || attendanceFalseRecord.length === 0) {
            console.log("No attendance records found to sync.");
            return false;
        }

        // Fields to remove
        const attendanceremoveKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            "SoftDelete",
            "AttendanceBase64",
            "base64Image",
            "StartTime__c",
            "GeoLocation__c"
        ];

        // 2️⃣ Filter & clean records
        const attendanceFalseRecordFiltered = attendanceFalseRecord.map(item => {
            const cleanItemattendance = Object.fromEntries(
                Object.entries(item).filter(([key]) => !attendanceremoveKeys.includes(key))
            );

            cleanItemattendance.Id = item.Sf_Id;
            cleanItemattendance.duplicateId = item.Sf_Id;
            cleanItemattendance.AttendanceStartTime__c = item.StartTime__c ? new Date(item.StartTime__c.replace(" ", "T") + "Z").toISOString() : null;

            cleanItemattendance.SelfieURL__c = item.AttendanceBase64 || '';
            if (item.GeoLocation__c && item.GeoLocation__c.includes(",")) {
                const [lat, lng] = item.GeoLocation__c.split(",").map(v => v.trim());
                cleanItemattendance.GeoLocation__Latitude__s = Number(lat);
                cleanItemattendance.GeoLocation__Longitude__s = Number(lng);
            }

            delete cleanItemattendance.Sf_Id;

            return cleanItemattendance;
        });



        // 3️⃣ Prepare payload
        const attendancePayload = [
            {
                objectApiName: "Attendance__c",
                allOrNone: false,
                records: attendanceFalseRecordFiltered
            }
        ];
        console.log("Attendance Payload:", JSON.stringify(attendancePayload));
        // return;

        // 4️⃣ API upload call
        const responseAttendance = await apiFetch(
            'POST',
            'upload-records',
            attendancePayload,
            'Custom'
        );

        console.log("Response from attendance upload:", JSON.stringify(responseAttendance));

        // 5️⃣ Process response
        const responseBody = responseAttendance?.data?.responseBody?.[0];

        // if (responseBody?.results) {
        //     let payloadForOfflineSynceDone = {};
        //     for (const res of responseBody.results) {
        //         if (res.status === "success") {

        //             const oldId = res.duplicateId;
        //             const newId = res.id;

        //             console.log("Updating references for:", oldId, "→", newId);

        //             const allObjects = ['Attendant__c'];
        //             payloadForOfflineSynceDone = {
        //                 Sf_Id: newId,
        //                 is_synced: true,
        //             };

        //             // Update local DB references
        //             await updateReferences(oldId, newId, allObjects);

        //             const responseForOfflineSynceDone = await UniversalUpdateInsert({
        //                 ObjectName: "Attendant__c",
        //                 Type: "insert",
        //                 data: payloadForOfflineSynceDone,
        //             });
        //             const attendanceFalseRecordafter = await UniversalUpdateInsert({
        //                 ObjectName: "Attendant__c",
        //                 Type: "get",
        //                 filters: [{ field: "is_synced", value: false }],
        //             });
        //         }else{
        //              const oldId = res.duplicateId;
        //              const errorMsg=res.errorMessage;
        //              console.log("Updating Error Msg:", oldId, "→", errorMsg);
        //              payloadUpdateErorr = {
        //                 Sf_Id: oldId,
        //                 operation_type: errorMsg,
        //             };
        //              const responseForOfflineSynceDone = await UniversalUpdateInsert({
        //                 ObjectName: "Competitor_LineItem__c",
        //                 Type: "insert",
        //                 data: payloadUpdateErorr,
        //             });
        //         }
        //     }
        // }

        if (responseBody?.results) {
            let groupedResults = {};
            // 🔹 Step 1: Group by duplicateId
            for (const res of responseBody.results) {
                const key = res.duplicateId;
                if (!groupedResults[key]) {
                    groupedResults[key] = [];
                }
                groupedResults[key].push(res);
            }

            // 🔹 Step 2: Process per duplicateId
            for (const duplicateId in groupedResults) {
                const records = groupedResults[duplicateId];
                const hasFailure = records.some(r => r.status === "fail");
                const successRecord = records.find(r => r.status === "success");

                if (hasFailure) {
                    const errorMsg = records.find(r => r.status === "fail")?.errorMessage;
                    console.log(" Record failed:", duplicateId, "→", errorMsg);
                    let payloadUpdateErorr = {
                        Sf_Id: duplicateId,
                        operation_type: errorMsg,
                    };
                    await UniversalUpdateInsert({
                        ObjectName: "Attendant__c",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                    continue;
                }

                // CASE: pure success
                if (successRecord) {
                    const oldId = duplicateId;
                    const newId = successRecord.id;
                    console.log("Updating references:", oldId, "→", newId);
                    const allObjects = ['Attendant__c'];
                    let payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };
                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);
                    await UniversalUpdateInsert({
                        ObjectName: "Attendant__c",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });
                    await UniversalUpdateInsert({
                        ObjectName: "Attendant__c",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                }
            }
        }

        return true; // success output

    } catch (err) {
        console.log("Error in syncAttendanceRecords:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/upload-records', requestBody: { objectApiName: 'Attendance__c' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};



export const syncBeatDayRecord = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "BeatDay__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });

        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No BeatDay__c records found to sync.");
            return false;
        }
        console.log("BeatDay__c records to sync:", FalseRecord.length);

        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            "SoftDelete",
        ];

        // 2️⃣ Filter & clean records
        const FalseRecordFiltered = FalseRecord.map(item => {
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([key]) => !removeKeys.includes(key))
            );
            cleanItem.Id = item.Sf_Id;
            cleanItem.duplicateId = item.Sf_Id;
            delete cleanItem.Sf_Id;
            return cleanItem;
        });
        // 3️⃣ Prepare payload
        const Payload = [
            {
                objectApiName: "BeatDay__c",
                allOrNone: false,
                records: FalseRecordFiltered
            }
        ];

        // 4️⃣ API upload call
        const response = await apiFetch(
            'POST',
            'upload-records',
            Payload,
            'Custom'
        );

        console.log("Response from BeatDay__c upload:", JSON.stringify(response));

        // 5️⃣ Process response
        const responseBody = response?.data?.responseBody?.[0];

        if (responseBody?.results) {
            let payloadForOfflineSynceDone = {};
            for (const res of responseBody.results) {
                if (res.status === "success") {

                    const oldId = res.duplicateId;
                    const newId = res.id;
                    payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };

                    console.log("Updating references for:", oldId, "→", newId);

                    const allObjects = ['BeatDay__c'];

                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "BeatDay__c",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });
                    const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                        ObjectName: "BeatDay__c",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                } else {
                    const oldId = res.duplicateId;
                    const errorMsg = res.errorMessage;
                    console.log("Updating Error Msg:", oldId, "→", errorMsg);
                    payloadUpdateErorr = {
                        Sf_Id: oldId,
                        operation_type: errorMsg,
                    };
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "BeatDay__c",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                }
            }
        }

        return true; // success output

    } catch (err) {
        console.log("Error in syncBeatDay__cRecords:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/upload-records', requestBody: { objectApiName: 'BeatDay__c' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};



export const syncVisitRecord = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Visit",
            Type: "get",
            filters: [{ field: "is_synced", value: false }, { field: "SoftDelete", value: false }],
        });

        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Visit records found to sync.");
            return false;
        }


        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            "SoftDelete",
            "CheckInBase64",
        ];

        // 2️⃣ Filter & clean records
        const FalseRecordFiltered = FalseRecord.map(item => {
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([key]) => !removeKeys.includes(key))
            );
            cleanItem.Id = item.Sf_Id;
            cleanItem.duplicateId = item.Sf_Id;
            cleanItem.CheckInTime__c = normalizeDateTimeIST(item.CheckInTime__c);
            cleanItem.CheckOutTime__c = normalizeDateTimeIST(item.CheckOutTime__c);
            cleanItem.visitBase64 = item.CheckInBase64 || '';
            delete cleanItem.Sf_Id;
            return cleanItem;
        });

        // 3️⃣ Prepare payload
        const Payload = [
            {
                objectApiName: "Visit",
                allOrNone: false,
                records: FalseRecordFiltered
            }
        ];

        console.log("Visit Payload:", JSON.stringify(Payload));
        // 4️⃣ API upload call
        const response = await apiFetch(
            'POST',
            'upload-records',
            Payload,
            'Custom'
        );

        console.log("Response from Visit upload:", JSON.stringify(response));

        // 5️⃣ Process response
        const responseBody = response?.data?.responseBody?.[0];

        if (responseBody?.results) {
            let payloadForOfflineSynceDone = {};
            for (const res of responseBody.results) {
                if (res.status === "success") {

                    const oldId = res.duplicateId;
                    const newId = res.id;

                    console.log("Updating references for:", oldId, "→", newId);

                    payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };

                    const allObjects = ['Visit', 'Order', 'Collection__c', 'FormJson', 'Competitor__c', 'Stock_Check__c',];

                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);

                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Visit",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });
                    const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                        ObjectName: "Visit",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                } else {
                    const oldId = res.duplicateId;
                    const errorMsg = res.errorMessage;
                    console.log("Updating Error Msg:", oldId, "→", errorMsg);
                    payloadUpdateErorr = {
                        Sf_Id: oldId,
                        operation_type: errorMsg,
                    };
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Visit",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                }
            }
        }

        return true; // success output

    } catch (err) {
        console.log("Error in syncVisitRecord:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/upload-records', requestBody: { objectApiName: 'Visit' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};



export const syncOrderRecord = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Order",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });

        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Order records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            "SoftDelete",

            // 👉 Added from your API fields
            "CreatedDate",
            "FulfilledQtyKg__c",
            // "Fulfillment_Status__c",
            "OrderNumber",
            "RejectedQtyKg__c",
            "RejectedValue__c",
            "TotalAmount",
            "TotalFulfilledValue__c",
            "TotalOrderQtyKg__c",
            "TotalReturnQuantity__c",
            "Total_Return_Value__c"
        ];

        // 2️⃣ Filter & clean records
        const FalseRecordFiltered = FalseRecord.map(item => {
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([key]) => !removeKeys.includes(key))
            );
            cleanItem.Id = item.Sf_Id;
            cleanItem.duplicateId = item.Sf_Id;
            cleanItem.Mobile_Unique_Id__c = item.Fulfillment_Status__c;
            cleanItem.Status = 'Draft';

            delete cleanItem.Sf_Id;
            delete cleanItem.Fulfillment_Status__c;
            return cleanItem;
        });
        // console.log("Order records to sync:", FalseRecordFiltered);  
        // return;
        // 3️⃣ Prepare payload
        const Payload = [
            {
                objectApiName: "Order",
                allOrNone: false,
                records: FalseRecordFiltered
            }
        ];
        console.log("Order Payload:", JSON.stringify(Payload));
        // 4️⃣ API upload call
        const response = await apiFetch(
            'POST',
            'upload-records',
            Payload,
            'Custom'
        );
        console.log("Response from Order upload:", JSON.stringify(response));
        // 5️⃣ Process response
        const responseBody = response?.data?.responseBody?.[0];
        if (responseBody?.results) {
            let payloadForOfflineSynceDone = {};
            for (const res of responseBody.results) {
                if (res.status === "success") {
                    const oldId = res.duplicateId;
                    const newId = res.id;
                    console.log("Updating references for:", oldId, "→", newId);
                    payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };
                    const allObjects = ['Order', 'OrderItem'];
                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Order",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });
                    const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                        ObjectName: "Order",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                } else {
                    const oldId = res.duplicateId;
                    const errorMsg = res.errorMessage;
                    console.log("Updating Error Msg:", oldId, "→", errorMsg);
                    // Duplicate Mobile_Unique_Id__c case
                    if (
                        errorMsg?.startsWith(
                            "duplicate value found: Mobile_Unique_Id__c"
                        )
                    ) {
                        try {
                            // Get all OrderItems of this Order
                            const orderItems = await UniversalUpdateInsert({
                                ObjectName: "OrderItem",
                                Type: "get",
                                filters: [{ field: "OrderId", value: oldId }],
                            });
                            // Delete OrderItems first
                            if (orderItems?.length) {
                                for (const item of orderItems) {
                                    console.log('item.Sf_Id ', item.Sf_Id)
                                    await UniversalUpdateInsert({
                                        ObjectName: "OrderItem",
                                        Type: "delete",
                                        data: {
                                            Sf_Id: item.Sf_Id
                                        }
                                    });
                                }
                            }
                            // Delete Order
                            await UniversalUpdateInsert({
                                ObjectName: "Order",
                                Type: "delete",
                                data: {
                                    Sf_Id: oldId
                                }
                            });
                            console.log(
                                `Duplicate order deleted successfully. Order: ${oldId}`
                            );
                        } catch (deleteErr) {
                            console.log(
                                `Error deleting duplicate order ${oldId}:`,
                                deleteErr
                            );
                        }
                        continue;
                    }
                    // Existing error handling
                    const payloadUpdateErorr = {
                        Sf_Id: oldId,
                        operation_type: errorMsg,
                    };
                    await UniversalUpdateInsert({
                        ObjectName: "Order",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                }
            }

        }
        return true; // success output
    } catch (err) {
        console.log("Error in Order:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/upload-records', requestBody: { objectApiName: 'Order' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};


export const syncOrderItemRecord = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "OrderItem",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });

        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No OrderItem records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            // "SoftDelete",

            // 👉 Added New Keys
            "CreatedDate",
            "Fulfilled_Qty_KG__c",
            "Fulfilled_Value__c",
            "GrossAmountExcelMargin__c",
            "Rejected_Qty_KG__c",
            "Rejected_Value__c",
            "SKUCode__c",
            "Sceheme__c",
            "SchemeCode__c",
            "SchemeDiscount__c",
            "TaxableAmount__c",
        ];


        // 2️⃣ Filter & clean records
        const FalseRecordFiltered = FalseRecord.map(item => {
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([key]) => !removeKeys.includes(key))
            );
            cleanItem.Id = item.Sf_Id;
            cleanItem.duplicateId = item.Sf_Id;
            cleanItem.isFOC__c = item.SoftDelete;


            delete cleanItem.Sf_Id;
            delete cleanItem.SoftDelete;
            return cleanItem;
        });
        // console.log("OrderItem records to sync:", FalseRecordFiltered);  
        // return;
        // 3️⃣ Prepare payload
        const Payload = [
            {
                objectApiName: "OrderItem",
                allOrNone: false,
                records: FalseRecordFiltered
            }
        ];
        // 4️⃣ API upload call
        const response = await apiFetch(
            'POST',
            'upload-records',
            Payload,
            'Custom'
        );
        console.log("Response from OrderItem upload:", JSON.stringify(response));
        // 5️⃣ Process response
        const responseBody = response?.data?.responseBody?.[0];
        if (responseBody?.results) {
            let payloadForOfflineSynceDone = {};
            for (const res of responseBody.results) {
                if (res.status === "success") {
                    const oldId = res.duplicateId;
                    const newId = res.id;
                    console.log("Updating references for:", oldId, "→", newId);
                    payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };
                    const allObjects = ['OrderItem'];
                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);

                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "OrderItem",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });
                    const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                        ObjectName: "OrderItem",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                } else {
                    const oldId = res.duplicateId;
                    const errorMsg = res.errorMessage;
                    console.log("Updating Error Msg:", oldId, "→", errorMsg);
                    payloadUpdateErorr = {
                        Sf_Id: oldId,
                        operation_type: errorMsg,
                    };
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "OrderItem",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                }
            }
        }
        return true; // success output
    } catch (err) {
        console.log("Error in OrderItem:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/upload-records', requestBody: { objectApiName: 'OrderItem' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};



export const syncCollectionRecord = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Collection__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });

        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Collection__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            "SoftDelete",
            "ChequeImage__c"
        ];


        // 2️⃣ Filter & clean records
        const FalseRecordFiltered = FalseRecord.map(item => {
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([key]) => !removeKeys.includes(key))
            );
            cleanItem.Id = item.Sf_Id;
            cleanItem.duplicateId = item.Sf_Id;
            delete cleanItem.Sf_Id;
            return cleanItem;
        });
        // console.log("Collection__c records to sync:", FalseRecordFiltered);  
        // return;
        // 3️⃣ Prepare payload
        const Payload = [
            {
                objectApiName: "Collection__c",
                allOrNone: false,
                records: FalseRecordFiltered
            }
        ];
        // 4️⃣ API upload call
        const response = await apiFetch(
            'POST',
            'upload-records',
            Payload,
            'Custom'
        );
        console.log("Response from Collection__c upload:", JSON.stringify(response));
        // 5️⃣ Process response
        const responseBody = response?.data?.responseBody?.[0];
        if (responseBody?.results) {
            let payloadForOfflineSynceDone = {};
            for (const res of responseBody.results) {
                if (res.status === "success") {
                    const oldId = res.duplicateId;
                    const newId = res.id;
                    console.log("Updating references for:", oldId, "→", newId);
                    payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };
                    const allObjects = ['Collection__c', 'Collection_Allocation__c'];
                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);

                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Collection__c",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });
                    const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                        ObjectName: "Collection__c",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                } else {
                    const oldId = res.duplicateId;
                    const errorMsg = res.errorMessage;
                    console.log("Updating Error Msg:", oldId, "→", errorMsg);
                    payloadUpdateErorr = {
                        Sf_Id: oldId,
                        operation_type: errorMsg,
                    };
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Collection__c",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                }
            }
        }
        return true; // success output
    } catch (err) {
        console.log("Error in Collection__c:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/upload-records', requestBody: { objectApiName: 'Collection__c' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};



export const syncCollectionAllocationRecord = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Collection_Allocation__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Collection_Allocation__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            "SoftDelete",
        ];


        // 2️⃣ Filter & clean records
        const FalseRecordFiltered = FalseRecord.map(item => {
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([key]) => !removeKeys.includes(key))
            );
            cleanItem.Id = item.Sf_Id;
            cleanItem.duplicateId = item.Sf_Id;
            delete cleanItem.Sf_Id;
            return cleanItem;
        });
        // console.log("Collection_Allocation__c records to sync:", FalseRecordFiltered);  
        // return;
        // 3️⃣ Prepare payload
        const Payload = [
            {
                objectApiName: "Collection_Allocation__c",
                allOrNone: false,
                records: FalseRecordFiltered
            }
        ];
        // 4️⃣ API upload call
        const response = await apiFetch(
            'POST',
            'upload-records',
            Payload,
            'Custom'
        );
        console.log("Response from Collection_Allocation__c upload:", JSON.stringify(response));
        // 5️⃣ Process response
        const responseBody = response?.data?.responseBody?.[0];
        if (responseBody?.results) {
            let payloadForOfflineSynceDone = {};
            for (const res of responseBody.results) {
                if (res.status === "success") {
                    const oldId = res.duplicateId;
                    const newId = res.id;
                    console.log("Updating references for:", oldId, "→", newId);
                    payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };
                    const allObjects = ['Collection_Allocation__c'];
                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);

                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Collection_Allocation__c",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });
                    const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                        ObjectName: "Collection_Allocation__c",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                } else {
                    const oldId = res.duplicateId;
                    const errorMsg = res.errorMessage;
                    console.log("Updating Error Msg:", oldId, "→", errorMsg);
                    payloadUpdateErorr = {
                        Sf_Id: oldId,
                        operation_type: errorMsg,
                    };
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Collection_Allocation__c",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                }
            }
        }
        return true; // success output
    } catch (err) {
        console.log("Error in Collection_Allocation__c:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/upload-records', requestBody: { objectApiName: 'Collection_Allocation__c' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};


export const syncInvoiceRecord = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Invoice__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Invoice__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            "SoftDelete",

            // ----- Your Invoice Fields -----
            "AdditionalDiscount__c",
            "Customer__c",
            "GSTRATE__c",
            "InvoiceDate__c",
            "InvoiceNo__c",
            "Name",
            "Order__c",
            "Outstanding_Amount__c",
            "Return_Adjusted_Against_Outstanding__c",
            "Status__c",
            "SupplierName__c",
            "TotalGSTAmt__c",
            "Total_Net_Amount__c",
            "Total_Sales_Return_Value__c",
        ];



        // 2️⃣ Filter & clean records
        const FalseRecordFiltered = FalseRecord.map(item => {
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([key]) => !removeKeys.includes(key))
            );
            cleanItem.Id = item.Sf_Id;
            cleanItem.duplicateId = item.Sf_Id;
            delete cleanItem.Sf_Id;
            return cleanItem;
        });
        // console.log("Invoice__c records to sync:", FalseRecordFiltered);  
        // return;
        // 3️⃣ Prepare payload
        const Payload = [
            {
                objectApiName: "Invoice__c",
                allOrNone: false,
                records: FalseRecordFiltered
            }
        ];
        // 4️⃣ API upload call
        const response = await apiFetch(
            'POST',
            'upload-records',
            Payload,
            'Custom'
        );
        console.log("Response from Invoice__c upload:", JSON.stringify(response));
        // 5️⃣ Process response
        const responseBody = response?.data?.responseBody?.[0];
        if (responseBody?.results) {
            let payloadForOfflineSynceDone = {};
            for (const res of responseBody.results) {
                if (res.status === "success") {
                    const oldId = res.duplicateId;
                    const newId = res.id;
                    console.log("Updating references for:", oldId, "→", newId);
                    payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };
                    const allObjects = ['Invoice__c'];
                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);

                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Invoice__c",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });
                    const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                        ObjectName: "Invoice__c",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                } else {
                    const oldId = res.duplicateId;
                    const errorMsg = res.errorMessage;
                    console.log("Updating Error Msg:", oldId, "→", errorMsg);
                    payloadUpdateErorr = {
                        Sf_Id: oldId,
                        operation_type: errorMsg,
                    };
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Invoice__c",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                }
            }
        }
        return true; // success output
    } catch (err) {
        console.log("Error in Invoice__c:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/upload-records', requestBody: { objectApiName: 'Invoice__c' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};


export const syncInvoiceItemRecord = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Invoice_Item__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Invoice_Item__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            "SoftDelete",

            // ------- Your Product Invoice Line Fields -------
            "CGSTAmount__c",
            "Gross_Amount__c",
            "IGSTAmount__c",
            "InvoiceQuantityPcs__c",
            "Invoice_Quantity_In_Mt__c",
            "Invoice__c",
            "Name",
            "NetAmount__c",
            "ProductCode",
            "Product__c",
            "RatePerPC__c",
            "SGSTAmount__c",
        ];




        // 2️⃣ Filter & clean records
        const FalseRecordFiltered = FalseRecord.map(item => {
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([key]) => !removeKeys.includes(key))
            );
            cleanItem.Id = item.Sf_Id;
            cleanItem.duplicateId = item.Sf_Id;
            delete cleanItem.Sf_Id;
            return cleanItem;
        });
        // console.log("Invoice_Item__c records to sync:", FalseRecordFiltered);  
        // return;
        // 3️⃣ Prepare payload
        const Payload = [
            {
                objectApiName: "Invoice_Item__c",
                allOrNone: false,
                records: FalseRecordFiltered
            }
        ];
        // 4️⃣ API upload call
        const response = await apiFetch(
            'POST',
            'upload-records',
            Payload,
            'Custom'
        );
        console.log("Response from Invoice_Item__c upload:", JSON.stringify(response));
        // 5️⃣ Process response
        const responseBody = response?.data?.responseBody?.[0];
        if (responseBody?.results) {
            let payloadForOfflineSynceDone = {};
            for (const res of responseBody.results) {
                if (res.status === "success") {
                    const oldId = res.duplicateId;
                    const newId = res.id;
                    console.log("Updating references for:", oldId, "→", newId);
                    payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };
                    const allObjects = ['Invoice_Item__c'];
                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);

                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Invoice_Item__c",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });
                    const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                        ObjectName: "Invoice_Item__c",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                } else {
                    const oldId = res.duplicateId;
                    const errorMsg = res.errorMessage;
                    console.log("Updating Error Msg:", oldId, "→", errorMsg);
                    payloadUpdateErorr = {
                        Sf_Id: oldId,
                        operation_type: errorMsg,
                    };
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Invoice_Item__c",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                }
            }
        }
        return true; // success output
    } catch (err) {
        console.log("Error in Invoice_Item__c:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/upload-records', requestBody: { objectApiName: 'Invoice_Item__c' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};



export const syncAccountRecord = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Account",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Account records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            "SoftDelete",

            // Your additional fields
            // "Beat__c",
            "BillingAddress",
            // "BillingLatitude",
            // "BillingLongitude",
            "CensusCode__c",
            "Channel__c",
            "Class__c",
            "CreditDays__c",
            "CreditLimit__c",
            "DBType__c",
            "FSSAI_No__c",
            // "GSTIN_Number__c",
            "Active__c",
            "KYC_Updated__c",
            // "Name",
            "OTPVerifiedDate__c",
            "OTPVerified__c",
            "Outlet_Visit_Day__c",
            "OwnerId",
            // "PAN_Number__c",
            "ParentId",
            "Party_Code__c",
            // "RecordTypeId",
            // "SubChannel1__c",
            // "SubChannel2__c",
            // "SubChannel__c",
            // "Type",
            // "Email__c",
            "ManagerId",
            "Region__c",
            "State__c",
        ];

        // 2️⃣ Filter & clean records
        const FalseRecordFiltered = FalseRecord.map(item => {
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([key]) => !removeKeys.includes(key))
            );
            cleanItem.Id = item.Sf_Id;
            cleanItem.duplicateId = item.Sf_Id;
            // cleanItem.Hired_Type__c = item.Hired_Type__c?.replace(/,/g, ";");

            cleanItem.Account_Location_Latitude_Longitude__Latitude__s = item.BillingLatitude;
            cleanItem.Account_Location_Latitude_Longitude__Longitude__s = item.BillingLongitude;

            delete cleanItem.BillingLatitude;
            delete cleanItem.BillingLongitude;
            delete cleanItem.Sf_Id;
            return cleanItem;
        });
        console.log("Account records to sync:", FalseRecordFiltered);
        // return;
        // 3️⃣ Prepare payload
        const Payload = [
            {
                objectApiName: "Account",
                allOrNone: false,
                records: FalseRecordFiltered
            }
        ];
        // 4️⃣ API upload call
        const response = await apiFetch(
            'POST',
            'account-upload',
            Payload,
            'Custom'
        );
        console.log("Response from Account upload:", JSON.stringify(response));
        // 5️⃣ Process response
        const responseBody = response?.data?.responseBody;

        if (responseBody?.results?.length) {
            for (const res of responseBody.results) {
                if (res.status === "success") {

                    const oldId = res.duplicateId;
                    const newId = res.id;

                    console.log("Updating references for:", oldId, "→", newId);

                    const payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };

                    const allObjects = ["Account"];

                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);

                    await UniversalUpdateInsert({
                        ObjectName: "Account",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });

                    await UniversalUpdateInsert({
                        ObjectName: "Account",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                } else {
                    const oldId = res.duplicateId;
                    const errorMsg = res.errorMessage;
                    console.log("Updating Error Msg:", oldId, "→", errorMsg);
                    payloadUpdateErorr = {
                        Sf_Id: oldId,
                        operation_type: errorMsg,
                    };
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Account",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                }
            }
        }

        return true; // success output
    } catch (err) {
        console.log("Error in Account:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/account-upload', requestBody: { objectApiName: 'Account' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};



export const syncFormJsonecord = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "FormJson",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No FormJson records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            "SoftDelete",
            "Unique_Id"
        ];

        // 2️⃣ Filter & clean records
        const FalseRecordFiltered = FalseRecord.map(item => {
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([key]) => !removeKeys.includes(key))
            );
            cleanItem.duplicateId = item.Sf_Id;
            const jsonData = JSON.parse(item.Json);
            Object.assign(cleanItem, jsonData);
            delete cleanItem.Sf_Id;
            delete cleanItem.Json;
            return cleanItem;
        });
        console.log("FormJson records to sync:", JSON.stringify(FalseRecordFiltered));
        // return;

        // 3️⃣ Prepare payload
        const Payload = [
            {
                objectApiName: "Template_Response__c",
                allOrNone: false,
                records: FalseRecordFiltered
            }
        ];
        // console.log("FormJson Payload:", JSON.stringify(Payload));
        // 4️⃣ API upload call
        const response = await apiFetch(
            'POST',
            'account-upload',
            Payload,
            'Custom'
        );
        console.log("Response from FormJson upload:", JSON.stringify(response));
        // 5️⃣ Process response
        const responseBody = response?.data?.responseBody;
        if (responseBody?.results) {
            let payloadForOfflineSynceDone = {};
            for (const res of responseBody.results) {
                if (res.status === "success") {
                    const oldId = res.duplicateId;
                    const newId = res.id;
                    console.log("Updating references for:", oldId, "→", newId);
                    payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };
                    const allObjects = ['FormJson'];
                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);

                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "FormJson",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });
                    const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                        ObjectName: "FormJson",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                } else {
                    const oldId = res.duplicateId;
                    const errorMsg = res.errorMessage;
                    console.log("Updating Error Msg:", oldId, "→", errorMsg);
                    payloadUpdateErorr = {
                        Sf_Id: oldId,
                        operation_type: errorMsg,
                    };
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "FormJson",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                }
            }
        }
        return true; // success output
    } catch (err) {
        console.log("Error in FormJson:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/account-upload', requestBody: { objectApiName: 'Template_Response__c' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};



export const syncCompetitorRecord = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Competitor_LineItem__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Competitor_LineItem__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            "SoftDelete",
            "Vertical__c",
            "Name"
        ];

        // 2️⃣ Filter & clean records
        const FalseRecordFiltered = FalseRecord.map(item => {
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([key]) => !removeKeys.includes(key))
            );
            cleanItem.Id = item.Sf_Id;
            cleanItem.duplicateId = item.Sf_Id;
            delete cleanItem.Sf_Id;
            return cleanItem;
        });
        // console.log("Competitor_LineItem__c records to sync:", FalseRecordFiltered);  
        // return;
        // 3️⃣ Prepare payload
        const Payload = [
            {
                objectApiName: "Competitor_LineItem__c",
                allOrNone: false,
                records: FalseRecordFiltered
            }
        ];
        // 4️⃣ API upload call
        const response = await apiFetch(
            'POST',
            'upload-records',
            Payload,
            'Custom'
        );
        console.log("Response from Competitor_LineItem__c upload:", JSON.stringify(response));
        // 5️⃣ Process response
        const responseBody = response?.data?.responseBody?.[0];
        if (responseBody?.results) {
            let payloadForOfflineSynceDone = {};
            for (const res of responseBody.results) {
                if (res.status === "success") {
                    const oldId = res.duplicateId;
                    const newId = res.id;
                    console.log("Updating references for:", oldId, "→", newId);
                    payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };
                    const allObjects = ['Competitor_LineItem__c'];
                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);

                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Competitor_LineItem__c",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });
                    const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                        ObjectName: "Competitor_LineItem__c",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                } else {
                    const oldId = res.duplicateId;
                    const errorMsg = res.errorMessage;
                    console.log("Updating Error Msg:", oldId, "→", errorMsg);
                    payloadUpdateErorr = {
                        Sf_Id: oldId,
                        operation_type: errorMsg,
                    };
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Competitor_LineItem__c",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                }
            }
        }
        return true; // success output
    } catch (err) {
        console.log("Error in Competitor_LineItem__c:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/upload-records', requestBody: { objectApiName: 'Competitor_LineItem__c' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};



export const syncStockCheckRecord = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Stock_Check__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Stock_Check__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            'CreatedDate',
            "SoftDelete",
        ];

        // 2️⃣ Filter & clean records
        const FalseRecordFiltered = FalseRecord.map(item => {
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([key]) => !removeKeys.includes(key))
            );
            cleanItem.Id = item.Sf_Id;
            cleanItem.duplicateId = item.Sf_Id;
            delete cleanItem.Sf_Id;
            return cleanItem;
        });
        // console.log("Stock_Check__c records to sync:", FalseRecordFiltered);
        // return;
        // 3️⃣ Prepare payload
        const Payload = [
            {
                objectApiName: "Stock_Check__c",
                allOrNone: false,
                records: FalseRecordFiltered
            }
        ];
        // 4️⃣ API upload call
        const response = await apiFetch(
            'POST',
            'upload-records',
            Payload,
            'Custom'
        );
        console.log("Response from Stock_Check__c upload:", JSON.stringify(response));
        // 5️⃣ Process response
        const responseBody = response?.data?.responseBody?.[0];
        if (responseBody?.results) {
            let payloadForOfflineSynceDone = {};
            for (const res of responseBody.results) {
                if (res.status === "success") {
                    const oldId = res.duplicateId;
                    const newId = res.id;
                    console.log("Updating references for:", oldId, "→", newId);
                    payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };
                    const allObjects = ['Stock_Check__c'];
                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);

                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Stock_Check__c",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });
                    const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                        ObjectName: "Stock_Check__c",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                } else {
                    const oldId = res.duplicateId;
                    const errorMsg = res.errorMessage;
                    console.log("Updating Error Msg:", oldId, "→", errorMsg);
                    payloadUpdateErorr = {
                        Sf_Id: oldId,
                        operation_type: errorMsg,
                    };
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Stock_Check__c",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                }
            }
        }
        return true; // success output
    } catch (err) {
        console.log("Error in Stock_Check__c:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/upload-records', requestBody: { objectApiName: 'Stock_Check__c' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};


export const syncMTExceptionRecord = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "MT_Exception__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No MT_Exception__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            "SoftDelete",
            "Name",
        ];

        // 2️⃣ Filter & clean records
        const FalseRecordFiltered = FalseRecord.map(item => {
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([key]) => !removeKeys.includes(key))
            );
            cleanItem.Id = item.Sf_Id;
            cleanItem.duplicateId = item.Sf_Id;
            delete cleanItem.Sf_Id;
            return cleanItem;
        });
        // console.log("MT_Exception__c records to sync:", FalseRecordFiltered);  
        // return;
        // 3️⃣ Prepare payload
        const Payload = [
            {
                objectApiName: "MT_Exception__c",
                allOrNone: false,
                records: FalseRecordFiltered
            }
        ];
        console.log(JSON.stringify(Payload))
        // 4️⃣ API upload call
        const response = await apiFetch(
            'POST',
            'upload-records',
            Payload,
            'Custom'
        );
        console.log("Response from MT_Exception__c upload:", JSON.stringify(response));
        // 5️⃣ Process response
        const responseBody = response?.data?.responseBody?.[0];
        if (responseBody?.results) {
            let payloadForOfflineSynceDone = {};
            for (const res of responseBody.results) {
                if (res.status === "success") {
                    const oldId = res.duplicateId;
                    const newId = res.id;
                    console.log("Updating references for:", oldId, "→", newId);
                    payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };
                    const allObjects = ['MT_Exception__c'];
                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);

                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "MT_Exception__c",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });
                    const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                        ObjectName: "MT_Exception__c",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                } else {
                    const oldId = res.duplicateId;
                    const errorMsg = res.errorMessage;
                    console.log("Updating Error Msg:", oldId, "→", errorMsg);
                    payloadUpdateErorr = {
                        Sf_Id: oldId,
                        operation_type: errorMsg,
                    };
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "MT_Exception__c",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                }
            }
        }
        return true; // success output
    } catch (err) {
        console.log("Error in MT_Exception__c:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/upload-records', requestBody: { objectApiName: 'MT_Exception__c' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};


export const syncGrowthMappingEntryRecord = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Growth_Mapping_Entry__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Growth_Mapping_Entry__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            "SoftDelete",
            "Name",
        ];

        // 2️⃣ Filter & clean records
        const FalseRecordFiltered = FalseRecord.map(item => {
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([key]) => !removeKeys.includes(key))
            );
            cleanItem.Id = item.Sf_Id;
            cleanItem.duplicateId = item.Sf_Id;
            delete cleanItem.Sf_Id;
            return cleanItem;
        });
        // console.log("Growth_Mapping_Entry__c records to sync:", FalseRecordFiltered);  
        // return;
        // 3️⃣ Prepare payload
        const Payload = [
            {
                objectApiName: "Growth_Mapping_Entry__c",
                allOrNone: false,
                records: FalseRecordFiltered
            }
        ];
        // console.log(JSON.stringify(Payload))
        // 4️⃣ API upload call
        const response = await apiFetch(
            'POST',
            'upload-records',
            Payload,
            'Custom'
        );
        console.log("Response from Growth_Mapping_Entry__c upload:", JSON.stringify(response));
        // 5️⃣ Process response
        const responseBody = response?.data?.responseBody?.[0];
        if (responseBody?.results) {
            let payloadForOfflineSynceDone = {};
            for (const res of responseBody.results) {
                if (res.status === "success") {
                    const oldId = res.duplicateId;
                    const newId = res.id;
                    console.log("Updating references for:", oldId, "→", newId);
                    payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };
                    const allObjects = ['Growth_Mapping_Entry__c'];
                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);

                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Growth_Mapping_Entry__c",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });
                    const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                        ObjectName: "Growth_Mapping_Entry__c",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                } else {
                    const oldId = res.duplicateId;
                    const errorMsg = res.errorMessage;
                    console.log("Updating Error Msg:", oldId, "→", errorMsg);
                    payloadUpdateErorr = {
                        Sf_Id: oldId,
                        operation_type: errorMsg,
                    };
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Growth_Mapping_Entry__c",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                }
            }
        }
        return true; // success output
    } catch (err) {
        console.log("Error in Growth_Mapping_Entry__c:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/upload-records', requestBody: { objectApiName: 'Growth_Mapping_Entry__c' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};


export const syncSalaryAcknowledgementRecord = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Salary_Acknowledgement__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Salary_Acknowledgement__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            "SoftDelete",
        ];

        // 2️⃣ Filter & clean records
        const FalseRecordFiltered = FalseRecord.map(item => {
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([key]) => !removeKeys.includes(key))
            );
            cleanItem.Id = item.Sf_Id;
            cleanItem.duplicateId = item.Sf_Id;
            delete cleanItem.Sf_Id;
            return cleanItem;
        });
        // console.log("Salary_Acknowledgement__c records to sync:", FalseRecordFiltered);  
        // return;
        // 3️⃣ Prepare payload
        const Payload = [
            {
                objectApiName: "Salary_Acknowledgement__c",
                allOrNone: false,
                records: FalseRecordFiltered
            }
        ];
        console.log(JSON.stringify(Payload))
        // 4️⃣ API upload call
        const response = await apiFetch(
            'POST',
            'upload-records',
            Payload,
            'Custom'
        );
        console.log("Response from Salary_Acknowledgement__c upload:", JSON.stringify(response));
        // 5️⃣ Process response
        const responseBody = response?.data?.responseBody?.[0];
        if (responseBody?.results) {
            let payloadForOfflineSynceDone = {};
            for (const res of responseBody.results) {
                if (res.status === "success") {
                    const oldId = res.duplicateId;
                    const newId = res.id;
                    console.log("Updating references for:", oldId, "→", newId);
                    payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };
                    const allObjects = ['Salary_Acknowledgement__c'];
                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);

                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Salary_Acknowledgement__c",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });
                    const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                        ObjectName: "Salary_Acknowledgement__c",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                } else {
                    const oldId = res.duplicateId;
                    const errorMsg = res.errorMessage;
                    console.log("Updating Error Msg:", oldId, "→", errorMsg);
                    payloadUpdateErorr = {
                        Sf_Id: oldId,
                        operation_type: errorMsg,
                    };
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Salary_Acknowledgement__c",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                }
            }
        }
        return true; // success output
    } catch (err) {
        console.log("Error in Salary_Acknowledgement__c:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/upload-records', requestBody: { objectApiName: 'Salary_Acknowledgement__c' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};


export const syncGamificationTransactionRecord = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Gamification_Transaction__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Gamification_Transaction__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            "SoftDelete",
        ];

        // 2️⃣ Filter & clean records
        const FalseRecordFiltered = FalseRecord.map(item => {
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([key]) => !removeKeys.includes(key))
            );
            cleanItem.Id = item.Sf_Id;
            cleanItem.duplicateId = item.Sf_Id;
            delete cleanItem.Sf_Id;
            return cleanItem;
        });
        // console.log("Gamification_Transaction__c records to sync:", FalseRecordFiltered);  
        // return;
        // 3️⃣ Prepare payload
        const Payload = [
            {
                objectApiName: "Gamification_Transaction__c",
                allOrNone: false,
                records: FalseRecordFiltered
            }
        ];
        console.log(JSON.stringify(Payload))
        // 4️⃣ API upload call
        const response = await apiFetch(
            'POST',
            'upload-records',
            Payload,
            'Custom'
        );
        console.log("Response from Gamification_Transaction__c upload:", JSON.stringify(response));
        // 5️⃣ Process response
        const responseBody = response?.data?.responseBody?.[0];
        if (responseBody?.results) {
            let payloadForOfflineSynceDone = {};
            for (const res of responseBody.results) {
                if (res.status === "success") {
                    const oldId = res.duplicateId;
                    const newId = res.id;
                    console.log("Updating references for:", oldId, "→", newId);
                    payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };
                    const allObjects = ['Gamification_Transaction__c'];
                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);

                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Gamification_Transaction__c",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });
                    const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                        ObjectName: "Gamification_Transaction__c",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                } else {
                    const oldId = res.duplicateId;
                    const errorMsg = res.errorMessage;
                    console.log("Updating Error Msg:", oldId, "→", errorMsg);
                    payloadUpdateErorr = {
                        Sf_Id: oldId,
                        operation_type: errorMsg,
                    };
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "Gamification_Transaction__c",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                }
            }
        }
        return true; // success output
    } catch (err) {
        console.log("Error in syncGamificationTransactionRecord:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/upload-records', requestBody: { objectApiName: 'Gamification_Transaction__c' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};



export const syncHNTCompetitorPriceRecord = async (apiFetch) => {
    try {
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "HNT_Competitor_Price__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No HNT_Competitor_Price__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "id",
            "SoftDelete",
            "Name"
        ];

        // 2️⃣ Filter & clean records
        const FalseRecordFiltered = FalseRecord.map(item => {
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([key]) => !removeKeys.includes(key))
            );
            cleanItem.Id = item.Sf_Id;
            cleanItem.duplicateId = item.Sf_Id;
            delete cleanItem.Sf_Id;
            return cleanItem;
        });
        // console.log("HNT_Competitor_Price__c records to sync:", FalseRecordFiltered);  
        // return;
        // 3️⃣ Prepare payload
        const Payload = [
            {
                objectApiName: "HNT_Competitor_Price__c",
                allOrNone: false,
                records: FalseRecordFiltered
            }
        ];
        // 4️⃣ API upload call
        const response = await apiFetch(
            'POST',
            'upload-records',
            Payload,
            'Custom'
        );
        console.log("Response from HNT_Competitor_Price__c upload:", JSON.stringify(response));
        // 5️⃣ Process response
        const responseBody = response?.data?.responseBody?.[0];
        if (responseBody?.results) {
            let payloadForOfflineSynceDone = {};
            for (const res of responseBody.results) {
                if (res.status === "success") {
                    const oldId = res.duplicateId;
                    const newId = res.id;
                    console.log("Updating references for:", oldId, "→", newId);
                    payloadForOfflineSynceDone = {
                        Sf_Id: newId,
                        is_synced: true,
                    };
                    const allObjects = ['HNT_Competitor_Price__c'];
                    // Update local DB references
                    await updateReferences(oldId, newId, allObjects);

                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "HNT_Competitor_Price__c",
                        Type: "insert",
                        data: payloadForOfflineSynceDone,
                    });
                    const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                        ObjectName: "HNT_Competitor_Price__c",
                        Type: "get",
                        filters: [{ field: "is_synced", value: false }],
                    });
                } else {
                    const oldId = res.duplicateId;
                    const errorMsg = res.errorMessage;
                    console.log("Updating Error Msg:", oldId, "→", errorMsg);
                    payloadUpdateErorr = {
                        Sf_Id: oldId,
                        operation_type: errorMsg,
                    };
                    const responseForOfflineSynceDone = await UniversalUpdateInsert({
                        ObjectName: "HNT_Competitor_Price__c",
                        Type: "insert",
                        data: payloadUpdateErorr,
                    });
                }
            }
        }
        return true; // success output
    } catch (err) {
        console.log("Error in HNT_Competitor_Price__c:", err);
        InsertNSyncLog({ endpoint: '/services/apexrest/upload-records', requestBody: { objectApiName: 'HNT_Competitor_Price__c' }, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
        return false;
    }
};
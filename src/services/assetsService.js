import { firebaseService } from './firebaseService';

/**
 * Service for interacting with the SBH Assets Management System backend (Firebase).
 */
export const assetsService = {

    /**
     * Fetch all assets from Firebase.
     * @returns {Promise<Array>} List of assets.
     */
    getAssets: async () => {
        return firebaseService.getAssets();
    },

    /**
     * Fetch details for a specific asset, including service history.
     * @param {string} id - Asset ID (e.g., SBH1)
     * @returns {Promise<Object>} Asset details.
     */
    getAssetDetails: async (id) => {
        return firebaseService.getAssetDetails(id);
    },

    /**
     * Public (Read-only) details for QR Code scan.
     * @param {string} id - Asset ID
     */
    getPublicAssetDetails: async (id) => {
        // For public access, we might want a restricted method, 
        // but for now, using the same flow.
        return firebaseService.getAssetDetails(id);
    },

    /**
     * Create a new asset.
     */
    addAsset: async (data, invoiceFileBase64, invoiceFileName, invoiceType) => {
        const payload = {
            ...data,
            Description: data.remark || data.description || '',
            VendorMobile: data.vendorMobile || '',
            ResponsiblePerson: data.responsiblePerson || '',
            ResponsibleMobile: data.responsibleMobile || '',
            invoiceFile: invoiceFileBase64 || data.invoiceFile || '',
            invoiceName: invoiceFileName || data.invoiceName || '',
            invoiceType: invoiceType || data.invoiceType || ''
        };

        return firebaseService.addAsset(payload);
    },

    /**
     * Add a service record.
     */
    async addServiceRecord(data, file, fileName, fileType) {
        let fileBase64 = "";
        if (file) {
            fileBase64 = await this.fileToBase64(file);
        }

        const record = {
            serviceDate: data.serviceDate,
            nextServiceDate: data.nextServiceDate,
            remark: data.remark,
            serviceType: data.serviceType,
            serviceFile: fileBase64,
            serviceFileName: fileName,
            serviceFileType: fileType,
            cost: data.cost,
            location: data.location,
            department: data.department,
            responsiblePerson: data.responsiblePerson,
            responsibleMobile: data.responsibleMobile
        };

        return firebaseService.addServiceRecord(data.id, record);
    },

    async editAsset(data) {
        return firebaseService.editAsset(data);
    },

    async markAsReplaced(data) {
        return firebaseService.markAsReplaced(data);
    },

    /**
     * Helper to convert file to Base64
     */
    fileToBase64: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result;
                const base64 = result.includes(',') ? result.split(',')[1] : result;
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    }
};

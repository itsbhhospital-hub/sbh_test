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
     * Bulk register assets.
     */
    addBulkAssets: async (assetsList) => {
        return firebaseService.addBulkAssets(assetsList);
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

        // Remove undefined fields to prevent Firestore errors
        Object.keys(record).forEach(key => record[key] === undefined && delete record[key]);

        return firebaseService.addServiceRecord(data.id, record);
    },

    async editAsset(data) {
        return firebaseService.editAsset(data);
    },

    async markAsReplaced(data) {
        return firebaseService.markAsReplaced(data);
    },

    /**
     * Helper to convert file to Base64 (with compression for images)
     */
    fileToBase64: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            // Only compress images. DO NOT compress PDFs or other documents.
            if (file.type.startsWith('image/')) {
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 1200;
                        const MAX_HEIGHT = 1200;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                            }
                        } else {
                            if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                height = MAX_HEIGHT;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        // Compress to JPEG at 70% quality (drastically reduces base64 size)
                        let dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                        if (dataUrl.length > 1000000) {
                            // Drop quality slightly further if still huge
                            dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                        }

                        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
                        resolve(base64);
                    };
                    img.onerror = (err) => reject(err);
                };
                reader.onerror = error => reject(error);
            } else {
                // PDF or other files - read as normal but restrict large files before upload
                if (file.size > 700 * 1024) { // 700KB limit for PDFs since Base64 adds ~33% overhead
                    reject(new Error("Document size too large. Please keep PDFs under 700KB to fit in database."));
                    return;
                }
                reader.readAsDataURL(file);
                reader.onload = () => {
                    const result = reader.result;
                    const base64 = result.includes(',') ? result.split(',')[1] : result;
                    resolve(base64);
                };
                reader.onerror = error => reject(error);
            }
        });
    }
};

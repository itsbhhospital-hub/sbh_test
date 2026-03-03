/**
 * STANDALONE GOOGLE DRIVE UPLOAD SCRIPT
 * 
 * INSTRUCTIONS:
 * 1. Go to script.google.com and create a new project.
 * 2. Paste this entire code into Code.gs (replacing everything).
 * 3. Click "Deploy" -> "New Deployment".
 * 4. Select type "Web app".
 * 5. Execute as: "Me"
 * 6. Who has access: "Anyone"
 * 7. Click Deploy, authorize permissions, and copy the Web App URL.
 */

const DRIVE_FOLDER_ID = "1N5dy31gADHN7Ln5p7MTRAs6KMACpt2yj";

// --- PROXY FOR SEAMLESS ZERO-LOGIN PREVIEWS ---
function doGet(e) {
    const fileId = e.parameter.fileId;

    if (fileId) {
        try {
            const file = DriveApp.getFileById(fileId);
            const mime = file.getMimeType();

            // CRITICAL: Ensure the file is shared so the script can access it on behalf of others
            try {
                file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            } catch (e) { /* Permission already set or restricted by admin */ }

            // Logic to handle Images (Proxy via Base64 to bypass login)
            if (mime.startsWith('image/')) {
                const blob = file.getBlob();
                const base64 = Utilities.base64Encode(blob.getBytes());

                const html = `<!DOCTYPE html>
                <html>
                <head>
                  <title>SBH Group - Preview</title>
                  <style>
                    body, html { margin:0; padding:0; height:100%; width:100%; display:flex; justify-content:center; align-items:center; background:#ffffff; overflow:hidden; }
                    img { max-width:98%; max-height:98%; object-fit:contain; border-radius:12px; transition: transform 0.3s ease; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
                    .container { position:relative; width:100%; height:100%; display:flex; justify-content:center; align-items:center; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <img src="data:${mime};base64,${base64}" />
                  </div>
                </body>
                </html>`;

                return HtmlService.createHtmlOutput(html)
                    .setTitle("SBH Group - Image Preview")
                    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
            }

            // Logic for regular documents (Redirect to Preview)
            const url = file.getUrl().replace('/view', '/preview');
            return HtmlService.createHtmlOutput(`<script>window.location.replace("${url}");</script>`)
                .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

        } catch (err) {
            return HtmlService.createHtmlOutput(`<div style="font-family:sans-serif; padding:50px; color:#ef4444; text-align:center;"><h3>Unable to Load Preview</h3><p>${err.toString()}</p><p>Check if the file still exists in SBH Group Drive.</p></div>`)
                .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
        }
    }
    return HtmlService.createHtmlOutput("<h3 style='font-family:sans-serif; color:#2e7d32; text-align:center; margin-top:100px;'>SBH CMS Assets Backend - Systems Ready</h3>");
}

function doPost(e) {
    try {
        let payload = {};
        if (e.postData && e.postData.contents) {
            payload = JSON.parse(e.postData.contents);
        }

        const data = payload.payload || payload;
        const base64String = data.base64Data || data.image;
        const fileName = data.fileName || `Upload_${Date.now()}`;
        const mimeType = data.mimeType || 'application/octet-stream';
        const assetId = data.assetId || null;
        const folderType = data.folderType || null;

        if (!base64String) {
            return createResponse("error", "No file data provided");
        }

        const result = uploadToDrive(base64String, fileName, mimeType, assetId, folderType);
        return createResponse("success", "File uploaded successfully", result);

    } catch (error) {
        return createResponse("error", error.toString());
    }
}

function uploadToDrive(base64Data, fileName, mimeType, assetId, folderType) {
    const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    let targetFolder = rootFolder;

    if (assetId) {
        let assetFolder;
        const existingFolders = rootFolder.getFoldersByName(assetId);

        if (existingFolders.hasNext()) {
            assetFolder = existingFolders.next();
        } else {
            assetFolder = rootFolder.createFolder(assetId);
            assetFolder.createFolder("Purchase Invoice");
            assetFolder.createFolder("Service History");
        }

        if (folderType === 'Invoice') {
            const invoiceFolders = assetFolder.getFoldersByName("Purchase Invoice");
            targetFolder = invoiceFolders.hasNext() ? invoiceFolders.next() : assetFolder.createFolder("Purchase Invoice");
        } else if (folderType === 'Service') {
            const serviceFolders = assetFolder.getFoldersByName("Service History");
            targetFolder = serviceFolders.hasNext() ? serviceFolders.next() : assetFolder.createFolder("Service History");
        } else {
            targetFolder = assetFolder;
        }
    }

    let cleanData = base64Data;
    if (base64Data.includes(',')) {
        cleanData = base64Data.split(',')[1];
    }

    const decoded = Utilities.base64Decode(cleanData);
    const blob = Utilities.newBlob(decoded, mimeType, fileName);
    const file = targetFolder.createFile(blob);

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const publicUrl = `https://drive.google.com/uc?export=view&id=${file.getId()}`;

    return { url: publicUrl, fileName: fileName, fileId: file.getId() };
}

function createResponse(status, message, data = null) {
    const responseObj = { status: status, message: message };
    if (data) responseObj.data = data;
    return ContentService.createTextOutput(JSON.stringify(responseObj)).setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
    return createResponse("success", "CORS OK");
}

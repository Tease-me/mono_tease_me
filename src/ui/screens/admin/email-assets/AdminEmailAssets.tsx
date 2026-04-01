import React, { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/apis";
import AssetPreview from "@/ui/components/uploads/AssetPreview";
import FileDropzone from "@/ui/components/uploads/FileDropzone";
import AdminLayout from "@/ui/screens/admin/AdminLayout";
import {
  AdminEmailAssetUploadResponse,
  AdminServices,
} from "@/api/services/AdminServices";
import styles from "./AdminEmailAssets.module.css";

const admin = AdminServices(apiClient);

const JPG_ACCEPT = ".jpg,.jpeg,image/jpeg";

const getErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.detail || error?.message || fallback;

const isValidJpegFile = (file: File) => {
  const normalizedName = file.name.toLowerCase();
  const validExtension =
    normalizedName.endsWith(".jpg") || normalizedName.endsWith(".jpeg");
  const validType =
    file.type === "" || file.type === "image/jpeg" || file.type === "image/jpg";

  return file.size > 0 && validExtension && validType;
};

const AdminEmailAssets: React.FC = () => {
  const [asset, setAsset] = useState<AdminEmailAssetUploadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setLoadError(null);
    admin
      .getEmailAssets()
      .then((data) => {
        if (!active) return;
        setAsset(data);
      })
      .catch((error) => {
        if (!active) return;
        setAsset(null);
        setLoadError(getErrorMessage(error, "Failed to load email assets."));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const stagedPreviewUrl = useMemo(() => {
    if (!pendingFile) return null;
    return URL.createObjectURL(pendingFile);
  }, [pendingFile]);

  useEffect(() => {
    return () => {
      if (stagedPreviewUrl) {
        URL.revokeObjectURL(stagedPreviewUrl);
      }
    };
  }, [stagedPreviewUrl]);

  const handleFileChange = (file: File | null) => {
    setPageMessage(null);
    setUploadError(null);

    if (!file) {
      setPendingFile(null);
      setValidationError(null);
      return;
    }

    if (!isValidJpegFile(file)) {
      setPendingFile(null);
      setValidationError("Only non-empty JPG or JPEG files are allowed.");
      return;
    }

    setPendingFile(file);
    setValidationError(null);
  };

  const handleUpload = async () => {
    if (!pendingFile) {
      setValidationError("Select a JPG or JPEG file before uploading.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setPageMessage(null);
    try {
      const updated = await admin.uploadResetPasswordHeader(pendingFile);
      setAsset(updated);
      setPendingFile(null);
      setValidationError(null);
      setPageMessage("Reset-password email header updated.");
    } catch (error: any) {
      setUploadError(
        getErrorMessage(error, "Failed to upload the reset-password email header.")
      );
    } finally {
      setUploading(false);
    }
  };

  const previewUrl = stagedPreviewUrl ?? asset?.reset_password_header_url ?? null;
  const isAssetReady = Boolean(asset?.reset_password_header_url);

  return (
    <AdminLayout
      title="Email Assets"
      subtitle="Manage the shared media used by transactional emails."
    >
      <div className={styles["page"]}>
        <section className={styles["panel"]}>
          <div className={styles["panelHeader"]}>
            <div>
              <h2>Reset Password Header</h2>
              <p>
                Upload the JPG header image used by the reset-password email template.
              </p>
            </div>
            <div className={styles["panelMeta"]}>
              <span>{isAssetReady ? "Current asset loaded" : "No current asset loaded"}</span>
              <span>Accepted format: JPG / JPEG</span>
            </div>
          </div>

          {pageMessage && (
            <div className={`${styles["message"]} ${styles["messageSuccess"]}`}>
              {pageMessage}
            </div>
          )}

          {loadError && (
            <div className={`${styles["message"]} ${styles["messageError"]}`}>
              {loadError}
            </div>
          )}

          {uploadError && (
            <div className={`${styles["message"]} ${styles["messageError"]}`}>
              {uploadError}
            </div>
          )}

          {loading ? (
            <div className={styles["emptyState"]}>Loading email assets…</div>
          ) : (
            <div className={styles["assetCard"]}>
              <div className={styles["assetHeader"]}>
                <div>
                  <h3>Header Image</h3>
                  <p>
                    Re-uploading replaces the previous asset at the backend’s canonical key.
                  </p>
                </div>
                <span
                  className={`${styles["statusPill"]} ${
                    isAssetReady ? styles["statusPillActive"] : ""
                  }`}
                >
                  {isAssetReady ? "Ready" : "Missing"}
                </span>
              </div>

              <div className={styles["assetLayout"]}>
                <div className={styles["previewWrap"]}>
                  <AssetPreview
                    label="Reset Password Header"
                    url={previewUrl}
                    type="image"
                    frame="landscape"
                    emptyLabel="No reset-password header uploaded"
                  />

                  <div className={styles["assetMeta"]}>
                    <div>
                      <div className={styles["metaLabel"]}>S3 Key</div>
                      <div className={styles["metaValue"]}>
                        {asset?.reset_password_header_key || "--"}
                      </div>
                    </div>
                    <div>
                      <div className={styles["metaLabel"]}>Content Type</div>
                      <div className={styles["metaValue"]}>
                        {asset?.content_type || "image/jpeg"}
                      </div>
                    </div>
                    <div>
                      <div className={styles["metaLabel"]}>URL</div>
                      <div className={styles["metaValue"]}>
                        {asset?.reset_password_header_url || "--"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles["uploadWrap"]}>
                  <FileDropzone
                    title="Upload Reset Password Header"
                    description="Drag and drop a JPG here, or browse to stage a replacement."
                    accept={JPG_ACCEPT}
                    file={pendingFile}
                    onFileChange={handleFileChange}
                    onFileRemove={() => handleFileChange(null)}
                    browseLabel="Browse"
                    disabled={uploading}
                    metaText="Accepted: .jpg, .jpeg, image/jpeg"
                    error={validationError}
                  />

                  <div className={styles["actionRow"]}>
                    <div className={styles["actionCopy"]}>
                      {pendingFile
                        ? `Staged ${pendingFile.name}. Uploading will replace the current reset-password header.`
                        : "Stage a JPG or JPEG file to replace the current reset-password email header."}
                    </div>
                    <button
                      type="button"
                      className={styles["primary"]}
                      onClick={handleUpload}
                      disabled={uploading || !pendingFile}
                    >
                      {uploading ? "Uploading..." : "Upload header"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
};

export default AdminEmailAssets;

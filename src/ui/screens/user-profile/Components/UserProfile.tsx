import { useContext, useState, useEffect } from "react";
import styles from "./UserProfile.module.css";
import ProfileMedia from "@/ui/components/ProfileMedia";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import SvgPack from "@/utils/SvgPack";
import { AuthContext } from "@/context/AuthContext";
import { apiClient } from "@/api/apis";
import { UserDataModel } from "@/data/models/UserDataModel";
import ImageCropModal from "@/ui/components/modals/image-crop-modal/ImageCropModal";
import clsx from "clsx";

type UserProfileProps = { goTo: (id: string) => void; };
type LocalUser = Partial<UserDataModel>;

const UserProfile: React.FC<UserProfileProps> = ({ goTo }) => {
  const { user } = useContext(AuthContext);
  const [localUser, setLocalUser] = useState<LocalUser>(user ?? {});
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState<boolean>(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);


  const [error, setError] = useState<string | null>(null);
  const [isErrorPositive, setIsErrorPositive] = useState(true);

  const handleUpdateProfile = async () => {
    setError(null);

    try {
      if (photoBlob && user?.id) {
        const form = new FormData();
        form.append("file", photoBlob, "avatar.jpg");
        await apiClient.post(`/user/${user.id}/photo`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setLocalUser((u) => (u ? { ...u, imgUrl: previewUrl ?? u.imgUrl } : u));
      }

      if (user?.id && localUser?.full_name) {
        await apiClient.patch(`/user/${user.id}/profile`, { full_name: localUser.full_name });
        setLocalUser((u) => (u ? { ...u, name: localUser.full_name } : u));
      }
      setIsErrorPositive(true);
      setError("Profile updated.");
    } catch (err) {
      setError(`Error: Please try again later.`);
      setIsErrorPositive(false);
      console.error("Error updating profile:", err);
    } finally {
      setPhotoBlob(null);
    }
  };

  const handleCancel = () => {
    setError(null);
    goTo('home');
  }

  useEffect(() => {

  }, [user?.imgUrl])


  return (
    <div className={clsx(styles.container, "u-sidebar-page")}>
      <div className={styles.avatarBlock}>
        <ProfileMedia
          imageSrc={previewUrl || user?.imgUrl}
          mediaType="image"
          onEditClick={() => document.getElementById("profile-image-input")?.click()}
          size="large"
        />
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          id="profile-image-input"
          onChange={(e) => {
            const file = e.target.files ? e.target.files[0] : null;
            if (!file || !file.type.startsWith('image/')) {
              return;
            }
            const url = URL.createObjectURL(file);
            e.target.value = '';
            setShowCropModal(true);
            setPendingImage(url);
          }}
        />
      </div>

      <div className={styles.form}>
        <div className={styles.inpArea}>
          <TextInput
            placeholder="Username"
            value={localUser?.username ?? "Username not found"}
            readOnly
            className={styles.input}
          />
          <TextInput
            placeholder="Full Name"
            value={localUser?.full_name ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const value = e.target.value;
              setLocalUser((u) => ({ ...u, full_name: value }));
            }}
            className={styles.input}
          />

          <TextInput
            placeholder="email@email.com"
            value={localUser?.email ?? "Error loading email"}
            readOnly
            className={styles.input}
            leftIcon={<SvgPack.Message />}
          />
        </div>
      </div>

      <div className={styles.pillArea}>
        {error && (
          <span className={isErrorPositive ? styles.statusSuccess : styles.statusError}>
            {error}
          </span>
        )}

        {/* <button className={styles.delete}>Delete Account</button> */}
      </div>
      <div className='u-sidebar-footer'>
      <div className={styles.footer}>
        <button className={styles.cancel} onClick={handleCancel}>Cancel</button>
        <NormalButton text="Update Profile" onClick={handleUpdateProfile} className={styles.update} />
      </div>

      <ImageCropModal
        isOpen={showCropModal}
        imageSrc={pendingImage!}
        onClose={() => setShowCropModal(false)}
        onCropComplete={(blob, dataUrl) => {
          setPreviewUrl(dataUrl);
          setShowCropModal(false);
          setPhotoBlob(blob);
          if (pendingImage) {
            URL.revokeObjectURL(pendingImage);
            setPendingImage(null);

          }
        }} />
        </div>
    </div>
  );
};

export default UserProfile;

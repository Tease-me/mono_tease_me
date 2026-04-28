import { Suspense, useContext, useState, useEffect } from "react";
import styles from "./UserProfile.module.css";
import ProfileMedia from "@/ui/components/ProfileMedia";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import SvgPack from "@/utils/SvgPack";
import { AuthContext } from "@/context/AuthContext";
import { apiClient } from "@/api/apis";
import { Endpoints } from "@/api/urls";
import { UserDataModel } from "@/data/models/UserDataModel";
import AvatarPicker from "@/ui/components/avatar-picker/AvatarPicker";
import clsx from "clsx";
import logger from "@/utils/logger";

type UserProfileProps = { goTo: (id: string) => void; };
type LocalUser = Partial<UserDataModel>;

const UserProfile: React.FC<UserProfileProps> = ({ goTo }) => {
  const { user, refreshUser } = useContext(AuthContext);
  const [localUser, setLocalUser] = useState<LocalUser>(user ?? {});
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isErrorPositive, setIsErrorPositive] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSelectAvatar = async (url: string) => {
    try {
      const absoluteAvatarUrl = url.startsWith("http")
        ? url
        : `${window.location.origin}${url}`;
      const response = await fetch(absoluteAvatarUrl);
      if (!response.ok) {
        throw new Error(`Failed to load avatar: ${response.status}`);
      }

      const blob = await response.blob();
      setPreviewUrl(url);
      setPhotoBlob(blob);
      setError(null);
    } catch (err) {
      logger.error("Error loading avatar asset:", err);
      setIsErrorPositive(false);
      setError("Error: Unable to load that avatar right now.");
    }
  };

  const handleUpdateProfile = async () => {
    if (!user?.id) {
      setIsErrorPositive(false);
      setError("Error: Unable to update profile right now.");
      return;
    }

    setError(null);
    setIsUpdating(true);

    try {
      const form = new FormData();
      form.append(
        "user_in",
        JSON.stringify({
          username: localUser.username ?? "",
          full_name: localUser.full_name ?? "",
        }),
      );

      await apiClient.patch(Endpoints.user.profile(user.id), form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (photoBlob && user?.id) {
        const form = new FormData();
        form.append("file", photoBlob, "avatar.jpg");
        await apiClient.post(Endpoints.user.photo(user.id), form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setLocalUser((u) => (u ? { ...u, imgUrl: previewUrl ?? u.imgUrl } : u));
      }
      await refreshUser();
      setIsErrorPositive(true);
      setError("Profile updated.");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail) && detail[0]?.msg
            ? detail[0].msg
            : "Please try again later.";
      setError(`Error: ${message}`);
      setIsErrorPositive(false);
      logger.error("Error updating profile:", err);
    } finally {
      setIsUpdating(false);
      setPhotoBlob(null);
    }
  };

  const handleCancel = () => {
    if (isUpdating) {
      return;
    }
    setError(null);
    goTo('home');
  }

  useEffect(() => {
    setLocalUser(user ?? {});
  }, [user]);


  return (
    <div className={clsx(styles.container, "u-sidebar-page")}>
      <div className={styles.avatarBlock}>
        <ProfileMedia
          imageSrc={previewUrl || user?.imgUrl}
          mediaType="image"
          size="large"
        />
        <IconButton
          color="black"
          type="pill"
          text="Select avatar"
          onClick={() => setShowAvatarPicker(true)}
          className={styles.selectAvatarBtn}
          leftIcon={
            <Suspense fallback={null}>
              <SvgPack.PlusRed />
            </Suspense>
          }
        />
      </div>

      <div className={styles.form}>
        <div className={styles.inpArea}>
          <TextInput
            placeholder="Nickname"
            value={localUser?.username ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const value = e.target.value;
              setLocalUser((u) => ({ ...u, username: value }));
            }}
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
          <button className={styles.cancel} onClick={handleCancel} disabled={isUpdating}>Cancel</button>
          <NormalButton
            text={isUpdating ? "Updating..." : "Update Profile"}
            onClick={handleUpdateProfile}
            className={styles.update}
            disabled={isUpdating}
          />
        </div>
        <AvatarPicker
          isOpen={showAvatarPicker}
          onClose={() => setShowAvatarPicker(false)}
          onSelect={handleSelectAvatar}
        />
      </div>
    </div>
  );
};

export default UserProfile;

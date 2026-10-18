import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateProfile } from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import { uploadProfileImage } from "../services/profileImageStorage";

const ProfileSettingsPage = () => {
  const navigate = useNavigate();
  const { user, accessToken, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    specialization: user?.specialization || "",
    experience: user?.experience || "",
  });
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isLawyer = user?.role === "lawyer";

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      let profileImage = user?.profileImage || "";
      if (profilePhoto) {
        try {
          profileImage = await uploadProfileImage(profilePhoto);
        } catch (uploadError) {
          throw new Error(`Profile photo upload: ${uploadError.message}`);
        }
      }

      let updatedUser;
      try {
        updatedUser = await updateProfile({
          ...form,
          experience: isLawyer ? Number(form.experience) || 0 : undefined,
          profileImage,
        }, accessToken);
      } catch (profileError) {
        throw new Error(`Profile save: ${profileError.message}`);
      }
      updateUser(updatedUser);
      setProfilePhoto(null);
      setMessage("Profile saved.");
    } catch (updateError) {
      setError(updateError.message || "Unable to update profile.");
    } finally {
      setLoading(false);
    }
  };

  const backPath = isLawyer ? "/lawyerpage" : "/";

  return (
    <div className="page auth-shell">
      <div className="container" style={{ maxWidth: 760 }}>
        <section className="auth-panel">
          <div className="section-label">Profile settings</div>
          <h1 className="section-title" style={{ marginTop: 10, fontSize: "2.4rem" }}>Manage your profile</h1>
          <p className="section-subtitle">Update the details other users see, including your profile photo.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Full name</span>
              <input className="field" value={form.name} onChange={updateField("name")} required />
            </label>
            <label className="auth-field">
              <span>Email</span>
              <input className="field" value={user?.email || ""} disabled />
            </label>
            <label className="auth-field">
              <span>Phone</span>
              <input className="field" type="tel" value={form.phone} onChange={updateField("phone")} />
            </label>

            {isLawyer && <>
              <label className="auth-field">
                <span>Specialization</span>
                <input className="field" value={form.specialization} onChange={updateField("specialization")} required />
              </label>
              <label className="auth-field">
                <span>Experience (years)</span>
                <input className="field" type="number" min="0" value={form.experience} onChange={updateField("experience")} required />
              </label>
            </>}

            <label className="auth-field">
              <span>Profile photo</span>
              <input className="field" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setProfilePhoto(event.target.files?.[0] || null)} />
              <small>Leave empty to keep your current photo. JPG, PNG, or WebP; maximum 5 MB.</small>
            </label>

            {user?.profileImage && <img className="lawyer-avatar" src={user.profileImage} alt="Current profile" />}
            {error && <div className="auth-error">{error}</div>}
            {message && <div className="empty-copy">{message}</div>}
            <div className="hero-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Saving..." : "Save changes"}</button>
              <button type="button" className="btn btn-secondary" onClick={() => navigate(backPath)}>Back</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default ProfileSettingsPage;

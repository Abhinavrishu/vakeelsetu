import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { signUp } from "../api/authApi";
import { uploadProfileImage } from "../services/profileImageStorage";
import { createDeviceEncryptionIdentity, saveDeviceEncryptionIdentity } from "../services/e2eCrypto";

const initialForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "client",
  specialization: "",
  experience: "",
};

const SignUpPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profilePhoto, setProfilePhoto] = useState(null);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      let profileImage = "";
      if (profilePhoto) {
        try {
          profileImage = await uploadProfileImage(profilePhoto);
        } catch (uploadError) {
          throw new Error(`Profile photo upload: ${uploadError.message}`);
        }
      }

      const payload = {
        ...form,
        experience: form.role === "lawyer" ? Number(form.experience) || 0 : 0,
        profileImage,
      };
      const identity = await createDeviceEncryptionIdentity();
      payload.encryptionPublicKey = identity.encryptionPublicKey;

      let data;
      try {
        data = await signUp(payload);
      } catch (registrationError) {
        throw new Error(`Account registration: ${registrationError.message}`);
      }

      await saveDeviceEncryptionIdentity(data.user.id, identity);
      login(data);
      navigate(data.user?.role === "lawyer" ? "/lawyerpage" : "/");
    } catch (signUpError) {
      setError(signUpError.message || "Unable to create account");
    } finally {
      setLoading(false);
    }
  };

  const isLawyer = form.role === "lawyer";

  return (
    <div className="page auth-shell">
      <div className="container auth-grid">
        <section className="auth-panel auth-panel--brand">
          <div className="brand-row">
            <span className="brand-mark" />
            VakeelSetu
          </div>
          <h1 className="auth-title">Create your legal profile.</h1>
          <p className="auth-copy">
            Join as a client or lawyer. If you choose lawyer, we will ask for your specialization and experience so clients can discover you properly.
          </p>
          <div className="auth-points">
            <div className="auth-point">Role-based sign up for clients and lawyers</div>
            <div className="auth-point">Lawyer details captured at onboarding</div>
            <div className="auth-point">Instant routing to the correct home page</div>
          </div>
        </section>

        <section className="auth-panel">
          <div className="section-label">Sign up</div>
          <h2 className="section-title" style={{ marginTop: 10, fontSize: "2.4rem" }}>Build your account</h2>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Full name</span>
              <input className="field" type="text" value={form.name} onChange={updateField("name")} placeholder="Your full name" required />
            </label>

            <label className="auth-field">
              <span>Email</span>
              <input className="field" type="email" value={form.email} onChange={updateField("email")} placeholder="you@example.com" required />
            </label>

            <label className="auth-field">
              <span>Phone</span>
              <input className="field" type="tel" value={form.phone} onChange={updateField("phone")} placeholder="Your phone number" />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input className="field" type="password" value={form.password} onChange={updateField("password")} placeholder="Choose a secure password" required />
            </label>
            <label className="auth-field">
              <span>Account type</span>
              <select className="select" value={form.role} onChange={updateField("role")}>
                <option value="client">Client</option>
                <option value="lawyer">Lawyer</option>
              </select>
            </label>

            {isLawyer && (
              <>
                <label className="auth-field">
                  <span>Specialization</span>
                  <input className="field" type="text" value={form.specialization} onChange={updateField("specialization")} placeholder="Family, Criminal, Corporate..." required />
                </label>

                <label className="auth-field">
                  <span>Experience (years)</span>
                  <input className="field" type="number" min="0" value={form.experience} onChange={updateField("experience")} placeholder="Years of practice" required />
                </label>

                <label className="auth-field">
                  <span>Profile photo</span>
                  <input
                    className="field"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    onChange={(event) => setProfilePhoto(event.target.files?.[0] || null)}
                  />
                  <small>JPG, PNG, or WebP; maximum 5 MB. The image is stored in Supabase Storage.</small>
                </label>
              </>
            )}

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link to="/signin">Sign in</Link>
          </p>
        </section>
      </div>
    </div>
  );
};

export default SignUpPage;

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { signIn } from "../api/authApi";

const SignInPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await signIn(form);

      login(data);
      navigate(data.user?.role === "lawyer" ? "/lawyerpage" : "/");
    } catch (signInError) {
      setError(signInError.message || "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-shell">
      <div className="container auth-grid">
        <section className="auth-panel auth-panel--brand">
          <div className="brand-row">
            <span className="brand-mark" />
            VakeelSetu
          </div>
          <h1 className="auth-title">Welcome back.</h1>
          <p className="auth-copy">
            Sign in to continue your conversations, manage appointments, and keep every legal thread organized.
          </p>
          <div className="auth-points">
            <div className="auth-point">Secure access for clients and lawyers</div>
            <div className="auth-point">Chat and case flow in one place</div>
            <div className="auth-point">Role-aware dashboard routing</div>
          </div>
        </section>

        <section className="auth-panel">
          <div className="section-label">Sign in</div>
          <h2 className="section-title" style={{ marginTop: 10, fontSize: "2.4rem" }}>Enter your account</h2>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Email</span>
              <input className="field" type="email" value={form.email} onChange={updateField("email")} placeholder="you@example.com" required />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input className="field" type="password" value={form.password} onChange={updateField("password")} placeholder="Your password" required />
            </label>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="auth-footer">
            New here? <Link to="/signup">Create an account</Link>
          </p>
        </section>
      </div>
    </div>
  );
};

export default SignInPage;

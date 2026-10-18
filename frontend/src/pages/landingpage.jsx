import { useState } from "react";
import LawyerCard from "../component/lawyer";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLawyerDirectory } from "../hooks/useLawyerDirectory";

const ClientLandingPage = () => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const { lawyers, error, loading } = useLawyerDirectory();

  const navigate = useNavigate();
  const { isAuthenticated, isLawyer, logout, user } = useAuth();

  const filteredLawyers = lawyers.filter((lawyer) =>
    lawyer.name.toLowerCase().includes(search.toLowerCase()) &&
    (category === "" || lawyer.category === category)
  );

  const categories = [...new Set(lawyers.map((l) => l.category))];

  const openChat = (lawyerId) => {
    navigate(`/chat/${lawyerId}?role=client&userId=${encodeURIComponent(user?.id || '')}&selfName=${encodeURIComponent(user?.name || 'Client')}&peerName=${encodeURIComponent(lawyers.find((lawyer) => lawyer.id === lawyerId)?.name || 'Lawyer')}`);
  };

  const metrics = [
    { label: "Available counsel", value: lawyers.length, note: "Profiles from your database" },
    { label: "Practice areas", value: categories.length, note: "Filter by specialty" },
    { label: "Response flow", value: "Chat", note: "Message lawyers directly" },
  ];

  const handleSignOut = () => {
    logout();
    navigate("/signin");
  };

  return (
    <div className="page page-home">
      <div className="container hero">
        <section className="hero-card">
          <div className="hero-grid">
            <div>
              <div className="brand-row">
                <span className="brand-mark" />
                VakeelSetu
              </div>
              <h1 className="hero-title">A calmer way to find legal help.</h1>
              <p className="hero-copy">
                Discover verified lawyers from your database and start a secure chat when you need legal help.
              </p>
              <div className="hero-actions">
                {isAuthenticated && isLawyer && (
                  <button className="btn btn-primary" onClick={() => navigate('/lawyerpage')}>
                    Open lawyer dashboard
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => document.getElementById('lawyer-list')?.scrollIntoView({ behavior: 'smooth' })}>
                  Browse lawyers
                </button>
                {isAuthenticated ? (
                  <>
                    <button className="btn btn-secondary" onClick={() => navigate("/settings/profile")}>Profile settings</button>
                    <button className="btn btn-secondary" onClick={handleSignOut}>Sign out</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-secondary" onClick={() => navigate('/signin')}>
                      Sign in
                    </button>
                    <button className="btn btn-primary" onClick={() => navigate('/signup')}>
                      Sign up
                    </button>
                  </>
                )}
              </div>
            </div>

            <aside className="hero-aside">
              <div className="stats-grid">
                {metrics.map((metric) => (
                  <div key={metric.label} className="stats-card">
                    <div className="stats-label">{metric.label}</div>
                    <div className="stats-value">{metric.value}</div>
                    <div className="stats-note">{metric.note}</div>
                  </div>
                ))}
              </div>
              <div className="panel">
                <div className="panel-title">Smart search</div>
                <p className="section-subtitle">
                  Use category filters and names to surface the right lawyer in seconds.
                </p>
              </div>
            </aside>
          </div>

          <div className="search-grid">
            <input
              type="text"
              placeholder="Search by lawyer name"
              className="field"
              onChange={(e) => setSearch(e.target.value)}
              value={search}
            />
            <select
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </section>
      </div>

      <section id="lawyer-list" className="section">
        <div className="container">
          <div className="section-header">
            <div>
              <div className="section-label">Verified network</div>
              <h2 className="section-title">Lawyers ready to chat</h2>
            </div>
            <p className="section-subtitle">
              {loading ? 'Refreshing lawyer directory...' : `${filteredLawyers.length} lawyer(s) matched your filters.`}
            </p>
          </div>

          {error && <div className="empty-state" style={{ marginBottom: '18px' }}>
            <h3 className="empty-title">Directory unavailable</h3>
            <p className="empty-copy">{error}</p>
          </div>}

          {!loading && filteredLawyers.length === 0 ? (
            <div className="empty-state">
              <h3 className="empty-title">No lawyers found yet</h3>
              <p className="empty-copy">
                Once lawyer profiles are added to the backend, they will appear here automatically with chat actions.
              </p>
            </div>
          ) : (
            <div className="card-grid">
              {filteredLawyers.map((lawyer) => (
                <LawyerCard key={lawyer.id} lawyer={lawyer} onChat={openChat} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ClientLandingPage;

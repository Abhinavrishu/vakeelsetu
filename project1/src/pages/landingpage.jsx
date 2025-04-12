import { useEffect, useState } from "react";
import LawyerCard from "../component/lawyer";
import { dummyLawyers } from "./lawyer";
import { useNavigate } from "react-router-dom";

const ClientLandingPage = () => {
  const [lawyers, setLawyers] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchLawyers = async () => {
      try {
        const verifiedLawyers = dummyLawyers.filter((lawyer) => lawyer.verified);
        setLawyers(verifiedLawyers);
      } catch (err) {
        setError("Failed to load lawyers.");
      } finally {
        setLoading(false);
      }
    };

    fetchLawyers();
  }, []);

  const filteredLawyers = lawyers.filter((lawyer) =>
    lawyer.name.toLowerCase().includes(search.toLowerCase()) &&
    (category === "" || lawyer.category === category)
  );

  const categories = [...new Set(lawyers.map((l) => l.category))];

  const handleConnect = (type, lawyerId) => {

   if (type === "audio") navigate(`/call/audio/${lawyerId}`);

  };

  return (
    <div className="p-6 bg-white min-h-screen">
      <h1 className="text-3xl font-bold mb-4">VakeelSetu:Find a Lawyer</h1>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      {loading && <div className="text-blue-500 mb-4">Loading lawyers...</div>}

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by name"
          className="p-2 border rounded w-full md:w-1/2"
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="p-2 border rounded w-full md:w-1/4"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((cat, i) => (
            <option key={i} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLawyers.length === 0 ? (
          <p>No lawyers found matching your criteria.</p>
        ) : (
          filteredLawyers.map((lawyer) => (
            <LawyerCard key={lawyer.id} lawyer={lawyer} onConnect={handleConnect} />
          ))
        )}
      </div>
    </div>
  );
};

export default ClientLandingPage;

const LawyerCard = ({ lawyer, onConnect }) => {
  return (
    <div className="border rounded-xl p-4 shadow-md bg-white max-w-sm">
      <img
        src={lawyer.photo}
        alt="lawyer"
        className="w-24 h-24 rounded-full object-cover mb-2"
      />
      <h2 className="text-xl font-semibold">{lawyer.name}</h2>
      <p className="text-gray-600">{lawyer.category}</p>
      <p>Experience: {lawyer.experience} years</p>
      <p>Charges: ₹{lawyer.charges}/hr</p>
      <p>Status: {lawyer.verified ? "✅ Verified" : "❌ Pending"}</p>
      <div className="flex gap-2 mt-3">
        <button onClick={() => onConnect("audio", lawyer.id)} className="bg-green-500 text-white px-4 py-1 rounded">Call</button>
      </div>
    </div>
  );
};

export default LawyerCard;
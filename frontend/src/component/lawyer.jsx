const LawyerCard = ({ lawyer, onChat }) => {
  return (
    <article className="lawyer-card">
      <img
        src={lawyer.photo}
        alt="lawyer"
        className="lawyer-avatar"
      />
      <div className="lawyer-media">
        <div>
          <h2 className="lawyer-name">{lawyer.name}</h2>
          <p className="lawyer-meta">{lawyer.category}</p>
        </div>
      </div>
      <div className="lawyer-badges">
        <span className="badge badge-brand">Experience {lawyer.experience} years</span>
        <span className="badge badge-neutral">₹{lawyer.charges}/hr</span>
        <span className={lawyer.verified ? "badge badge-success" : "badge badge-neutral"}>
          {lawyer.verified ? "Verified" : "Pending"}
        </span>
      </div>
      <div className="card-divider" />
      <div className="card-actions">
        <button onClick={() => onChat(lawyer.id)} className="btn btn-primary">Chat</button>
      </div>
    </article>
  );
};

export default LawyerCard;

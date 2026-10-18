import { useEffect, useState } from "react";
import { getLawyers } from "../api/lawyerApi";

export const useLawyerDirectory = () => {
  const [lawyers, setLawyers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    const loadLawyers = async () => {
      try {
        const directory = await getLawyers();
        if (isCurrent) setLawyers(directory);
      } catch (loadError) {
        if (isCurrent) setError(loadError.message || "Failed to load lawyers.");
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    loadLawyers();
    return () => { isCurrent = false; };
  }, []);

  return { lawyers, error, loading };
};

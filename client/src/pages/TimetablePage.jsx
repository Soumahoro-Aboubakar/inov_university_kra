import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { api } from "../lib/api";
import { WeekGrid } from "../components/Timetable";
export default function TimetablePage() {
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const day = new Date();
    day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    api
      .get(`/dashboard/week?start=${day.toISOString()}`)
      .then(setSessions)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">VUE SEMAINE</p>
          <h1>Mon emploi du temps</h1>
          <p className="muted">
            Un affichage interactif, lisible et toujours à jour.
          </p>
        </div>
        <div className="exports">
          <button
            onClick={() =>
              api.download(
                "/exports/schedule?format=xlsx",
                "emploi-du-temps.xlsx",
              )
            }
          >
            <FileSpreadsheet size={17} /> Télécharger en Excel
          </button>
          <button
            onClick={() =>
              api.download(
                "/exports/schedule?format=pdf",
                "emploi-du-temps.pdf",
              )
            }
          >
            <FileText size={17} /> Télécharger en PDF
          </button>
        </div>
      </header>
      {error && <div className="alert error">{error}</div>}
      <WeekGrid sessions={sessions} />
      {!sessions.length && (
        <div className="empty">
          <Download size={25} />
          <p>Aucune séance publiée cette semaine.</p>
        </div>
      )}
    </div>
  );
}

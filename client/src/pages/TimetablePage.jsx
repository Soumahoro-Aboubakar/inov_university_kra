import { useEffect, useState } from "react";
import { CalendarClock, Download, FileSpreadsheet, FileText } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { WeekGrid } from "../components/Timetable";
import { formatDateInput, getWeekStart } from "../lib/scheduleUtils";

export default function TimetablePage() {
  const [searchParams] = useSearchParams();
  const initialDate = searchParams.get("date") || formatDateInput();
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchedDate, setSearchedDate] = useState(initialDate);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date(`${initialDate}T12:00:00`)));

  useEffect(() => {
    const day = new Date(weekStart);
    setLoading(true);
    setError("");
    api
      .get(`/dashboard/week?start=${encodeURIComponent(day.toISOString())}`)
      .then(setSessions)
      .catch((e) => {
        setSessions([]);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [weekStart]);

  const searchDate = (value) => {
    setError("");
    setSearchedDate(value);
    if (!value) return;
    setWeekStart(getWeekStart(new Date(`${value}T12:00:00`)));
  };

  const shiftWeek = (amount) => {
    const nextWeek = new Date(weekStart);
    nextWeek.setDate(nextWeek.getDate() + amount * 7);
    setWeekStart(nextWeek);
  };

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
        <label className="schedule-date-search">
          <span>Date recherchée</span>
          <input
            type="date"
            value={searchedDate}
            onChange={(event) => searchDate(event.target.value)}
            aria-label="Rechercher une semaine à partir d'une date"
          />
        </label>
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
      {loading ? <div className="schedule-loading" role="status" aria-live="polite">
        <span className="schedule-loading-icon"><CalendarClock size={32} /></span>
        <strong>Chargement des emplois du temps…</strong>
        <span>Récupération des séances de la semaine</span>
      </div> : !error && <WeekGrid
        sessions={sessions}
        weekStart={weekStart}
        highlightedDate={searchedDate}
        onWeekChange={shiftWeek}
      />}
      {!loading && !error && !sessions.length && (
        <div className="empty">
          <Download size={25} />
          <p>Aucun emploi du temps trouvé pour cette période.</p>
        </div>
      )}
    </div>
  );
}

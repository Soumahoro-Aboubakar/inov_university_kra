import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  PIXELS_PER_HOUR,
  getDayTimeline,
} from "../lib/scheduleUtils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";

const typeLabel = {
  course: "Cours",
  tutorial: "TD",
  lab: "TP",
  exam: "Examen",
  quiz: "Interrogation",
  other: "Autre",
};

const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export const when = (value) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(value));

export const clock = (value) =>
  new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export function WeekGrid({ sessions = [], weekStart: requestedWeekStart, highlightedDate, focusedSessionId, onSessionDoubleClick, onWeekChange }) {
  const focusedRef = useRef(null);
  const weekStart = new Date(requestedWeekStart || new Date());

  const dayColumns = Array.from({ length: 6 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return day;
  });

  const hourMarks = Array.from(
    { length: GRID_END_HOUR - GRID_START_HOUR + 1 },
    (_, index) => GRID_START_HOUR + index,
  );

  useEffect(() => {
    if (focusedSessionId) focusedRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [focusedSessionId, weekStart.toISOString()]);

  return (
    <>
      {onWeekChange && <div className="schedule-week-toolbar">
        <button type="button" className="secondary compact" onClick={() => onWeekChange(-1)} aria-label="Semaine précédente"><ChevronLeft size={16} /> Précédente</button>
        <strong>Semaine du {weekStart.getDate()}/{weekStart.getMonth() + 1} au {new Date(weekStart.getTime() + 5 * 86400000).getDate()}/{new Date(weekStart.getTime() + 5 * 86400000).getMonth() + 1}</strong>
        <button type="button" className="secondary compact" onClick={() => onWeekChange(1)} aria-label="Semaine suivante">Suivante <ChevronRight size={16} /></button>
      </div>}
      <div className="schedule-week-wrap">
      <div className="schedule-week-grid">
        <div className="schedule-axis-header">Heures</div>
        {dayColumns.map((day, index) => {
          const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
          const isHighlighted = dateKey === highlightedDate;
          return <div className={`schedule-day-header ${isHighlighted ? "highlighted" : ""}`} key={day.toISOString()}>
            <strong>{dayNames[index]}</strong>
            <span>
              {day.getDate()}/{day.getMonth() + 1}
            </span>
            {isHighlighted && <em>Date recherchée</em>}
          </div>;
        })}

        <div className="schedule-axis">
          {hourMarks.map((hour) => (
            <div className="schedule-hour-label" key={`axis-${hour}`}>
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {dayColumns.map((day) => {
          const timeline = getDayTimeline(sessions, day.toISOString());
          const height = (GRID_END_HOUR - GRID_START_HOUR + 1) * PIXELS_PER_HOUR;

          const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
          const isHighlighted = dateKey === highlightedDate;
          return (
            <div className={`schedule-day-column ${isHighlighted ? "highlighted" : ""}`} key={day.toISOString()}>
              <div className="schedule-day-timeline" style={{ height }}>
                {hourMarks.map((hour) => (
                  <div
                    className="schedule-grid-line"
                    key={`${day.toISOString()}-${hour}`}
                    style={{ top: `${(hour - GRID_START_HOUR) * PIXELS_PER_HOUR}px` }}
                  />
                ))}

                {timeline.blocks.map((block, index) => {
                  if (block.type === "pause") {
                    return (
                      <div
                        className="schedule-break"
                        key={`${day.toISOString()}-break-${index}`}
                        style={{
                          top: `${block.top}px`,
                          height: `${block.height}px`,
                        }}
                      >
                        Pause
                      </div>
                    );
                  }

                  const item = block.session;
                  const editable = Boolean(
                    onSessionDoubleClick
                    && item.canEdit
                    && !item.expired
                    && new Date(item.endsAt) > new Date(),
                  );

                  return (
                    <article
                      key={`${day.toISOString()}-session-${item?._id || index}`}
                      ref={item._id === focusedSessionId ? focusedRef : undefined}
                      className={`schedule-session ${item.type} ${editable ? "editable" : ""} ${item._id === focusedSessionId ? "focused" : ""}`}
                      style={{
                        top: `${block.top}px`,
                        height: `${block.height}px`,
                        cursor: editable ? "pointer" : "default",
                      }}
                      onDoubleClick={
                        editable ? () => onSessionDoubleClick(item) : undefined
                      }
                      role={editable ? "button" : undefined}
                      tabIndex={editable ? 0 : undefined}
                      onKeyDown={
                        editable
                          ? (e) => {
                              if (e.key === "Enter") onSessionDoubleClick(item);
                            }
                          : undefined
                      }
                      title={editable ? "Double-cliquez pour modifier" : item.expired ? "Ce créneau est expiré" : undefined}
                    >
                      <strong>{item.subjectName}</strong>
                      <span>
                        {block.startLabel} – {block.endLabel}
                      </span>
                      <span>
                        {item.room?.name} · {item.doctor?.firstName} {item.doctor?.lastName}
                      </span>
                      <em>{typeLabel[item.type] || item.type}</em>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </>
  );
}
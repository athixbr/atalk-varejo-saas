import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
  useCallback,
  useMemo,
} from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import {
  makeStyles,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Button,
} from "@material-ui/core";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import ChevronRightIcon from "@material-ui/icons/ChevronRight";
import TodayIcon from "@material-ui/icons/Today";
import AddIcon from "@material-ui/icons/Add";
import EditIcon from "@material-ui/icons/Edit";
import DeleteIcon from "@material-ui/icons/Delete";

import MainContainer from "../../components/MainContainer";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import ScheduleCalendarModal from "../../components/ScheduleCalendarModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import { socketConnection } from "../../services/socket";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";

// ─── Status config ───────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  PENDENTE: { label: "Pendente",  color: "#1976d2", bg: "#e3f2fd" },
  ENVIADA:  { label: "Enviada",   color: "#2e7d32", bg: "#e8f5e9" },
  ERRO:     { label: "Erro",      color: "#c62828", bg: "#ffebee" },
  default:  { label: "Agendado",  color: "#6a1b9a", bg: "#f3e5f5" },
};

function statusConf(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.default;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────
const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD":
      return action.payload;
    case "UPSERT": {
      const idx = state.findIndex((s) => s.id === action.payload.id);
      if (idx !== -1) { const n = [...state]; n[idx] = action.payload; return n; }
      return [action.payload, ...state];
    }
    case "DELETE":
      return state.filter((s) => s.id !== action.payload);
    case "RESET":
      return [];
    default:
      return state;
  }
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const useStyles = makeStyles((theme) => ({
  root: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: "#fff",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    borderBottom: "1px solid #e0e0e0",
    flexShrink: 0,
    background: "#fff",
  },
  topTitle: {
    fontWeight: 700,
    fontSize: 18,
    color: "#202124",
    minWidth: 180,
  },
  navBtn: {
    width: 32,
    height: 32,
    color: "#70757a",
  },
  todayBtn: {
    border: "1px solid #dadce0",
    borderRadius: 4,
    padding: "5px 12px",
    fontSize: 13,
    fontWeight: 500,
    color: "#3c4043",
    textTransform: "none",
    minWidth: "unset",
  },
  addBtn: {
    background: "#1a73e8",
    color: "#fff",
    borderRadius: 24,
    padding: "7px 18px",
    fontWeight: 600,
    fontSize: 13,
    textTransform: "none",
    marginLeft: "auto",
    "&:hover": { background: "#1558b0" },
  },
  calWrap: {
    flex: 1,
    overflow: "auto",
    padding: "0 0 16px 0",
  },
  weekRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    borderBottom: "1px solid #e0e0e0",
    flexShrink: 0,
  },
  weekDay: {
    textAlign: "center",
    padding: "8px 0",
    fontSize: 11,
    fontWeight: 600,
    color: "#70757a",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  daysGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gridAutoRows: "minmax(100px, 1fr)",
    borderLeft: "1px solid #e0e0e0",
  },
  dayCell: {
    borderRight: "1px solid #e0e0e0",
    borderBottom: "1px solid #e0e0e0",
    padding: "4px 4px 4px 4px",
    cursor: "pointer",
    minHeight: 100,
    "&:hover": { background: "#f8f9fa" },
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  dayCellOtherMonth: {
    background: "#fafafa",
  },
  dayNumber: {
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    fontSize: 13,
    fontWeight: 400,
    color: "#3c4043",
    flexShrink: 0,
    alignSelf: "flex-start",
    marginBottom: 2,
  },
  dayNumberToday: {
    background: "#1a73e8",
    color: "#fff",
    fontWeight: 700,
  },
  dayNumberOther: {
    color: "#bdbdbd",
  },
  eventChip: {
    fontSize: 11,
    height: 20,
    borderRadius: 4,
    cursor: "pointer",
    fontWeight: 500,
    justifyContent: "flex-start",
    width: "100%",
    marginBottom: 1,
    "& .MuiChip-label": {
      padding: "0 6px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
  moreCount: {
    fontSize: 11,
    color: "#70757a",
    paddingLeft: 4,
    cursor: "pointer",
    "&:hover": { textDecoration: "underline" },
  },
  // Day detail popover
  popover: {
    position: "fixed",
    zIndex: 1300,
    background: "#fff",
    border: "1px solid #e0e0e0",
    borderRadius: 8,
    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
    padding: "12px 0",
    minWidth: 260,
    maxWidth: 320,
  },
  popoverHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 12px 8px",
    borderBottom: "1px solid #f0f0f0",
  },
  popoverEvent: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: "8px 12px",
    "&:hover": { background: "#f8f9fa" },
    cursor: "pointer",
  },
  popoverDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
    marginTop: 3,
  },
}));

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getMonthLabel(date) {
  return date.toLocaleString("pt-BR", { month: "long", year: "numeric" });
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDaysGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

// ─── DayPopover ──────────────────────────────────────────────────────────────
function DayPopover({ anchorPos, events, day, onClose, onEdit, onDelete, onAdd }) {
  const classes = useStyles();
  if (!anchorPos) return null;

  const style = {
    top: Math.min(anchorPos.y, window.innerHeight - 380),
    left: Math.min(anchorPos.x, window.innerWidth - 340),
  };

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 1299 }}
        onClick={onClose}
      />
      <div className={classes.popover} style={style}>
        <div className={classes.popoverHeader}>
          <Typography style={{ fontSize: 14, fontWeight: 600 }}>
            {day.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
          </Typography>
          <Tooltip title="Novo agendamento neste dia">
            <IconButton size="small" onClick={onAdd}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
        {events.length === 0 && (
          <Typography style={{ fontSize: 13, color: "#9e9e9e", padding: "12px" }}>
            Nenhum agendamento
          </Typography>
        )}
        {events.map((ev) => {
          const sc = statusConf(ev.status);
          const time = new Date(ev.sendAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={ev.id} className={classes.popoverEvent}>
              <div className={classes.popoverDot} style={{ background: sc.color }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Typography style={{ fontSize: 13, fontWeight: 500, color: "#202124", lineHeight: 1.3 }} noWrap>
                  {ev.contact?.name}
                </Typography>
                <Typography style={{ fontSize: 11, color: "#70757a" }}>
                  {time} · {sc.label}
                </Typography>
                {ev.body && (
                  <Typography style={{ fontSize: 11, color: "#9e9e9e", marginTop: 2 }} noWrap>
                    {ev.body.substring(0, 60)}
                  </Typography>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <IconButton size="small" onClick={() => onEdit(ev)}>
                  <EditIcon style={{ fontSize: 14 }} />
                </IconButton>
                <IconButton size="small" onClick={() => onDelete(ev)}>
                  <DeleteIcon style={{ fontSize: 14, color: "#e53935" }} />
                </IconButton>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
const SchedulesCalendar = () => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const { getPlanCompany } = usePlans();

  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [schedules, dispatch] = useReducer(reducer, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [initialDate, setInitialDate] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [popover, setPopover] = useState(null); // { day, events, pos }

  // Plan check
  useEffect(() => {
    async function check() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useSchedules) {
        toast.error("Esta empresa não possui permissão para acessar esta página.");
        setTimeout(() => history.push("/"), 1000);
      }
    }
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch all schedules (pagination-free for calendar: load all)
  const fetchAll = useCallback(async () => {
    try {
      let page = 1;
      let all = [];
      while (true) {
        const { data } = await api.get("/schedules/", { params: { pageNumber: page } });
        all = [...all, ...data.schedules];
        if (!data.hasMore) break;
        page++;
      }
      dispatch({ type: "LOAD", payload: all });
    } catch (err) {
      toastError(err);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Socket
  useEffect(() => {
    const socket = socketConnection({ companyId: user.companyId });
    socket.on(`company${user.companyId}-schedule`, (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPSERT", payload: data.schedule });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE", payload: +data.scheduleId });
      }
    });
    return () => socket.disconnect();
  }, [user.companyId]);

  // Group by day
  const byDay = useMemo(() => {
    const map = {};
    schedules.forEach((s) => {
      const d = new Date(s.sendAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [schedules]);

  const getDayEvents = (d) => {
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return byDay[key] || [];
  };

  // Calendar navigation
  const prevMonth = () =>
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const goToday = () =>
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));

  const days = getDaysGrid(currentMonth.getFullYear(), currentMonth.getMonth());

  // Modal open
  const openCreate = (date) => {
    setSelectedSchedule(null);
    setInitialDate(date);
    setPopover(null);
    setModalOpen(true);
  };

  const openEdit = (schedule) => {
    setSelectedSchedule(schedule);
    setInitialDate(null);
    setPopover(null);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/schedules/${id}`);
      toast.success("Agendamento excluído.");
      dispatch({ type: "DELETE", payload: id });
    } catch (err) {
      toastError(err);
    }
    setDeletingId(null);
    setConfirmOpen(false);
    setPopover(null);
  };

  const handleDayClick = (day, e) => {
    const events = getDayEvents(day);
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({
      day,
      events,
      pos: { x: rect.left + 4, y: rect.bottom + 4 },
    });
  };

  return (
    <MainContainer>
      <Paper className={classes.root} elevation={0} square>

        {/* Top bar */}
        <div className={classes.topBar}>
          <Typography className={classes.topTitle}>
            {getMonthLabel(currentMonth).charAt(0).toUpperCase() +
              getMonthLabel(currentMonth).slice(1)}
          </Typography>

          <Tooltip title="Mês anterior">
            <IconButton className={classes.navBtn} size="small" onClick={prevMonth}>
              <ChevronLeftIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Próximo mês">
            <IconButton className={classes.navBtn} size="small" onClick={nextMonth}>
              <ChevronRightIcon />
            </IconButton>
          </Tooltip>

          <Button className={classes.todayBtn} onClick={goToday}>
            <TodayIcon style={{ fontSize: 16, marginRight: 4 }} />
            Hoje
          </Button>

          <Button
            className={classes.addBtn}
            startIcon={<AddIcon />}
            onClick={() => openCreate(new Date())}
          >
            Nova mensagem
          </Button>
        </div>

        {/* Calendar */}
        <div className={classes.calWrap}>
          {/* Week day headers */}
          <div className={classes.weekRow}>
            {WEEK_DAYS.map((d) => (
              <div key={d} className={classes.weekDay}>{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className={classes.daysGrid}>
            {days.map((day, idx) => {
              const isToday = sameDay(day, today);
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const events = getDayEvents(day);
              const visible = events.slice(0, 3);
              const extra = events.length - visible.length;

              return (
                <div
                  key={idx}
                  className={`${classes.dayCell} ${!isCurrentMonth ? classes.dayCellOtherMonth : ""}`}
                  onClick={(e) => handleDayClick(day, e)}
                >
                  <span
                    className={`${classes.dayNumber} ${isToday ? classes.dayNumberToday : ""} ${!isCurrentMonth ? classes.dayNumberOther : ""}`}
                  >
                    {day.getDate()}
                  </span>

                  {visible.map((ev) => {
                    const sc = statusConf(ev.status);
                    const time = new Date(ev.sendAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit", minute: "2-digit",
                    });
                    return (
                      <Chip
                        key={ev.id}
                        className={classes.eventChip}
                        label={`${time} ${ev.contact?.name || ""}`}
                        style={{
                          background: sc.bg,
                          color: sc.color,
                          borderLeft: `3px solid ${sc.color}`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(ev);
                        }}
                      />
                    );
                  })}

                  {extra > 0 && (
                    <Typography className={classes.moreCount}>
                      +{extra} mais
                    </Typography>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Paper>

      {/* Day popover */}
      {popover && (
        <DayPopover
          anchorPos={popover.pos}
          events={popover.events}
          day={popover.day}
          onClose={() => setPopover(null)}
          onEdit={openEdit}
          onDelete={(ev) => {
            setDeletingId(ev.id);
            setConfirmOpen(true);
          }}
          onAdd={() => openCreate(popover.day)}
        />
      )}

      {/* Create/edit modal */}
      <ScheduleCalendarModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        scheduleId={selectedSchedule?.id}
        initialDate={initialDate}
        reload={fetchAll}
      />

      {/* Confirm delete */}
      <ConfirmationModal
        title="Excluir agendamento"
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => handleDelete(deletingId)}
      >
        Tem certeza que deseja excluir este agendamento?
      </ConfirmationModal>
    </MainContainer>
  );
};

export default SchedulesCalendar;

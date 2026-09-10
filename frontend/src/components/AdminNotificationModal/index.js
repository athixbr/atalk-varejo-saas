import React, { useState, useEffect, useContext } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Chip
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import PictureAsPdfIcon from "@material-ui/icons/PictureAsPdf";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import moment from "moment";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import { socketConnection } from "../../services/socket";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  dialogTitle: {
    backgroundColor: theme.palette.primary.main,
    color: "#fff",
    fontWeight: "bold",
    paddingBottom: theme.spacing(2)
  },
  dialogContent: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    minHeight: 200,
    maxHeight: 500,
    overflow: "auto"
  },
  messageText: {
    whiteSpace: "pre-line",
    lineHeight: 1.6,
    marginBottom: theme.spacing(2),
    fontSize: "0.95rem"
  },
  metaInfo: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(1),
    borderTop: `1px solid ${theme.palette.divider}`
  },
  priorityChip: {
    marginRight: theme.spacing(1)
  },
  dialogActions: {
    padding: theme.spacing(2),
    justifyContent: "space-between"
  },
  dismissButton: {
    color: theme.palette.error.main
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200
  },
  mediaContainer: {
    marginBottom: theme.spacing(2),
    textAlign: "center",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    overflow: "hidden"
  },
  pdfLink: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    color: theme.palette.primary.main,
    textDecoration: "none",
    justifyContent: "center",
    "&:hover": {
      backgroundColor: theme.palette.action.hover
    }
  },
  fileLink: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    color: theme.palette.primary.main,
    textDecoration: "none",
    justifyContent: "center",
    "&:hover": {
      backgroundColor: theme.palette.action.hover
    }
  }
}));

const getMediaType = (mediaPath, mediaName) => {
  const url = mediaPath || "";
  const name = (mediaName || url).toLowerCase();

  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url) || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(name)) {
    return "image";
  }
  if (/\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i.test(url) || /\.(mp4|webm|ogg|mov|avi|mkv)$/.test(name)) {
    return "video";
  }
  if (/\.(mp3|wav|ogg|aac|flac)(\?|$)/i.test(url) || /\.(mp3|wav|ogg|aac|flac)$/.test(name)) {
    return "audio";
  }
  if (/\.pdf(\?|$)/i.test(url) || /\.pdf$/.test(name)) {
    return "pdf";
  }
  return "file";
};

const MediaRenderer = ({ mediaPath, mediaName }) => {
  const classes = useStyles();
  const type = getMediaType(mediaPath, mediaName);
  const displayName = mediaName || "Arquivo";

  if (type === "image") {
    return (
      <Box className={classes.mediaContainer}>
        <img
          src={mediaPath}
          alt="Notificação"
          style={{ maxWidth: "100%", maxHeight: 350, objectFit: "contain", display: "block", margin: "0 auto" }}
        />
      </Box>
    );
  }

  if (type === "video") {
    return (
      <Box className={classes.mediaContainer}>
        <video
          src={mediaPath}
          controls
          style={{ maxWidth: "100%", maxHeight: 350 }}
        />
      </Box>
    );
  }

  if (type === "audio") {
    return (
      <Box className={classes.mediaContainer} style={{ padding: 12 }}>
        <audio src={mediaPath} controls style={{ width: "100%" }} />
      </Box>
    );
  }

  if (type === "pdf") {
    return (
      <Box className={classes.mediaContainer}>
        <a href={mediaPath} target="_blank" rel="noopener noreferrer" className={classes.pdfLink}>
          <PictureAsPdfIcon color="error" />
          <Typography variant="body2">{displayName}</Typography>
        </a>
      </Box>
    );
  }

  return (
    <Box className={classes.mediaContainer}>
      <a href={mediaPath} target="_blank" rel="noopener noreferrer" className={classes.fileLink} download={displayName}>
        <AttachFileIcon />
        <Typography variant="body2">{displayName}</Typography>
      </a>
    </Box>
  );
};

const AdminNotificationModal = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadNotifications();

    if (user?.companyId) {
      const socket = socketConnection({ companyId: user.companyId, userId: user.id });

      socket.on(`user${user.id}-admin-notification`, (data) => {
        if (data.action === "new") {
          setNotifications((prev) => [data.record, ...prev]);
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [user]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/announcements/admin/notifications");

      const sorted = Array.isArray(data)
        ? data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        : [];

      setNotifications(sorted);
      setCurrentIndex(0);
    } catch (err) {
      toastError(err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const currentNotification = notifications[currentIndex];
  const isOpen = !!currentNotification && !loading;

  const removeCurrentAndAdvance = () => {
    setNotifications((prev) => {
      const updated = prev.filter((_, idx) => idx !== currentIndex);
      if (currentIndex >= updated.length && updated.length > 0) {
        setCurrentIndex(updated.length - 1);
      }
      return updated;
    });
  };

  const handleDismiss = async () => {
    if (!currentNotification) return;

    try {
      setActionLoading(true);
      await api.patch(`/announcements/${currentNotification.id}/dismiss`);
      removeCurrentAndAdvance();
    } catch (err) {
      toastError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkRead = async () => {
    if (!currentNotification) return;

    try {
      setActionLoading(true);
      await api.patch(`/announcements/${currentNotification.id}/read`);
      removeCurrentAndAdvance();
    } catch (err) {
      toastError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const getPriorityLabel = (priority) => {
    const labels = {
      1: { label: "Alta", color: "secondary" },
      2: { label: "Média", color: "default" },
      3: { label: "Baixa", color: "primary" }
    };
    return labels[priority] || { label: "Normal", color: "default" };
  };

  const priorityInfo = getPriorityLabel(currentNotification?.priority);

  return (
    <Dialog
      open={isOpen}
      onClose={handleDismiss}
      maxWidth="sm"
      fullWidth
      PaperProps={{ style: { borderRadius: "8px" } }}
    >
      <DialogTitle className={classes.dialogTitle}>
        {currentNotification?.title}
      </DialogTitle>

      <DialogContent className={classes.dialogContent}>
        {loading ? (
          <Box className={classes.loadingContainer}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Typography className={classes.messageText}>
              {currentNotification?.text}
            </Typography>

            {currentNotification?.mediaPath && (
              <MediaRenderer
                mediaPath={currentNotification.mediaPath}
                mediaName={currentNotification.mediaName}
              />
            )}

            <Box className={classes.metaInfo}>
              <Chip
                label={priorityInfo.label}
                color={priorityInfo.color}
                size="small"
                className={classes.priorityChip}
              />
              <Typography variant="caption" color="textSecondary">
                {moment(currentNotification?.createdAt).format("DD/MM/YYYY HH:mm")}
              </Typography>
            </Box>

            {notifications.length > 1 && (
              <Typography variant="caption" color="textSecondary" style={{ marginTop: 8, display: "block" }}>
                {currentIndex + 1} de {notifications.length} notificações
              </Typography>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions className={classes.dialogActions}>
        <Button
          onClick={handleDismiss}
          color="secondary"
          disabled={actionLoading}
          className={classes.dismissButton}
        >
          Fechar
        </Button>
        <Button
          onClick={handleMarkRead}
          color="primary"
          variant="contained"
          disabled={actionLoading}
        >
          {actionLoading ? <CircularProgress size={20} /> : "Marcar como Lida"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AdminNotificationModal;

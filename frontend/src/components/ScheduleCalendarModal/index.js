import React, { useState, useEffect, useContext, useRef } from "react";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  IconButton,
  Typography,
  Chip,
  Avatar,
  Divider,
  Tooltip,
  makeStyles,
} from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import CloseIcon from "@material-ui/icons/Close";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import FlashOnIcon from "@material-ui/icons/FlashOn";
import DeleteIcon from "@material-ui/icons/Delete";
import { isArray } from "lodash";
import moment from "moment";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  dialogTitle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderBottom: "1px solid #f0f0f0",
  },
  titleText: {
    fontWeight: 700,
    fontSize: 16,
    color: "#202124",
  },
  content: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minWidth: 480,
    [theme.breakpoints.down("sm")]: {
      minWidth: "unset",
    },
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#70757a",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  contactsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    padding: "8px 0",
  },
  contactChip: {
    borderRadius: 20,
    fontSize: 13,
  },
  messageArea: {
    fontSize: 14,
    fontFamily: "inherit",
  },
  quickMsgList: {
    maxHeight: 180,
    overflowY: "auto",
    border: "1px solid #e0e0e0",
    borderRadius: 6,
    background: "#fafafa",
  },
  quickMsgItem: {
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: 13,
    color: "#3c4043",
    "&:hover": { background: "#e8f0fe" },
    borderBottom: "1px solid #f0f0f0",
  },
  attachPreview: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: "#f1f3f4",
    borderRadius: 6,
    fontSize: 13,
    color: "#3c4043",
  },
  attachName: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  uploadBtn: {
    display: "none",
  },
  actions: {
    padding: "12px 20px",
    borderTop: "1px solid #f0f0f0",
    justifyContent: "space-between",
  },
  saveBtn: {
    background: "#1a73e8",
    color: "#fff",
    borderRadius: 20,
    padding: "7px 20px",
    fontWeight: 600,
    textTransform: "none",
    "&:hover": { background: "#1558b0" },
    "&:disabled": { opacity: 0.5 },
  },
  cancelBtn: {
    borderRadius: 20,
    padding: "7px 20px",
    fontWeight: 600,
    textTransform: "none",
    color: "#3c4043",
    border: "1px solid #dadce0",
  },
}));

const MAX_CONTACTS = 4;

const ScheduleCalendarModal = ({ open, onClose, scheduleId, initialDate, reload }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [body, setBody] = useState("");
  const [sendAt, setSendAt] = useState(
    moment().add(1, "hour").format("YYYY-MM-DDTHH:mm")
  );
  const [attachment, setAttachment] = useState(null); // { file, previewUrl, mediaUrl, mediaType }
  const [showQuickMsgs, setShowQuickMsgs] = useState(false);
  const [quickMessages, setQuickMessages] = useState([]);
  const [editingStatus, setEditingStatus] = useState("");

  // Load contacts + quick messages on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);

    const loadData = async () => {
      try {
        const [contactsRes, quickRes] = await Promise.all([
          api.get("/contacts/list", { params: { companyId: user.companyId } }),
          api.get("/quick-messages/list").catch(() => ({ data: [] })),
        ]);
        setContacts(
          (contactsRes.data || []).map((c) => ({ id: c.id, name: c.name, number: c.number }))
        );
        setQuickMessages(quickRes.data || []);

        if (scheduleId) {
          const { data } = await api.get(`/schedules/${scheduleId}`);
          setBody(data.body || "");
          setSendAt(moment(data.sendAt).format("YYYY-MM-DDTHH:mm"));
          setEditingStatus(data.status || "");
          setSelectedContacts(data.contact ? [{ id: data.contact.id, name: data.contact.name }] : []);
          if (data.mediaUrl) {
            setAttachment({ mediaUrl: data.mediaUrl, mediaType: data.mediaType, previewUrl: null, filename: data.mediaUrl.split("/").pop() });
          }
        } else {
          // Reset
          setBody("");
          setSelectedContacts([]);
          setAttachment(null);
          setEditingStatus("");
          if (initialDate) {
            setSendAt(moment(initialDate).hour(moment().hour() + 1).minute(0).format("YYYY-MM-DDTHH:mm"));
          } else {
            setSendAt(moment().add(1, "hour").format("YYYY-MM-DDTHH:mm"));
          }
        }
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scheduleId]);

  const handleClose = () => {
    setBody("");
    setSelectedContacts([]);
    setAttachment(null);
    setShowQuickMsgs(false);
    onClose();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAttachment({ file, previewUrl: URL.createObjectURL(file), filename: file.name, uploading: true });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const { data } = await api.post("/schedules/upload-media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAttachment((prev) => ({ ...prev, mediaUrl: data.mediaUrl, mediaType: data.mediaType, uploading: false }));
    } catch (err) {
      toastError(err);
      setAttachment(null);
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const applyQuickMessage = (msg) => {
    setBody(msg.message || msg.body || msg.shortcode || "");
    setShowQuickMsgs(false);
  };

  const handleSave = async () => {
    if (!body.trim() || body.trim().length < 5) {
      toast.error("A mensagem precisa ter pelo menos 5 caracteres.");
      return;
    }
    if (selectedContacts.length === 0 && !scheduleId) {
      toast.error("Selecione pelo menos 1 contato.");
      return;
    }
    if (!sendAt) {
      toast.error("Defina a data e hora de envio.");
      return;
    }
    if (attachment?.uploading) {
      toast.error("Aguarde o upload do anexo finalizar.");
      return;
    }

    setSaving(true);
    try {
      if (scheduleId) {
        // Edit single
        await api.put(`/schedules/${scheduleId}`, {
          body: body.trim(),
          sendAt,
          contactId: selectedContacts[0]?.id,
          userId: user.id,
          mediaUrl: attachment?.mediaUrl || null,
          mediaType: attachment?.mediaType || null,
        });
        toast.success("Agendamento atualizado!");
      } else {
        // Create one per contact
        for (const contact of selectedContacts) {
          await api.post("/schedules", {
            body: body.trim(),
            sendAt,
            contactId: contact.id,
            userId: user.id,
            mediaUrl: attachment?.mediaUrl || null,
            mediaType: attachment?.mediaType || null,
          });
        }
        toast.success(
          selectedContacts.length > 1
            ? `${selectedContacts.length} agendamentos criados!`
            : "Agendamento criado!"
        );
      }
      if (typeof reload === "function") reload();
      handleClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const alreadySent = editingStatus === "ENVIADA";

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <div className={classes.dialogTitle}>
        <Typography className={classes.titleText}>
          {scheduleId ? "Editar agendamento" : "Nova mensagem agendada"}
        </Typography>
        <IconButton size="small" onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>

      <DialogContent className={classes.content} dividers>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
            <CircularProgress />
          </div>
        ) : (
          <>
            {/* Contacts */}
            <div className={classes.section}>
              <Typography className={classes.label}>
                Contatos (até {MAX_CONTACTS})
                {!scheduleId && selectedContacts.length > 0 && (
                  <span style={{ color: "#1a73e8", fontWeight: 700, marginLeft: 6 }}>
                    {selectedContacts.length}/{MAX_CONTACTS}
                  </span>
                )}
              </Typography>
              <Autocomplete
                multiple
                options={contacts}
                getOptionLabel={(o) => `${o.name}${o.number ? ` (${o.number})` : ""}`}
                getOptionSelected={(o, v) => o.id === v.id}
                value={selectedContacts}
                onChange={(_, newVal) => {
                  if (newVal.length > MAX_CONTACTS) {
                    toast.warning(`Máximo de ${MAX_CONTACTS} contatos.`);
                    return;
                  }
                  // In edit mode, only allow 1
                  if (scheduleId && newVal.length > 1) return;
                  setSelectedContacts(newVal);
                }}
                disabled={alreadySent}
                filterSelectedOptions
                renderTags={(value, getTagProps) =>
                  value.map((opt, index) => (
                    <Chip
                      key={opt.id}
                      label={opt.name}
                      size="small"
                      avatar={<Avatar style={{ width: 20, height: 20, fontSize: 10 }}>{opt.name?.[0]}</Avatar>}
                      className={classes.contactChip}
                      {...getTagProps({ index })}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    variant="outlined"
                    size="small"
                    placeholder={selectedContacts.length === 0 ? "Buscar contato..." : ""}
                  />
                )}
              />
            </div>

            {/* Date/time */}
            <div className={classes.section}>
              <Typography className={classes.label}>Data e hora de envio</Typography>
              <TextField
                type="datetime-local"
                variant="outlined"
                size="small"
                value={sendAt}
                onChange={(e) => setSendAt(e.target.value)}
                disabled={alreadySent}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </div>

            {/* Message */}
            <div className={classes.section}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography className={classes.label}>Mensagem</Typography>
                {quickMessages.length > 0 && (
                  <Button
                    size="small"
                    startIcon={<FlashOnIcon style={{ fontSize: 14 }} />}
                    onClick={() => setShowQuickMsgs((v) => !v)}
                    style={{ fontSize: 11, textTransform: "none", color: "#1a73e8" }}
                  >
                    Mensagens rápidas
                  </Button>
                )}
              </div>

              {showQuickMsgs && (
                <div className={classes.quickMsgList}>
                  {quickMessages.map((qm) => (
                    <div
                      key={qm.id}
                      className={classes.quickMsgItem}
                      onClick={() => applyQuickMessage(qm)}
                    >
                      {qm.shortcode && (
                        <span style={{ color: "#1a73e8", fontWeight: 600, marginRight: 6 }}>
                          /{qm.shortcode}
                        </span>
                      )}
                      {(qm.message || qm.body || "").substring(0, 80)}
                    </div>
                  ))}
                </div>
              )}

              <TextField
                multiline
                rows={5}
                variant="outlined"
                size="small"
                fullWidth
                placeholder="Digite a mensagem que será enviada..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={alreadySent}
                className={classes.messageArea}
              />
              <Typography style={{ fontSize: 11, color: "#9e9e9e", textAlign: "right" }}>
                {body.length} caracteres
              </Typography>
            </div>

            <Divider />

            {/* Attachment */}
            <div className={classes.section}>
              <Typography className={classes.label}>Anexo (opcional)</Typography>

              {attachment ? (
                <div className={classes.attachPreview}>
                  <AttachFileIcon style={{ fontSize: 18, color: "#1a73e8" }} />
                  <Typography className={classes.attachName}>{attachment.filename}</Typography>
                  {attachment.uploading && <CircularProgress size={16} />}
                  {!alreadySent && (
                    <Tooltip title="Remover anexo">
                      <IconButton size="small" onClick={removeAttachment}>
                        <DeleteIcon style={{ fontSize: 16, color: "#e53935" }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </div>
              ) : (
                !alreadySent && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AttachFileIcon />}
                    style={{ textTransform: "none", borderStyle: "dashed", color: "#70757a", borderColor: "#dadce0" }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Adicionar arquivo
                  </Button>
                )
              )}

              <input
                ref={fileInputRef}
                type="file"
                className={classes.uploadBtn}
                onChange={handleFileSelect}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
              />
            </div>

            {alreadySent && (
              <Typography style={{ fontSize: 12, color: "#2e7d32", fontWeight: 500 }}>
                ✓ Esta mensagem já foi enviada e não pode ser editada.
              </Typography>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions className={classes.actions}>
        <Button className={classes.cancelBtn} onClick={handleClose}>
          Cancelar
        </Button>
        {!alreadySent && (
          <Button
            className={classes.saveBtn}
            onClick={handleSave}
            disabled={saving || loading || (attachment?.uploading)}
          >
            {saving ? <CircularProgress size={18} style={{ color: "#fff" }} /> : scheduleId ? "Salvar" : "Agendar"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ScheduleCalendarModal;

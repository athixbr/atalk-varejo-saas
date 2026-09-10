import React, { useState, useEffect, useContext, useRef } from "react";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Grid,
  Collapse,
} from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import { makeStyles } from "@material-ui/core/styles";
import DeleteIcon from "@material-ui/icons/Delete";
import EditIcon from "@material-ui/icons/Edit";
import AddIcon from "@material-ui/icons/Add";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import ScheduleIcon from "@material-ui/icons/Schedule";
import PeopleIcon from "@material-ui/icons/People";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import CancelIcon from "@material-ui/icons/Cancel";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import moment from "moment";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import { toast } from "react-toastify";
import MainHeader from "../../components/MainHeader";

const useStyles = makeStyles((theme) => ({
  container: {
    padding: theme.spacing(2),
  },
  card: {
    marginBottom: theme.spacing(2),
  },
  table: {
    minWidth: 750,
  },
  buttonContainer: {
    display: "flex",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  formContainer: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  chip: {
    margin: theme.spacing(0.5),
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "400px",
  },
  scheduledBadge: {
    backgroundColor: "#ff9800",
    color: "#fff",
    borderRadius: 4,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: "bold",
  },
  sentBadge: {
    backgroundColor: "#4caf50",
    color: "#fff",
    borderRadius: 4,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: "bold",
  },
  filePreview: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    backgroundColor: theme.palette.action.hover,
    borderRadius: 4,
    marginTop: theme.spacing(1),
  },
  trackingRow: {
    backgroundColor: "#f9f9f9",
  },
  trackingSection: {
    padding: theme.spacing(1, 2),
  },
  readUser: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
    fontSize: 12,
    color: "#4caf50",
  },
  dismissedUser: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
    fontSize: 12,
    color: "#f44336",
  },
}));

const AdminNotifications = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [users, setUsers] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    title: "",
    text: "",
    usuariosIds: [],
    departamentosIds: [],
    expirationDays: 0,
    scheduledAt: "",
    file: null,
    removeMedia: false,
  });

  useEffect(() => {
    loadNotifications();
    loadUsersAndDepartamentos();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/announcements/admin/list");
      const list = Array.isArray(data.records) ? data.records : [];
      setNotifications(list);
    } catch (error) {
      console.error("Erro ao carregar notificações:", error);
      toast.error("Erro ao carregar notificações");
      setNotifications([]);
    }
    setLoading(false);
  };

  const loadUsersAndDepartamentos = async () => {
    setLoadingData(true);
    try {
      const [usersRes, depRes] = await Promise.all([
        api.get("/users"),
        api.get("/departamentos"),
      ]);
      setUsers(usersRes.data.users || usersRes.data || []);
      setDepartamentos(depRes.data.departamentos || depRes.data || []);
    } catch (error) {
      toast.error("Erro ao carregar usuários e departamentos");
      console.error(error);
    }
    setLoadingData(false);
  };

  const handleOpenDialog = (notification = null) => {
    if (notification) {
      setFormData({
        title: notification.title || "",
        text: notification.text || "",
        usuariosIds: notification.usuariosIds || [],
        departamentosIds: notification.departamentosIds || [],
        expirationDays: 0,
        scheduledAt: notification.scheduledAt
          ? moment(notification.scheduledAt).format("YYYY-MM-DDTHH:mm")
          : "",
        file: null,
        removeMedia: false,
        existingMedia: notification.mediaPath || null,
        existingMediaName: notification.mediaName || null,
      });
      setEditingId(notification.id);
    } else {
      setFormData({
        title: "",
        text: "",
        usuariosIds: [],
        departamentosIds: [],
        expirationDays: 0,
        scheduledAt: "",
        file: null,
        removeMedia: false,
        existingMedia: null,
        existingMediaName: null,
      });
      setEditingId(null);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("Preencha o título");
      return;
    }
    if (!formData.text.trim()) {
      toast.error("Preencha a mensagem");
      return;
    }
    if (
      formData.usuariosIds.length === 0 &&
      formData.departamentosIds.length === 0
    ) {
      toast.error("Selecione pelo menos um usuário ou departamento");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("title", formData.title);
      fd.append("text", formData.text);
      fd.append("tipo", "admin_notification");
      fd.append("usuariosIds", JSON.stringify(formData.usuariosIds));
      fd.append("departamentosIds", JSON.stringify(formData.departamentosIds));
      fd.append("expirationDays", String(formData.expirationDays));
      fd.append(
        "scheduledAt",
        formData.scheduledAt
          ? new Date(formData.scheduledAt).toISOString()
          : ""
      );
      fd.append("typeArch", "announcements");

      if (formData.file) {
        fd.append("file", formData.file);
      }

      if (editingId) {
        if (formData.removeMedia) {
          fd.append("removeMedia", "true");
        }
        await api.put(`/announcements/${editingId}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Notificação atualizada com sucesso");
      } else {
        await api.post("/announcements", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Notificação criada com sucesso");
      }

      handleCloseDialog();
      loadNotifications();
    } catch (error) {
      toast.error(error.response?.data?.error || "Erro ao salvar notificação");
      console.error(error);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Tem certeza que deseja deletar esta notificação?")) {
      return;
    }

    setLoading(true);
    try {
      await api.delete(`/announcements/${id}`);
      toast.success("Notificação deletada com sucesso");
      loadNotifications();
    } catch (error) {
      toast.error("Erro ao deletar notificação");
      console.error(error);
    }
    setLoading(false);
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0] || null;
    setFormData((prev) => ({ ...prev, file, removeMedia: false }));
  };

  const handleRemoveMedia = () => {
    setFormData((prev) => ({
      ...prev,
      file: null,
      removeMedia: true,
      existingMedia: null,
      existingMediaName: null,
    }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getUserName = (id) => {
    if (id === 0) return "Todos os usuários";
    const u = users.find((u) => u.id === id);
    return u ? u.name : `Usuário ${id}`;
  };

  const getDepartamentoName = (id) => {
    const dep = departamentos.find((d) => d.id === id);
    return dep ? dep.nome || dep.name : `Departamento ${id}`;
  };

  const getStatus = (notification) => {
    const now = new Date();
    if (notification.scheduledAt && new Date(notification.scheduledAt) > now) {
      return "scheduled";
    }
    return "sent";
  };

  const toggleExpand = (id) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  if (!user || user.profile !== "admin") {
    return (
      <Box className={classes.container}>
        <Alert severity="error">
          Você não tem permissão para acessar esta página
        </Alert>
      </Box>
    );
  }

  return (
    <>
      <MainHeader />
      <Box className={classes.container}>
        <Card className={classes.card}>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Gestão de Avisos para Usuários
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Crie notificações que aparecem em modal para os usuários
              selecionados. O aviso aparece apenas uma vez — após lido ou
              fechado, fica salvo no banco e não volta a aparecer.
            </Typography>

            <Box className={classes.buttonContainer}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
              >
                Nova Notificação
              </Button>
            </Box>

            {loading && (
              <Box className={classes.loadingContainer}>
                <CircularProgress />
              </Box>
            )}

            {!loading && notifications.length === 0 ? (
              <Alert severity="info">Nenhuma notificação criada ainda</Alert>
            ) : (
              !loading && (
                <TableContainer component={Paper}>
                  <Table className={classes.table}>
                    <TableHead>
                      <TableRow style={{ backgroundColor: "#f5f5f5" }}>
                        <TableCell style={{ width: 32 }} />
                        <TableCell>Título</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Agendado / Criado</TableCell>
                        <TableCell>Destinatários</TableCell>
                        <TableCell>Expiração</TableCell>
                        <TableCell>Anexo</TableCell>
                        <TableCell align="right">Ações</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {notifications.map((notification) => {
                        const status = getStatus(notification);
                        const readCount = (notification.readByUsers || []).length;
                        const dismissCount = (notification.dismissedByUsers || []).length;
                        const isExpanded = expandedRow === notification.id;

                        return (
                          <React.Fragment key={notification.id}>
                            <TableRow>
                              <TableCell padding="checkbox">
                                <Tooltip title={isExpanded ? "Ocultar detalhes" : "Ver quem leu / fechou"}>
                                  <IconButton size="small" onClick={() => toggleExpand(notification.id)}>
                                    {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                              <TableCell>
                                <Tooltip title={notification.text || ""}>
                                  <span>
                                    {(notification.title || "Sem título").substring(0, 40)}
                                    {notification.title && notification.title.length > 40 ? "..." : ""}
                                  </span>
                                </Tooltip>
                              </TableCell>
                              <TableCell>
                                {status === "scheduled" ? (
                                  <span className={classes.scheduledBadge}>
                                    <ScheduleIcon style={{ fontSize: 12, marginRight: 2, verticalAlign: "middle" }} />
                                    Agendado
                                  </span>
                                ) : (
                                  <span className={classes.sentBadge}>Enviado</span>
                                )}
                                {(readCount > 0 || dismissCount > 0) && (
                                  <Box style={{ marginTop: 4, display: "flex", gap: 4 }}>
                                    {readCount > 0 && (
                                      <Tooltip title={`${readCount} leu(ram)`}>
                                        <Chip
                                          icon={<CheckCircleIcon style={{ fontSize: 12, color: "#4caf50" }} />}
                                          label={readCount}
                                          size="small"
                                          style={{ height: 18, fontSize: 10 }}
                                        />
                                      </Tooltip>
                                    )}
                                    {dismissCount > 0 && (
                                      <Tooltip title={`${dismissCount} fechou(aram)`}>
                                        <Chip
                                          icon={<CancelIcon style={{ fontSize: 12, color: "#f44336" }} />}
                                          label={dismissCount}
                                          size="small"
                                          style={{ height: 18, fontSize: 10 }}
                                        />
                                      </Tooltip>
                                    )}
                                  </Box>
                                )}
                              </TableCell>
                              <TableCell>
                                {notification.scheduledAt ? (
                                  <Tooltip title="Data de agendamento">
                                    <span>
                                      {moment(notification.scheduledAt).format("DD/MM/YYYY HH:mm")}
                                    </span>
                                  </Tooltip>
                                ) : (
                                  <Typography variant="caption" color="textSecondary">
                                    {moment(notification.createdAt).format("DD/MM/YYYY HH:mm")}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Box style={{ display: "flex", flexWrap: "wrap" }}>
                                  {notification.usuariosIds && notification.usuariosIds.length > 0 ? (
                                    <>
                                      {notification.usuariosIds.slice(0, 2).map((userId) => (
                                        <Chip
                                          key={userId}
                                          label={getUserName(userId)}
                                          size="small"
                                          className={classes.chip}
                                          icon={<PeopleIcon style={{ fontSize: 12 }} />}
                                        />
                                      ))}
                                      {notification.usuariosIds.length > 2 && (
                                        <Chip
                                          label={`+${notification.usuariosIds.length - 2}`}
                                          size="small"
                                          className={classes.chip}
                                        />
                                      )}
                                    </>
                                  ) : notification.departamentosIds && notification.departamentosIds.length > 0 ? (
                                    <>
                                      {notification.departamentosIds.slice(0, 2).map((depId) => (
                                        <Chip
                                          key={depId}
                                          label={getDepartamentoName(depId)}
                                          size="small"
                                          className={classes.chip}
                                        />
                                      ))}
                                      {notification.departamentosIds.length > 2 && (
                                        <Chip
                                          label={`+${notification.departamentosIds.length - 2}`}
                                          size="small"
                                          className={classes.chip}
                                        />
                                      )}
                                    </>
                                  ) : (
                                    <Typography variant="caption" color="textSecondary">-</Typography>
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell>
                                {notification.expiresAt
                                  ? moment(notification.expiresAt).format("DD/MM/YYYY")
                                  : <Typography variant="caption" color="textSecondary">Sem expiração</Typography>}
                              </TableCell>
                              <TableCell>
                                {notification.mediaPath ? (
                                  <Tooltip title={notification.mediaName || "Arquivo anexado"}>
                                    <AttachFileIcon fontSize="small" color="action" />
                                  </Tooltip>
                                ) : (
                                  <Typography variant="caption" color="textSecondary">-</Typography>
                                )}
                              </TableCell>
                              <TableCell align="right">
                                <Tooltip title="Editar">
                                  <IconButton size="small" onClick={() => handleOpenDialog(notification)}>
                                    <EditIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Deletar">
                                  <IconButton size="small" color="secondary" onClick={() => handleDelete(notification.id)}>
                                    <DeleteIcon />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>

                            {/* Linha de detalhes de leitura/fechamento */}
                            <TableRow className={classes.trackingRow}>
                              <TableCell colSpan={8} style={{ paddingTop: 0, paddingBottom: 0 }}>
                                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                  <Box className={classes.trackingSection}>
                                    <Grid container spacing={2}>
                                      <Grid item xs={6}>
                                        <Typography variant="caption" style={{ fontWeight: "bold", color: "#4caf50" }}>
                                          Marcaram como lido ({(notification.readByUsers || []).length})
                                        </Typography>
                                        {(notification.readByUsers || []).length === 0 ? (
                                          <Typography variant="caption" display="block" color="textSecondary">Nenhum ainda</Typography>
                                        ) : (
                                          (notification.readByUsers || []).map((item) => (
                                            <div key={item.userId} className={classes.readUser}>
                                              <CheckCircleIcon style={{ fontSize: 12 }} />
                                              {getUserName(item.userId)} — {moment(item.readAt).format("DD/MM/YY HH:mm")}
                                            </div>
                                          ))
                                        )}
                                      </Grid>
                                      <Grid item xs={6}>
                                        <Typography variant="caption" style={{ fontWeight: "bold", color: "#f44336" }}>
                                          Fecharam / Descartaram ({(notification.dismissedByUsers || []).length})
                                        </Typography>
                                        {(notification.dismissedByUsers || []).length === 0 ? (
                                          <Typography variant="caption" display="block" color="textSecondary">Nenhum ainda</Typography>
                                        ) : (
                                          (notification.dismissedByUsers || []).map((item) => (
                                            <div key={item.userId} className={classes.dismissedUser}>
                                              <CancelIcon style={{ fontSize: 12 }} />
                                              {getUserName(item.userId)} — {moment(item.dismissedAt).format("DD/MM/YY HH:mm")}
                                            </div>
                                          ))
                                        )}
                                      </Grid>
                                    </Grid>
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Dialog de Formulário */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingId ? "Editar Notificação" : "Nova Notificação"}
        </DialogTitle>
        <DialogContent>
          <Box className={classes.formContainer} style={{ marginTop: 16 }}>
            <TextField
              label="Título"
              fullWidth
              value={formData.title}
              onChange={(e) => handleFormChange("title", e.target.value)}
              placeholder="Ex: Parabéns! Você recebeu um bônus"
            />

            <TextField
              label="Mensagem"
              fullWidth
              multiline
              rows={4}
              value={formData.text}
              onChange={(e) => handleFormChange("text", e.target.value)}
              placeholder="Mensagem que será exibida para o usuário"
            />

            <FormControl fullWidth>
              <InputLabel>Usuários</InputLabel>
              <Select
                multiple
                value={formData.usuariosIds}
                onChange={(e) =>
                  handleFormChange(
                    "usuariosIds",
                    Array.isArray(e.target.value) ? e.target.value : [e.target.value]
                  )
                }
                renderValue={(selected) => (
                  <Box style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {selected.map((userId) => (
                      <Chip key={userId} label={getUserName(userId)} size="small" />
                    ))}
                  </Box>
                )}
              >
                <MenuItem key="all" value={0}>
                  <em>Todos os usuários</em>
                </MenuItem>
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Departamentos</InputLabel>
              <Select
                multiple
                value={formData.departamentosIds}
                onChange={(e) =>
                  handleFormChange(
                    "departamentosIds",
                    Array.isArray(e.target.value) ? e.target.value : [e.target.value]
                  )
                }
                renderValue={(selected) => (
                  <Box style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {selected.map((depId) => (
                      <Chip key={depId} label={getDepartamentoName(depId)} size="small" />
                    ))}
                  </Box>
                )}
              >
                {departamentos.map((dep) => (
                  <MenuItem key={dep.id} value={dep.id}>
                    {dep.name || dep.nome}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Agendar envio (data e hora)"
              type="datetime-local"
              fullWidth
              value={formData.scheduledAt}
              onChange={(e) => handleFormChange("scheduledAt", e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Deixe vazio para enviar imediatamente"
            />

            <FormControl fullWidth>
              <InputLabel>Expiração</InputLabel>
              <Select
                value={formData.expirationDays}
                onChange={(e) => handleFormChange("expirationDays", e.target.value)}
              >
                <MenuItem value={0}>Sem expiração</MenuItem>
                <MenuItem value={1}>1 dia</MenuItem>
                <MenuItem value={3}>3 dias</MenuItem>
                <MenuItem value={7}>7 dias</MenuItem>
                <MenuItem value={15}>15 dias</MenuItem>
                <MenuItem value={30}>30 dias</MenuItem>
              </Select>
            </FormControl>

            {/* Upload de arquivo */}
            <Box>
              <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
                Anexo (imagem, vídeo, PDF ou qualquer formato)
              </Typography>

              {formData.existingMedia && !formData.removeMedia && (
                <Box className={classes.filePreview}>
                  <AttachFileIcon fontSize="small" />
                  <Typography variant="caption" style={{ flex: 1 }}>
                    {formData.existingMediaName || "Arquivo atual"}
                  </Typography>
                  <Button size="small" color="secondary" onClick={handleRemoveMedia}>
                    Remover
                  </Button>
                </Box>
              )}

              {formData.file && (
                <Box className={classes.filePreview}>
                  <AttachFileIcon fontSize="small" />
                  <Typography variant="caption" style={{ flex: 1 }}>
                    {formData.file.name} ({(formData.file.size / 1024 / 1024).toFixed(2)} MB)
                  </Typography>
                  <Button
                    size="small"
                    color="secondary"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, file: null }));
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Remover
                  </Button>
                </Box>
              )}

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept="*/*"
                onChange={handleFileChange}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<AttachFileIcon />}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                style={{ marginTop: 8 }}
              >
                {formData.existingMedia && !formData.removeMedia ? "Substituir arquivo" : "Escolher arquivo"}
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button
            onClick={handleSave}
            color="primary"
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AdminNotifications;

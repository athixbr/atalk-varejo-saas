import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import SearchIcon from "@material-ui/icons/Search";
import { Add, Clear, ClearAllRounded, DoneAll, Facebook, Group, Instagram, OfflineBolt, WhatsApp, CallMerge, Close } from "@material-ui/icons";
import InputBase from "@material-ui/core/InputBase";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Badge from "@material-ui/core/Badge";
import MoveToInboxIcon from "@material-ui/icons/MoveToInbox";
import CheckBoxIcon from "@material-ui/icons/CheckBox";
import MessageSharpIcon from "@material-ui/icons/MessageSharp";
import ClockIcon from "@material-ui/icons/AccessTime";
import IconButton from '@material-ui/core/IconButton';

import FilterListIcon from '@material-ui/icons/FilterList';

import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid"

import NewTicketModal from "../NewTicketModal";
import MergeTicketModal from "../MergeTicketModal";
import TicketsList from "../TicketsListCustom";
import TabPanel from "../TabPanel";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../Can";
import TicketsQueueSelect from "../TicketsQueueSelect";

import { TagsFilter } from "../TagsFilter";
import { UsersFilter } from "../UsersFilter";
import { StatusFilter } from "../StatusFilter";
import { WhatsappsFilter } from "../WhatsappsFilter";
import api from "../../services/api";
import { Button, Snackbar, TextField, Tooltip, Chip } from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import { SpeedDial, SpeedDialAction } from "@mui/material";
import { QueueSelectedContext } from "../../context/QueuesSelected/QueuesSelectedContext";

const useStyles = makeStyles((theme) => ({
  ticketsWrapper: {
    position: "relative",
    display: "flex",
    height: "100%",
    flexDirection: "column",
    overflow: "hidden",
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },

  tabsHeader: {
    flex: "none",
    // backgroundColor: "#eee",
    backgroundColor: theme.palette.tabHeaderBackground,
  },

  settingsIcon: {
    alignSelf: "center",
    marginLeft: "auto",
    padding: 8,
  },

  tab: {
    minWidth: 120,
    width: 120,
  },

  snackbar: {
    backgroundColor: theme.palette.primary.main,
    color: 'white',
    borderRadius: 30,
  },

  yesButton: {
    backgroundColor: '#FFF',
    color: 'rgba(0, 100, 0, 1)',
    padding: '4px 4px',
    fontSize: '1em',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginRight: theme.spacing(1),
    '&:hover': {
      backgroundColor: 'darkGreen',
      color: '#FFF',
    },
    borderRadius: 30,
  },
  noButton: {
    backgroundColor: '#FFF',
    color: 'rgba(139, 0, 0, 1)',
    padding: '4px 4px',
    fontSize: '1em',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    '&:hover': {
      backgroundColor: 'darkRed',
      color: '#FFF',
    },
    borderRadius: 30,
  },

  tabPanelItem: {
    minWidth: 120,
    fontSize: 11,
    marginLeft: 0,
  },

  ticketOptionsBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    // background: "#fafafa",
    background: theme.palette.optionsBackground,
    padding: theme.spacing(1),
  },

  serachInputWrapper: {
    flex: 1,
    // background: "#fff",
    background: theme.palette.total,
    display: "flex",
    borderRadius: 40,
    padding: 4,
    marginRight: theme.spacing(1),
  },

  searchIcon: {
    color: "grey",
    marginLeft: 6,
    marginRight: 6,
    alignSelf: "center",
  },

  searchInput: {
    flex: 1,
    border: "none",
    borderRadius: 30,
  },

  badge: {
    // right: "-10px",
  },

  customBadge: {
    right: "-10px",
    backgroundColor: "#f44336",
    color: "#fff",
  },

  show: {
    display: "block",
  },

  hide: {
    display: "none !important",
  },

  speedDial: {
    position: 'absolute',
    bottom: theme.spacing(1),
    right: theme.spacing(1),
  },
  mergeBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: "linear-gradient(90deg, #e3f2fd 0%, #fce4ec 100%)",
    borderBottom: "2px solid #90caf9",
    flexShrink: 0,
    flexWrap: "wrap",
  },
  mergeBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#1565c0",
    fontWeight: 600,
  },
  mergeModeButton: {
    padding: 6,
  },
}));

const TicketsManagerTabs = () => {
  const classes = useStyles();
  const history = useHistory();
  const location = useLocation();

  const [searchParam, setSearchParam] = useState("");
  const [tab, setTab] = useState("open");
  const [tabOpen, setTabOpen] = useState("open");
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const searchInputRef = useRef();
  const { user } = useContext(AuthContext);
  const { profile } = user;

  const [openCount, setOpenCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [groupingCount, setGroupingCount] = useState(0);

  const userQueueIds = user.queues.map((q) => q.id);
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedWhatsapp, setSelectedWhatsapp] = useState([]);
  const [forceSearch, setForceSearch] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [filter, setFilter] = useState(false);
  // const [open, setOpen] = useState(false);
  // const [hidden, setHidden] = useState(false);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState([]);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  const { setSelectedQueuesMessage } = useContext(QueueSelectedContext);

  const [viewAsUser, setViewAsUser] = useState(null);
  const [usersList, setUsersList] = useState([]);

  // Memoizado para não criar novo array a cada render (evita loop de reset no TicketsListCustom)
  const viewAsUsersFilter = useMemo(
    () => viewAsUser ? [viewAsUser.id] : undefined,
    [viewAsUser]
  );

  useEffect(() => {
    if (user.profile.toUpperCase() === "ADMIN") {
      setShowAllTickets(true);
      api.get("/users/list").then(({ data }) => {
        const list = data.users || data;
        if (Array.isArray(list)) setUsersList(list.map(u => ({ id: u.id, name: u.name })));
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSelectedQueuesMessage(selectedQueueIds);
  }, []);
  // }, [selectedQueueIds]);

  useEffect(() => {
    if (tab === "search") {
      searchInputRef.current.focus();
    }
  }, [tab]);

  useEffect(() => {
    const handleTicketTransferred = () => {
      setForceSearch(prev => prev + 1);
    };
    window.addEventListener('ticket:transferred', handleTicketTransferred);
    return () => {
      window.removeEventListener('ticket:transferred', handleTicketTransferred);
    };
  }, []);

  // Detectar parâmetros na URL e aplicar filtros automáticos
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const contactId = params.get('contactId');
    const autoOpen = params.get('autoOpen');
    const tabParam = params.get('tab');

    if (contactId && autoOpen === 'true') {
      handleOpenContactTicket(contactId);
      history.replace('/tickets');
      return;
    }

    const validTabs = ['open', 'pending', 'closed'];
    if (tabParam && validTabs.includes(tabParam)) {
      setTab(tabParam);
      history.replace('/tickets');
    }
  }, [location.search]);

  const handleOpenContactTicket = async (contactId) => {
    try {
      // Buscar tickets abertos do contato
      const { data } = await api.get(`/tickets`, {
        params: {
          contactId: contactId,
          status: 'open',
          pageNumber: 1
        }
      });

      if (data.tickets && data.tickets.length > 0) {
        // Se existe ticket aberto, navegar para ele
        const ticket = data.tickets[0];
        history.push(`/tickets/${ticket.id}`);
      } else {
        // Se não existe ticket aberto, abrir modal de novo ticket com contato pré-selecionado
        setNewTicketModalOpen(true);
        // Você pode adicionar lógica para pré-selecionar o contato no modal
        // Isso depende de como o NewTicketModal está estruturado
      }
    } catch (error) {
      console.error("Erro ao buscar ticket do contato:", error);
      // Se houver erro, apenas abrir modal de novo ticket
      setNewTicketModalOpen(true);
    }
  };


  let searchTimeout;

  const handleSearch = e => {
    const searchedTerm = e.target.value.toLowerCase();

    clearTimeout(searchTimeout);

    if (searchedTerm === "") {
      setSearchParam(searchedTerm);
      setTab("open");
      return;
    }

    setTab("search");
    searchTimeout = setTimeout(() => {
      setSearchParam(searchedTerm);
    }, 500);
  };

  const handleClearSearch = () => {
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
    }
    setSearchParam("");
    setTab("open");
  };

  // const handleBack = React.useCallback(() => {
  //   history.push("/tickets");
  // },[history]);

  const handleSnackbarOpen = React.useCallback(() => {
    setSnackbarOpen(true);
  }, []);

  const handleSnackbarClose = React.useCallback(() => {
    setSnackbarOpen(false);
  }, []);

  const handleChangeTab = (e, newValue) => {
    setTab(newValue);
  };

  const handleChangeTabOpen = (e, newValue) => {
    setTabOpen(newValue);
  };

  const applyPanelStyle = status => {
    if (tabOpen !== status) {
      return { width: 0, height: 0 };
    }
  };

  const CloseAllTicket = async () => {
    try {
      const { data } = await api.post("/tickets/closeAll", { status: tabOpen, queueIds: selectedQueueIds });
      handleSnackbarClose();
    } catch (err) {
      console.log("Error: ", err);
    }
  };


  // const handleVisibility = () => {
  //   setHidden((prevHidden) => !prevHidden);
  // };

  // const handleOpen = () => {
  //   setOpen(true);
  // };

  // const handleClosed = () => {
  //   setOpen(false);
  // };

  const tooltipTitleStyle = {
    fontSize: '10px'
  };

  const handleMergeSelect = (ticket) => {
    if (!mergeMode) setMergeMode(true);
    setSelectedForMerge(prev => {
      const already = prev.some(t => t.id === ticket.id);
      if (already) return prev.filter(t => t.id !== ticket.id);
      const next = [...prev, ticket];
      if (next.length === 2) {
        setMergeModalOpen(true);
      }
      return next.slice(0, 2);
    });
  };

  const handleCancelMergeMode = () => {
    setMergeMode(false);
    setSelectedForMerge([]);
  };

  const handleMergeSuccess = () => {
    setSelectedForMerge([]);
    setMergeModalOpen(false);
    setMergeMode(false);
  };

  const handleCloseOrOpenTicket = ticket => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleSelectedTags = selecteds => {
    const tags = selecteds.map(t => t.id);
    setSelectedTags(tags);
  };

  const handleSelectedUsers = (selecteds) => {
    const users = selecteds.map(t => t.id);
    setSelectedUsers(users);
  };

  const handleSelectedWhatsapps = (selecteds) => {
    const whatsapp = selecteds.map((t) => t.id);
    setSelectedWhatsapp(whatsapp);
  };

  const handleSelectedStatus = (selecteds) => {
    const statusFilter = selecteds.map((t) => t.status);

    setSelectedStatus(statusFilter);
  };

  const handleFilter = () => {
    if (filter) {
      setFilter(false);
      setTab("open")
    }
    else
      setFilter(true);
    setTab("search")
  };

  return (
    <Paper
      elevation={0}
      variant="outlined"
      className={classes.ticketsWrapper}
    >
      <Snackbar
        open={snackbarOpen}
        onClose={handleSnackbarClose}
        message={i18n.t("ticketsManager.questionCloseTicket")}
        ContentProps={{
          className: classes.snackbar,
        }}
        action={
          <>
            <Button className={classes.yesButton} size="small" onClick={CloseAllTicket}>
              {i18n.t("ticketsManager.yes")}
            </Button>
            <Button className={classes.noButton} size="small" onClick={handleSnackbarClose}>
              {i18n.t("ticketsManager.not")}
            </Button>
          </>
        }
      />

      <NewTicketModal
        modalOpen={newTicketModalOpen}
        onClose={(ticket) => {
          handleCloseOrOpenTicket(ticket);
        }}
      />
      <MergeTicketModal
        open={mergeModalOpen}
        onClose={() => { setMergeModalOpen(false); setSelectedForMerge([]); }}
        ticketA={selectedForMerge[0]}
        ticketB={selectedForMerge[1]}
        onMergeSuccess={handleMergeSuccess}
      />
      <div className={classes.serachInputWrapper}>
        <SearchIcon className={classes.searchIcon} />
        <InputBase
          className={classes.searchInput}
          inputRef={searchInputRef}
          placeholder={i18n.t("tickets.search.placeholder")}
          type="text"
          onChange={handleSearch}
        />
        {searchParam && (
          <IconButton
            size="small"
            aria-label="limpar pesquisa"
            onClick={handleClearSearch}
            style={{ padding: 4, color: "grey" }}
          >
            <Clear fontSize="small" />
          </IconButton>
        )}
        <IconButton color="primary"
          aria-label="upload picture"
          component="span"
          onClick={handleFilter}
        >
          <FilterListIcon />
        </IconButton>
      </div>

      {filter === true && (
        <>
       
          <TagsFilter onFiltered={handleSelectedTags} />
          <WhatsappsFilter onFiltered={handleSelectedWhatsapps} />
          <StatusFilter onFiltered={handleSelectedStatus} />
          {profile === "admin" && (
            <>
              <UsersFilter onFiltered={handleSelectedUsers} />
            </>
          )}
        </>
      )}

      <Paper elevation={0} square className={classes.tabsHeader}>
        <Tabs
          value={tab}
          onChange={handleChangeTab}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
          aria-label="icon label tabs example"
        >
          <Tab
            value={"open"}
            icon={<MoveToInboxIcon />}
            label={i18n.t("tickets.tabs.open.title")}
            classes={{ root: classes.tab }}
          />
          <Tab
            value={"closed"}
            icon={<CheckBoxIcon />}
            label={i18n.t("tickets.tabs.closed.title")}
            classes={{ root: classes.tab }}
          />
          <Tab
            value={"search"}
            icon={<SearchIcon />}
            label={i18n.t("tickets.tabs.search.title")}
            classes={{ root: classes.tab }}
          />
        </Tabs>
      </Paper>
      <Paper square elevation={0} className={classes.ticketOptionsBox}>
        <>
          <Can
            role={user.profile}
            perform="tickets-manager:showall"
            yes={() => (
              <FormControlLabel
                label={i18n.t("tickets.buttons.showAll")}
                labelPlacement="start"
                control={
                  <Switch
                    size="small"
                    checked={showAllTickets}
                    onChange={() =>
                      setShowAllTickets((prevState) => !prevState)
                    }
                    name="showAllTickets"
                    color="primary"
                  />
                }
              />
            )}
          />
        </>
        {profile === "admin" && (
          <Autocomplete
            size="small"
            style={{ minWidth: 160, flex: 1, maxWidth: 200, margin: "0 6px" }}
            options={usersList}
            value={viewAsUser}
            onChange={(e, v) => setViewAsUser(v)}
            getOptionLabel={(o) => o.name}
            getOptionSelected={(o, v) => o.id === v.id}
            clearOnBlur={false}
            blurOnSelect={false}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                placeholder="Atendente..."
                size="small"
                InputProps={{
                  ...params.InputProps,
                  style: { fontSize: 12, padding: "1px 4px" },
                }}
              />
            )}
          />
        )}
        <TicketsQueueSelect
          style={{ marginLeft: 6 }}
          selectedQueueIds={selectedQueueIds}
          userQueues={user?.queues}
          onChange={(values) => {
            setSelectedQueueIds(values);
            //history.push("/tickets");
          }}
        />
        <Tooltip title={mergeMode ? "Cancelar modo agrupar" : "Ativar modo agrupar tickets"}>
          <IconButton
            size="small"
            className={classes.mergeModeButton}
            onClick={mergeMode ? handleCancelMergeMode : () => setMergeMode(true)}
            style={{ color: mergeMode ? "#1976d2" : "grey", marginLeft: 4 }}
          >
            <CallMerge fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>
      <TabPanel
        value={tab}
        name="open"
        className={classes.ticketsWrapper}
      >
        <Tabs
          value={tabOpen}
          onChange={handleChangeTabOpen}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >

          {/* ATENDENDO */}
          <Tab
            label={
              <Grid container alignItems="center" justifyContent="center">
                <Grid item>
                  <Badge
                    overlap="rectangular"
                    className={classes.badge}
                    badgeContent={openCount}
                    color="primary"
                  >
                    <MessageSharpIcon
                      style={{
                        fontSize: 18,
                      }}
                    />
                  </Badge>
                </Grid>
                <Grid item>
                  <Typography
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    {i18n.t("ticketsList.assignedHeader")}
                  </Typography>
                </Grid>
              </Grid>
            }
            value={"open"}
            classes={{ root: classes.tabPanelItem }}
          />

          {/* AGUARDANDO */}
          <Tab
            label={
              <Grid container alignItems="center" justifyContent="center">
                <Grid item>
                  <Badge
                    overlap="rectangular"
                    classes={{ badge: classes.customBadge }}
                    badgeContent={pendingCount}
                    color="primary"
                  >
                    <ClockIcon
                      style={{
                        fontSize: 18,
                      }}
                    />
                  </Badge>
                </Grid>
                <Grid item>
                  <Typography
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    {i18n.t("ticketsList.pendingHeader")}
                  </Typography>
                </Grid>
              </Grid>
            }
            value={"pending"}
            classes={{ root: classes.tabPanelItem }}
          />

          {/* GRUPOS */}
          <Tab
            label={
              <Grid container alignItems="center" justifyContent="center">
                <Grid item>
                  <Badge
                    overlap="rectangular"
                    classes={{ badge: classes.customBadge }}
                    badgeContent={groupingCount}
                    color="primary"
                  >
                    <Group
                      style={{
                        fontSize: 18,
                      }}
                    />
                  </Badge>
                </Grid>
                <Grid item>
                  <Typography
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    {i18n.t("ticketsList.groupingHeader")}
                  </Typography>
                </Grid>
              </Grid>
            }
            value={"group"}
            classes={{ root: classes.tabPanelItem }}
          />
        </Tabs>

        {mergeMode && (
          <div className={classes.mergeBanner}>
            <CallMerge style={{ color: "#1976d2", fontSize: 20 }} />
            <span className={classes.mergeBannerText}>
              {selectedForMerge.length === 0
                ? "Modo agrupar ativo — clique no 1º ticket"
                : `1 ticket selecionado — clique no 2º ticket para agrupar`}
            </span>
            <Chip
              label={`${selectedForMerge.length}/2`}
              size="small"
              color="primary"
              style={{ fontWeight: 700, fontSize: 12 }}
            />
            <Tooltip title="Cancelar modo agrupar">
              <IconButton size="small" onClick={handleCancelMergeMode} style={{ padding: 4 }}>
                <Close fontSize="small" style={{ color: "#1565c0" }} />
              </IconButton>
            </Tooltip>
          </div>
        )}

        <Paper className={classes.ticketsWrapper}>
          <TicketsList
            status="open"
            showAll={viewAsUsersFilter ? true : showAllTickets}
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setOpenCount(val)}
            style={applyPanelStyle("open")}
            forceSearch={forceSearch}
            selectedForMerge={selectedForMerge}
            onMergeSelect={handleMergeSelect}
            mergeMode={mergeMode}
            users={viewAsUsersFilter}
          />
          <TicketsList
            status="pending"
            selectedQueueIds={selectedQueueIds}
            showAll={viewAsUser ? true : (user.profile === "admin" ? showAllTickets : false)}
            updateCount={(val) => setPendingCount(val)}
            style={applyPanelStyle("pending")}
            forceSearch={forceSearch}
            selectedForMerge={selectedForMerge}
            onMergeSelect={handleMergeSelect}
            mergeMode={mergeMode}
            users={viewAsUsersFilter}
          />
          <TicketsList
            status="group"
            showAll={viewAsUsersFilter ? true : showAllTickets}
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setGroupingCount(val)}
            style={applyPanelStyle("group")}
            forceSearch={forceSearch}
            selectedForMerge={selectedForMerge}
            onMergeSelect={handleMergeSelect}
            mergeMode={mergeMode}
            users={viewAsUsersFilter}
          />
        </Paper>
      </TabPanel>
      <TabPanel value={tab} name="closed" className={classes.ticketsWrapper}>
        <TicketsList
          status="closed"
          showAll={viewAsUsersFilter ? true : showAllTickets}
          selectedQueueIds={selectedQueueIds}
          users={viewAsUsersFilter}
        // handleChangeTab={handleChangeTabOpen}
        />
      </TabPanel>
      <TabPanel value={tab} name="search" className={classes.ticketsWrapper}>
        {profile === "admin" && (
          <>
            <TicketsList
              statusFilter={selectedStatus}
              searchParam={searchParam}
              showAll={showAllTickets}
              tags={selectedTags}
              users={selectedUsers}
              selectedQueueIds={selectedQueueIds}
              whatsappIds={selectedWhatsapp}
              forceSearch={true}
              status="search"
            />
          </>
        )}

        {profile === "user" && (
          <TicketsList
            statusFilter={selectedStatus}
            searchParam={searchParam}
            showAll={false}
            tags={selectedTags}
            selectedQueueIds={selectedQueueIds}
            whatsappIds={selectedWhatsapp}
            forceSearch={true}
            status="search"
          />
        )}
      </TabPanel>
    </Paper>
  );
};

export default TicketsManagerTabs;

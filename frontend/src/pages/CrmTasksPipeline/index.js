import React, { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import CRMSettings from "../CRM/Settings";
import LeadsBoard from "./LeadsBoard";
import TasksBoard from "./TasksBoard";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  tabs: {
    marginBottom: theme.spacing(2),
  },
}));

const CrmTasksPipeline = () => {
  const classes = useStyles();
  const [tabValue, setTabValue] = useState(0);

  return (
    <MainContainer>
      <MainHeader>
        <Title>Pipeline CRM</Title>
      </MainHeader>
      <Paper className={classes.mainPaper} variant="outlined">
        <Paper className={classes.tabs} elevation={0}>
          <Tabs
            value={tabValue}
            onChange={(e, newValue) => setTabValue(newValue)}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label="Leads" />
            <Tab label="Tarefas" />
            <Tab label="Configurações" />
          </Tabs>
        </Paper>

        {tabValue === 0 && <LeadsBoard />}
        {tabValue === 1 && <TasksBoard />}
        {tabValue === 2 && <CRMSettings />}
      </Paper>
    </MainContainer>
  );
};

export default CrmTasksPipeline;

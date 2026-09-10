import React from "react";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(() => ({
  wrapper: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    width: "100%",
    overflow: "hidden",
  },
  iframe: {
    flex: 1,
    border: "none",
    width: "100%",
    height: "100%",
  },
}));

const SpedFiscal = () => {
  const classes = useStyles();

  return (
    <div className={classes.wrapper}>
      <iframe
        className={classes.iframe}
        src="/sped/"
        title="SPED Fiscal"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
};

export default SpedFiscal;

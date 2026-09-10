import React from "react";
import { useParams, useLocation, useHistory } from "react-router-dom";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import { makeStyles } from "@material-ui/core/styles";
import { Hidden, Chip, Tooltip } from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import CloseIcon from "@material-ui/icons/Close";

import TicketsManager from "../../components/TicketsManagerTabs/";
import Ticket from "../../components/Ticket/";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
	chatContainer: {
		flex: 1,
		padding: "2px",
		height: `calc(100% - 48px)`,
		overflowY: "hidden",
	},
	chatPapper: {
		display: "flex",
		height: "100%",
	},
	contactsWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
		overflowY: "hidden",
	},
	messagesWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
	},
	welcomeMsg: {
		background: theme.palette.tabHeaderBackground,
		display: "flex",
		justifyContent: "space-evenly",
		alignItems: "center",
		height: "100%",
		textAlign: "center",
	},
	searchBanner: {
		display: "flex",
		alignItems: "center",
		gap: 8,
		padding: "6px 12px",
		background: "linear-gradient(90deg, #e3f2fd 0%, #e8f5e9 100%)",
		borderBottom: "1px solid #bbdefb",
		flexShrink: 0,
		flexWrap: "wrap",
	},
	searchBannerIcon: {
		color: "#1565c0",
		fontSize: 18,
	},
	searchBannerText: {
		fontSize: 13,
		color: "#1565c0",
		fontWeight: 500,
		flex: 1,
	},
	searchBannerTerm: {
		background: "#fff9c4",
		borderRadius: 4,
		padding: "1px 6px",
		fontWeight: 700,
		color: "#f57f17",
		fontSize: 13,
	},
}));

const SearchBanner = ({ searchTerm, searchPath, onDismiss }) => {
	const classes = useStyles();
	const history = useHistory();

	const handleBack = () => {
		history.push(searchPath || "/busca", { restoreSearch: searchTerm });
	};

	return (
		<div className={classes.searchBanner}>
			<SearchIcon className={classes.searchBannerIcon} />
			<span className={classes.searchBannerText}>
				Você chegou aqui pela busca:{" "}
				<span className={classes.searchBannerTerm}>"{searchTerm}"</span>
			</span>
			<Chip
				icon={<ArrowBackIcon style={{ fontSize: 15 }} />}
				label="Voltar à busca"
				size="small"
				clickable
				onClick={handleBack}
				style={{
					background: "#1565c0",
					color: "#fff",
					fontWeight: 600,
					fontSize: 12,
				}}
			/>
			<Tooltip title="Dispensar">
				<CloseIcon
					style={{ fontSize: 16, color: "#90a4ae", cursor: "pointer" }}
					onClick={onDismiss}
				/>
			</Tooltip>
		</div>
	);
};

const TicketsCustom = () => {
	const classes = useStyles();
	const { ticketId } = useParams();
	const location = useLocation();
	const [bannerDismissed, setBannerDismissed] = React.useState(false);

	const fromSearch =
		!bannerDismissed &&
		location.state?.from === "search" &&
		location.state?.searchTerm;

	return (
		<div className={classes.chatContainer}>
			<div className={classes.chatPapper}>
				<Grid container spacing={0}>
					<Grid item xs={12} md={4} className={classes.contactsWrapper}>
						<TicketsManager />
					</Grid>
					<Grid item xs={12} md={8} className={classes.messagesWrapper}>
						{ticketId ? (
							<>
								{fromSearch && (
									<SearchBanner
										searchTerm={location.state.searchTerm}
										searchPath={location.state.searchPath}
										onDismiss={() => setBannerDismissed(true)}
									/>
								)}
								<Ticket />
							</>
						) : (
							<Hidden only={["sm", "xs"]}>
								<Paper square variant="outlined" className={classes.welcomeMsg}>
									<span>{i18n.t("chat.noTicketMessage")}</span>
								</Paper>
							</Hidden>
						)}
					</Grid>
				</Grid>
			</div>
		</div>
	);
};

export default TicketsCustom;

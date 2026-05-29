//simple express server to run frontend production build;
const express = require("express");
const path = require("path");
const app = express();
app.use(express.static(path.join(__dirname, "build"), { index: false }));
app.get("/*", function (req, res) {
	res.set("Cache-Control", "no-cache, no-store, must-revalidate");
	res.set("Pragma", "no-cache");
	res.set("Expires", "0");
	res.sendFile(path.join(__dirname, "build", "index.html"));
});
app.listen(3000);


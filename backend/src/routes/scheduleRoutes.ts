import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import isAuth from "../middleware/isAuth";
import * as ScheduleController from "../controllers/ScheduleController";

const scheduleRoutes = express.Router();

// Upload storage for schedule attachments
const scheduleStorage = multer.diskStorage({
  destination: (req: any, _file, cb) => {
    const companyId = req.user?.companyId;
    const folder = path.resolve(
      __dirname, "..", "..", "..", "public",
      `company${companyId}`, "schedules"
    );
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (_req, file, cb) => {
    const clean = file.originalname.replace(/\//g, "-");
    cb(null, `${Date.now()}_${clean}`);
  },
});

const scheduleUpload = multer({ storage: scheduleStorage });

scheduleRoutes.get("/schedules", isAuth, ScheduleController.index);
scheduleRoutes.post("/schedules", isAuth, ScheduleController.store);
scheduleRoutes.put("/schedules/:scheduleId", isAuth, ScheduleController.update);
scheduleRoutes.get("/schedules/:scheduleId", isAuth, ScheduleController.show);
scheduleRoutes.delete("/schedules/:scheduleId", isAuth, ScheduleController.remove);
scheduleRoutes.post("/schedules/upload-media", isAuth, scheduleUpload.array("file"), ScheduleController.uploadMedia);

export default scheduleRoutes;

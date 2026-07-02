import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import reportsRouter from "./reports";
import alertsRouter from "./alerts";
import statsRouter from "./stats";
import activityRouter from "./activity";
import usersRouter from "./users";
import storageRouter from "./storage";
import districtsRouter from "./districts";
import categoriesRouter from "./categories";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(reportsRouter);
router.use(alertsRouter);
router.use(statsRouter);
router.use(activityRouter);
router.use(usersRouter);
router.use(storageRouter);
router.use(districtsRouter);
router.use(categoriesRouter);

export default router;

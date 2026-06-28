import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyzeRouter from "./analyze";
import askRouter from "./ask";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(askRouter);
router.use(adminRouter);

export default router;

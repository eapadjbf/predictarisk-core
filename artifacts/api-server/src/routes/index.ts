import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyzeRouter from "./analyze";
import askRouter from "./ask";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(askRouter);

export default router;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import voiceforallRouter from "./voiceforall";

const router: IRouter = Router();

router.use(healthRouter);
router.use(voiceforallRouter);

export default router;

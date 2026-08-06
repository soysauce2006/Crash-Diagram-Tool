import { Router, type IRouter } from "express";
import healthRouter from "./health";
import overpassRouter from "./overpass";

const router: IRouter = Router();

router.use(healthRouter);
router.use(overpassRouter);

export default router;

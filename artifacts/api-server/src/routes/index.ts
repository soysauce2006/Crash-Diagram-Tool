import { Router, type IRouter } from "express";
import healthRouter from "./health";
import overpassRouter from "./overpass";
import tilesRouter from "./tiles";

const router: IRouter = Router();

router.use(healthRouter);
router.use(overpassRouter);
router.use(tilesRouter);

export default router;

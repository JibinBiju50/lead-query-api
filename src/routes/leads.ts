import { Router } from "express";
import { queryLeads } from "../controllers/query-leads.js";
import { authenticate } from "../middleware/auth.js";
import {
  validateQueryLeadsRequest,
} from "../middleware/validate-query-leads.js";

const leadsRouter = Router();

leadsRouter.post(
  "/query",
  authenticate,
  validateQueryLeadsRequest,
  queryLeads,
);

export default leadsRouter;
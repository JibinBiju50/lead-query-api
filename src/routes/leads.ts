import { Router } from "express";

import { authenticate } from "../middleware/auth.js";
import {
  validateQueryLeadsRequest,
} from "../middleware/validate-query-leads.js";

const leadsRouter = Router();

leadsRouter.post(
  "/query",
  authenticate,
  validateQueryLeadsRequest,
  (req, res) => {
    res.status(200).json({
      status: "success",
      message: "Request validation passed",
      data: {
        currentUser: req.currentUser,
        query: req.queryOptions,
        body: req.queryBody,
      },
    });
  },
);

export default leadsRouter;
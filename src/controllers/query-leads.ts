import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  queryLeadsService,
} from "../services/query-leads-service.js";

export async function queryLeads(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  /*
   * These values should always exist because authentication
   * and validation middleware run before this controller.
   *
   * This check also protects against accidentally registering
   * the controller in the wrong middleware order later.
   */
  if (
    !req.currentUser ||
    !req.queryOptions ||
    !req.queryBody
  ) {
    next(
      new Error(
        "Query controller was called before required middleware",
      ),
    );

    return;
  }

  try {
    const result = await queryLeadsService({
      currentUser: req.currentUser,
      query: req.queryOptions,
      body: req.queryBody,
    });

    res.status(200).json({
      status: "success",
      message: "Leads fetched successfully",
      data: result.leads,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
}
import type { QueryLeadsBody, QueryLeadsQuery } from "../validation/query-leads.ts";
import type { CurrentUser } from "./current-user.js";

declare global {
  namespace Express {
    interface Request {
      currentUser?: CurrentUser;

      queryOptions?: QueryLeadsQuery;
      queryBody?: QueryLeadsBody;
    }
  }
}

export {};
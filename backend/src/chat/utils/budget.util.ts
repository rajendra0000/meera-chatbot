import { BudgetHelper } from "../../helpers/budget.helper.js";

export function canonicalizeBudget(value: string, isVague = false) {
  return BudgetHelper.normalize(value, isVague);
}

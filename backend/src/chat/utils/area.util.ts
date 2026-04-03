import { AreaHelper } from "../../helpers/area.helper.js";

export function extractArea(value: string, options?: { requireExplicitHint?: boolean }) {
  return AreaHelper.extract(value, options);
}

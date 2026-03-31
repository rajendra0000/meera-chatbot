import { AreaHelper } from "../../helpers/area.helper.js";

export function extractArea(value: string) {
  return AreaHelper.extract(value);
}

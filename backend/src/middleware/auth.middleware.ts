import { NextFunction, Request, Response } from "express";

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_API_KEY?.trim();

  if (!expected) {
    next();
    return;
  }

  const headerKey = req.headers["x-api-key"];
  const queryKey = typeof req.query.apiKey === "string" ? req.query.apiKey : "";
  const providedKey = typeof headerKey === "string" ? headerKey : queryKey;

  if (providedKey !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

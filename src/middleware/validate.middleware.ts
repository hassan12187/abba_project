import type { Request, Response, NextFunction } from "express";
import { ZodType, ZodError } from "zod";

/**
 * Generic middleware factory that validates req against a Zod schema.
 * The schema should be shaped as: z.object({ body?, params?, query? })
 */
export const validate =
  (schema: ZodType) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      res.status(422).json({
        success: false,
        message: "Validation failed",
        errors,
      });
      return;
    }

    // Mutate req with coerced/transformed values (dates, numbers, etc.)
    if (result.data.body !== undefined) req.body = result.data.body;
    if (result.data.params !== undefined) req.params = result.data.params;
  if (result.data.query !== undefined) {
      Object.keys(req.query).forEach((key) => delete (req.query as Record<string, unknown>)[key])
      Object.assign(req.query, result.data.query)
    }

    next();
  };

function formatZodErrors(error: ZodError) {
  return error.errors.map((e) => ({
    field: e.path.join("."),
    message: e.message,
  }));
}
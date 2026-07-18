import type { Request, Response, NextFunction } from "express";
import { ZodType, ZodError ,z, ZodSafeParseError} from "zod";


type RequestSchemaType={
  body?:unknown;
  params?:unknown;
  query?:unknown;
};


/**
 * Generic middleware factory that validates req against a Zod schema.
 * The schema should be shaped as: z.object({ body?, params?, query? })
 */
export const validate =
  <T extends ZodType<RequestSchemaType>>(schema: T) =>
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

    const data = result.data as z.infer<T>;

    // Mutate req with coerced/transformed values (dates, numbers, etc.)
    if (data.body !== undefined) req.body = data.body;
    if (data.params !== null) req.params = data.params as any;
  if (data.query !== undefined) {
      Object.keys(req.query).forEach((key) => delete (req.query as Record<string, unknown>)[key])
      Object.assign(req.query, result.data.query)
    }

    next();
  };

function formatZodErrors(error: ZodError) {
  return error?.issues?.map((e) => ({
    field: e.path.join("."),
    message: e.message,
  }));
}
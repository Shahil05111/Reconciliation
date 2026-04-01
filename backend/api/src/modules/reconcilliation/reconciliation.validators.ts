import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import { ResponseFormatter } from "../../shared/utils/response-formatter";
import { HTTP_STATUS } from "../../shared/constants/app.constants";

/**
 * Known sales channel values
 */
const KNOWN_SALES_CHANNELS = [
  "MYNTRAV4_ZIVORE",
  "FLIPKARTV3_ZIVORE",
  "SHOPIFY_ZIVORE",
] as const;

/**
 * Known warehouse names
 */
const KNOWN_WAREHOUSES = [
  "wms_noida",
  "wms_ekart_blr",
  "wms_ekart_blr_new",
  "wms_ekart_bhiwandi",
  "wms_ekart_kolkata",
  "wms_ekart_ggn",
] as const;

// ─────────────────────────────────────────────────────────────
//  BASE SCHEMA (NO refine here — IMPORTANT)
// ─────────────────────────────────────────────────────────────

const baseReconSchema = z.object({
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateFrom must be YYYY-MM-DD")
    .optional(),

  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateTo must be YYYY-MM-DD")
    .optional(),

  brand: z
    .string()
    .min(1, "brand cannot be empty")
    .max(50, "brand too long")
    .optional(),

  salesChannel: z
    .enum(KNOWN_SALES_CHANNELS, {
      message: `salesChannel must be one of: ${KNOWN_SALES_CHANNELS.join(", ")}`,
    })
    .optional(),

  warehouseName: z
    .enum(KNOWN_WAREHOUSES, {
      message: `warehouseName must be one of: ${KNOWN_WAREHOUSES.join(", ")}`,
    })
    .optional(),

  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1, "page must be >= 1")),

  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 50))
    .pipe(z.number().int().min(1).max(500, "limit must be <= 500")),
});

// ─────────────────────────────────────────────────────────────
//  REUSABLE DATE VALIDATION
// ─────────────────────────────────────────────────────────────

const validateDateRange = (data: any) => {
  if (data.dateFrom && data.dateTo) {
    return new Date(data.dateFrom) <= new Date(data.dateTo);
  }
  return true;
};

const dateRangeError = {
  message: "dateFrom must be before or equal to dateTo",
  path: ["dateFrom"],
};

// ─────────────────────────────────────────────────────────────
//  FINAL SCHEMAS
// ─────────────────────────────────────────────────────────────

export const reconFiltersSchema = baseReconSchema.refine(
  validateDateRange,
  dateRangeError,
);

export const reconSummarySchema = baseReconSchema
  .omit({
    page: true,
    limit: true,
  })
  .refine(validateDateRange, dateRangeError);

export const reconExportSchema = baseReconSchema
  .omit({
    page: true,
    limit: true,
  })
  .extend({
    view: z.enum(
      ["oms-vs-dispatch", "order-vs-settlement", "return-vs-settlement"],
      {
        message:
          "view must be one of: oms-vs-dispatch, order-vs-settlement, return-vs-settlement",
      },
    ),
  })
  .refine(validateDateRange, dateRangeError);

// ─────────────────────────────────────────────────────────────
//  MIDDLEWARE
// ─────────────────────────────────────────────────────────────

type ZodSchema = z.ZodTypeAny;

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const fields = result.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          ResponseFormatter.validationError(fields, (req as any).correlationId),
        );
      return;
    }

    res.locals.validatedQuery = result.data;
    next();
  };
}

// ─────────────────────────────────────────────────────────────
//  EXPORT MIDDLEWARES
// ─────────────────────────────────────────────────────────────

export const validateReconFilters = validateQuery(reconFiltersSchema);
export const validateReconSummary = validateQuery(reconSummarySchema);
export const validateReconExport = validateQuery(reconExportSchema);

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────

export type ReconFiltersInput = z.infer<typeof reconFiltersSchema>;
export type ReconSummaryInput = z.infer<typeof reconSummarySchema>;
export type ReconExportInput = z.infer<typeof reconExportSchema>;

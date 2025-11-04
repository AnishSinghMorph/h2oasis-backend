import { Request, Response, NextFunction } from "express";

// 1. LOGGING - Track what happens (REQUIRED for debugging)
export const logger = (req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
};

// 2. ERROR HANDLER - Catch all errors (REQUIRED)
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error("Error:", error.message);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Something went wrong",
  });
};

// 3. NOT FOUND - Handle invalid routes (REQUIRED)
export const notFound = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
};

// 4. ASYNC ERROR WRAPPER - Catch async errors (VERY USEFUL)
export const asyncHandler =
  <T extends Request = Request>(
    fn: (req: T, res: Response, next: NextFunction) => Promise<any>,
  ) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };

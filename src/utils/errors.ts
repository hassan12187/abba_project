export class HttpError extends Error {
  static locked(arg0: string) {
    throw new Error("Method not implemented.");
  }
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string) {
    return new HttpError(message, 400);
  }

  static notFound(message: string) {
    return new HttpError(message, 404);
  }

  static conflict(message: string) {
    return new HttpError(message, 409);
  }

  static forbidden(message: string) {
    return new HttpError(message, 403);
  }
  static unauthorized(message:string){
    return new HttpError(message,401);
  }

  static internal(message: string) {
    return new HttpError(message, 500, false);
  }
}
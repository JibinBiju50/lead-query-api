export class AppError extends Error {
  public readonly statusCode: number;

  public constructor(message: string, statusCode: number) {
    super(message);

    this.name = new.target.name;
    this.statusCode = statusCode;

    Error.captureStackTrace?.(this, new.target);
  }
}

export class UnauthenticatedError extends AppError {
  public constructor(message = "Authentication is required") {
    super(message, 401);
  }
}

export class BadRequestError extends AppError {
  public constructor(message = "Invalid request") {
    super(message, 400);
  }
}

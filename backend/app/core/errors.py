from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)


class AppException(Exception):
    def __init__(self, message: str, code: int, status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


class ErrorCodes:
    VALIDATION = 4001
    AUTH = 4010
    FORBIDDEN = 4030
    NOT_FOUND = 4040
    OCR_FAILURE = 5001
    STORAGE_FAILURE = 5002
    PAYMENT_ERROR = 5003
    INTERNAL = 5999


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    logger.error(
        "AppException code=%s path=%s message=%s",
        exc.code,
        request.url.path,
        exc.message,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"status": "error", "message": exc.message, "code": exc.code},
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    first = errors[0] if errors else {}
    field = ".".join(str(part) for part in first.get("loc", []) if part != "body")
    message = first.get("msg", "Invalid request data")
    if field:
        message = f"{field}: {message}"
    logger.warning("Validation error path=%s detail=%s", request.url.path, errors)
    return JSONResponse(
        status_code=422,
        content={"status": "error", "message": message, "code": ErrorCodes.VALIDATION},
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception path=%s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "Something went wrong. Please try again or contact reception.",
            "code": ErrorCodes.INTERNAL,
        },
    )

/**
 * Custom Error Classes with User-Friendly Messages
 * 
 * Philosophy: No technical jargon - speak human!
 * ❌ "401 Unauthorized"
 * ✅ "Please log in again"
 */

class AppError extends Error {
    constructor(message, statusCode, code = 'ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

// Auth Errors
class AuthError extends AppError {
    constructor(message = 'Please log in again', code = 'AUTH_REQUIRED') {
        super(message, 401, code);
    }
}

class ForbiddenError extends AppError {
    constructor(message = "You don't have permission to do that") {
        super(message, 403, 'FORBIDDEN');
    }
}

// Validation Errors
class ValidationError extends AppError {
    constructor(message = 'Please check your input and try again') {
        super(message, 400, 'VALIDATION_ERROR');
    }
}

// Not Found Errors
class NotFoundError extends AppError {
    constructor(message = "We couldn't find what you're looking for") {
        super(message, 404, 'NOT_FOUND');
    }
}

// Conflict Errors (e.g., duplicate check-in)
class ConflictError extends AppError {
    constructor(message = 'This action has already been done') {
        super(message, 409, 'CONFLICT');
    }
}

// User-friendly error messages mapping
const friendlyMessages = {
    // Database errors
    '23505': "You've already done this!", // Unique violation
    '23503': "This item doesn't exist anymore", // Foreign key violation
    '23502': 'Please fill in all required fields', // Not null violation

    // Auth errors
    'INVALID_TOKEN': 'Please log in again',
    'TOKEN_EXPIRED': 'Your session has expired. Please log in again',
    'INVALID_CREDENTIALS': 'Email or password is incorrect',

    // Check-in specific
    'ALREADY_CHECKED_IN': "You've already checked in today! 💪",
    'INVALID_QR': "This QR code doesn't seem to be valid",

    // Friends
    'ALREADY_FRIENDS': "You're already gym buddies!",
    'PENDING_REQUEST': 'Friend request already sent',
    'CANT_FRIEND_SELF': "You can't add yourself as a buddy",

    // Classes
    'CLASS_FULL': 'This class is full. Try another time?',
    'ALREADY_BOOKED': "You're already booked for this class",
};

const getFriendlyMessage = (error) => {
    // Check for known error codes
    if (error.code && friendlyMessages[error.code]) {
        return friendlyMessages[error.code];
    }

    // Handle PostgreSQL error codes
    if (error.code === '23505') {
        // Parse the constraint name for more specific messages
        if (error.constraint?.includes('attendance')) {
            return friendlyMessages['ALREADY_CHECKED_IN'];
        }
        if (error.constraint?.includes('friendship')) {
            return friendlyMessages['ALREADY_FRIENDS'];
        }
        if (error.constraint?.includes('booking')) {
            return friendlyMessages['ALREADY_BOOKED'];
        }
    }

    // Default to the error message if it's an AppError
    if (error.isOperational) {
        return error.message;
    }

    // Generic fallback for unexpected errors
    return 'Something went wrong. Please try again.';
};

// Error handler middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    const statusCode = err.statusCode || 500;
    const message = getFriendlyMessage(err);
    const code = err.code || 'INTERNAL_ERROR';

    res.status(statusCode).json({
        error: true,
        message,
        code,
        // Only include stack in development
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

// Async error wrapper to avoid try-catch in every route
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    AppError,
    AuthError,
    ForbiddenError,
    ValidationError,
    NotFoundError,
    ConflictError,
    getFriendlyMessage,
    errorHandler,
    asyncHandler,
};

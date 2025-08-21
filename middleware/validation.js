const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Auth validation rules
const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .optional()
    .isIn(['admin', 'agent', 'user'])
    .withMessage('Invalid role'),
  handleValidationErrors
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// Article validation rules
const articleValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('body')
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Body must be between 1 and 10000 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  body('status')
    .optional()
    .isIn(['draft', 'published'])
    .withMessage('Invalid status'),
  handleValidationErrors
];

// Ticket validation rules
const ticketValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Description must be between 1 and 5000 characters'),
  body('category')
    .optional()
    .isIn(['billing', 'tech', 'shipping', 'other'])
    .withMessage('Invalid category'),
  body('attachmentUrls')
    .optional()
    .isArray()
    .withMessage('Attachment URLs must be an array'),
  body('attachmentUrls.*')
    .optional()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Each attachment must be a valid HTTP/HTTPS URL'),
  handleValidationErrors
];

const replyValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Reply content must be between 1 and 5000 characters'),
  handleValidationErrors
];

// Config validation rules
const configValidation = [
  body('autoCloseEnabled')
    .optional()
    .isBoolean()
    .withMessage('autoCloseEnabled must be a boolean'),
  body('confidenceThreshold')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('confidenceThreshold must be between 0 and 1'),
  body('slaHours')
    .optional()
    .isInt({ min: 1 })
    .withMessage('slaHours must be a positive integer'),
  handleValidationErrors
];

// Common parameter validations
const mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  handleValidationErrors
];

const searchValidation = [
  query('query')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be non-negative'),
  handleValidationErrors
];

module.exports = {
  registerValidation,
  loginValidation,
  articleValidation,
  ticketValidation,
  replyValidation,
  configValidation,
  mongoIdValidation,
  searchValidation,
  handleValidationErrors
};

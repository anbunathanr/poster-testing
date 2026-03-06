// API Gateway response utilities
import { APIGatewayProxyResult } from 'aws-lambda';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

export const successResponse = (data: any, statusCode: number = 200): APIGatewayProxyResult => {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
};

export const errorResponse = (
  message: string,
  statusCode: number = 500,
  errorCode?: string
): APIGatewayProxyResult => {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      error: message,
      errorCode,
    }),
  };
};

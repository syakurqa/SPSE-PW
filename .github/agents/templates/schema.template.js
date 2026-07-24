export const successSchema = {
  type: 'object',
  required: ['code', 'message', 'data'],
  properties: {
    code: {
      type: 'number',
      const: 0
    },
    message: { type: 'string' },
    data: {
      type: 'object',
      required: ['id', 'status'],
      properties: {
        id: { type: 'string' },
        status: { type: 'string' },
        // Add more fields as needed
      },
    },
  },
};

export const errorSchema = {
  type: 'object',
  required: ['code', 'message'],
  properties: {
    code: { type: 'number' },
    message: { type: 'string' },
    error: { type: 'object' },
  },
};

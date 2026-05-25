export function multipartPayloadSchema(
  properties: Record<string, Record<string, unknown>>,
  required: string[] = ['payload'],
) {
  return {
    type: 'object' as const,
    properties: {
      payload: {
        type: 'string',
        description:
          'JSON string of request fields (same shape as the JSON body DTO)',
      },
      ...properties,
    },
    required,
  };
}

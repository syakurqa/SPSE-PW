import { getProcessIdByReferenceAndSignType } from '@common/db/document-hub/get-process-id.js';

export const waitProcessIdByReference = async (
  referenceId,
  signType,
  {
    maxRetry = 20,
    retryDelay = 5000
  } = {}
) => {

  if (!referenceId) {
    throw new Error('referenceId is required');
  }

  if (!signType) {
    throw new Error('signType is required');
  }

  for (let attempt = 0; attempt < maxRetry; attempt++) {

    const processId = await getProcessIdByReferenceAndSignType(
      referenceId,
      signType
    );

    if (processId) {
      return processId;
    }

    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }

  throw new Error(
    `[DB RETRY FAILED] process_id not found after ${maxRetry} attempts | referenceId=${referenceId} | signType=${signType}`
  );
};

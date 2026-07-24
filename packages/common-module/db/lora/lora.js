import { wait } from '@common/utils/helpers/wait.js';
import { Database } from 'arangojs';
import { db } from '@common/config/index.js';

const databaseConnectionLts = new Database({
  url: db.bfi_db_lora_lts.url,
  databaseName: db.bfi_db_lora_lts.databaseName,
  auth: {
    username: db.bfi_db_lora_lts.auth.username,
    password: db.bfi_db_lora_lts.auth.password,
  },
});

const databaseConnectionNdf = new Database({
  url: db.bfi_db_lora_partnership_ndf.url,
  databaseName: db.bfi_db_lora_partnership_ndf.databaseName,
  auth: {
    username: db.bfi_db_lora_partnership_ndf.auth.username,
    password: db.bfi_db_lora_partnership_ndf.auth.password,
  },
});

function destroyConnection() {
  databaseConnectionLts.destroy();
  databaseConnectionNdf.destroy();
  return null;
}

async function getLoanStatusBySubmissionId({
  submissionId, leadStatus, excludeStatus = ['']
}) {
  // Normalize: convert single value into an array
  const statuses = Array.isArray(excludeStatus) ? excludeStatus : [excludeStatus];

  const query =
    `FOR doc IN task
    FILTER doc.document_id == @submissionId
      AND doc.type == @leadStatus
      AND doc.status NOT IN @statuses
    RETURN doc`;

  const cursor = await databaseConnectionLts.query(query, {
    submissionId,
    leadStatus,
    statuses,
  });
  const result = await cursor.all();

  return result;
}

async function checkerLeadIdPartnership({
  submissionId, leadStatus, excludeStatus = [''], counter = 0
}) {
  if (counter > 10) {
    throw new Error('Failed to find lead status for the given submission ID after 10 attempts.');
  }
  const nextCounter = counter + 1;

  const data = await getLoanStatusBySubmissionId({
    submissionId,
    leadStatus,
    excludeStatus
  });
  if (data.length == 0) {
    await wait(5000);
    return checkerLeadIdPartnership({
      submissionId,
      leadStatus,
      excludeStatus,
      nextCounter
    });
  }

  return data;
}

async function getLeadIdBySubmissionId({ submissionId }) {
  const query =
    `FOR doc IN doc_pending
    FILTER doc._key == "${submissionId}"
    RETURN doc.data`;
  await wait(15000);
  const cursor = await databaseConnectionNdf.query(query);
  const result = await cursor.all();

  return result;
}

async function updatePrequalifiedTimestamp({ submissionId, daysAgo }) {
  const query = `
    LET newDate = DATE_SUBTRACT(DATE_NOW(), @daysAgo, "days")

    FOR doc IN task
      FILTER doc.document_id == @submissionId
      UPDATE doc WITH {
        form_data_initial: MERGE(doc.form_data_initial, {
          "$.process.status_timestamps.pre_qualified": newDate
        }),
        form_definition: MERGE(doc.form_definition, {
          data: MERGE(doc.form_definition.data, {
            read_only: MERGE(doc.form_definition.data.read_only, {
              "$.process.status_timestamps.pre_qualified": newDate
            })
          })
        })
      } IN task
      RETURN NEW
  `;

  const cursor = await databaseConnectionLts.query(query, {
    submissionId,
    daysAgo,
  });

  return cursor.all();
}

async function updateUserHasMessaged({ submissionId }) {
  const query = `
    FOR doc IN task
      FILTER doc.document_id == @submissionId
      UPDATE doc WITH {
        user_has_messaged: true
      } IN task
      RETURN NEW
  `;

  const cursor = await databaseConnectionLts.query(query, { submissionId });

  return cursor.all();
}

async function getMappedLtwStatus({ submissionId, status = ['completed', 'cancelled'] }) {
  // Normalize: convert single value into an array
  const statuses = Array.isArray(status) ? status : [status];

  const query = `
    FOR doc IN task
      FILTER doc.document_id == @submissionId
        AND doc.status NOT IN @statuses
      RETURN {
        form_data_initial: doc.form_data_initial["$.ltw.mapped_status"],
        read_only: doc.form_definition.data.read_only["$.ltw.mapped_status"],
        survey_type : doc.form_data_initial["$.survey_appointment.survey_type"],
        unschedule_status : doc.form_data_initial["$.process.unscheduled_task.status"],
        messaging_number : doc.messaging_number,
        assignee_to: doc.assigned_to["user_id"]
      }
  `;

  const cursor = await databaseConnectionLts.query(query, {
    submissionId,
    statuses,
  });

  return cursor.all();
}

async function checkDocPendingStatus({ submissionId }) {
  const query = `
    FOR doc IN doc_pending
      FILTER doc._key == @submissionId
      RETURN doc.data.status.application
  `;

  const cursor = await databaseConnectionNdf.query(query, { submissionId });
  const result = await cursor.all();

  // Error Handling
  if (!result || result.length === 0) {
    throw new Error(`Status not found for submissionId: ${submissionId}`);
  }

  return result[0];
}

// Function for updating assignee, default update to RCO Head Office
async function updateAssignee({
  submissionId,
  name = 'RCO Head Office Satu',
  userId = '999018',
  docType = 'RCO_LOAN_VALIDATION'
}) {
  const query = `
    FOR doc IN task
      FILTER doc.document_id == @submissionId
        AND doc.type == @docType
      UPDATE doc WITH {
        assigned_to: MERGE(doc.assigned_to, {
          name: @name,
          user_id: @userId
        })
      } IN task
      RETURN {
        _key: NEW._key,
        document_id: NEW.document_id,
        assigned_to: NEW.assigned_to
      }
  `;

  const cursor = await databaseConnectionLts.query(query, {
    submissionId,
    name,
    userId,
    docType
  });

  return cursor.all();
}

async function getUserByBranchId({
  productType, branchId, role = 'vd'
}) {
  const productCategory =
    productType === '2W' ? 'ndf2w_branch_pos' : 'ndf4w_branch_pos';

  const query = `
    FOR doc IN people
      FILTER doc.partnership != null
        AND doc.partnership.dp_role == @role
        AND doc.partnership.active == true
        AND doc._key LIKE "999%"

      LET branches = doc.partnership.product_branches

      FILTER LENGTH(
        FOR b IN (branches[@productCategory] OR [])
          FILTER b LIKE CONCAT(@branchPrefix, "%")
          RETURN 1
      ) > 0

      RETURN doc._key
  `;

  const cursor = await databaseConnectionLts.query(query, {
    role,
    productCategory,
    branchPrefix: branchId
  });

  return cursor.all();
}

export {
  destroyConnection,
  checkerLeadIdPartnership,
  getLoanStatusBySubmissionId,
  getLeadIdBySubmissionId,
  updatePrequalifiedTimestamp,
  updateUserHasMessaged,
  getMappedLtwStatus,
  checkDocPendingStatus,
  updateAssignee,
  getUserByBranchId
};

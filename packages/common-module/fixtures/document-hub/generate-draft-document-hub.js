export const GENERATE_DRAFT_DOCUMENT_HUB_MAPPING = {
  MULTI_SEGMENT_SUCCESS: {
    template_code: 'SAMPLE_AGREEMENT_NDF2W',
    fetch_strategies: [
      {
        segment: 'customer',
        source: 'CUSTOMER',
        bind_parameters: { cif_id: '742e424c-9c59-4a7c-b313-a030d204f4dd' }
      },
      {
        segment: 'agreement',
        source: 'AGREEMENT',
        bind_parameters: { agreement_number: '4012408707' }
      }
    ]
  },
  SEGMENT_SUCCESS: {
    template_code: 'SAMPLE_AGREEMENT_NDF2W',
    fetch_strategies: [
      {
        segment: 'customer',
        source: 'CUSTOMER',
        bind_parameters: { cif_id: '742e424c-9c59-4a7c-b313-a030d204f4dd' }
      }
    ]
  },
  SEGMENT_SUCCESS_OVERRIDE: {
    template_code: 'SAMPLE_AGREEMENT_NDF2W',
    fetch_strategies: [
      {
        segment: 'customer',
        source: 'CUSTOMER',
        bind_parameters: { cif_id: '742e424c-9c59-4a7c-b313-a030d204f4dd' }
      }
    ],
    document_renderer_manual_override: {
      dms_context: {},
      template_variables: {
        beneficiary_account_number: 10135465131,
        capitalized_ntf_amount: 20000000
      }
    }
  },
  SEGMENT_SUCCESS_OVERRIDE_NULL_VALUE: {
    template_code: 'SAMPLE_AGREEMENT_NDF2W',
    fetch_strategies: [
      {
        segment: 'customer',
        source: 'CUSTOMER',
        bind_parameters: { cif_id: '742e424c-9c59-4a7c-b313-a030d204f4dd' }
      }
    ],
    document_renderer_manual_override: { template_variables: { beneficiary_account_number: null } }
  },
  DUPLICATE_FETCH_STRATEGIES: {
    template_code: 'SAMPLE_AGREEMENT_NDF2W',
    fetch_strategies: [
      {
        segment: 'customer',
        source: 'CUSTOMER',
        bind_parameters: { cif_id: '742e424c-9c59-4a7c-b313-a030d204f4dd' }
      }, {
        segment: 'customer',
        source: 'CUSTOMER',
        bind_parameters: { cif_id: '742e424c-9c59-4a7c-b313-a030d204f4dd' }
      }
    ]
  },
  EMPTY_FETCH_STRATEGIES_ARRAY: {
    template_code: 'SAMPLE_AGREEMENT_NDF2W',
    fetch_strategies: [
    ]
  },
  MISSING_TEMPLATE_CODE: {
    fetch_strategies: [
      {
        segment: 'customer',
        source: 'CUSTOMER',
        bind_parameters: { cif_id: '742e424c-9c59-4a7c-b313-a030d204f4dd' }
      }
    ]
  },
  NON_ACTIVE_TEMPLATE: {
    template_code: 'AGREEMENT_NDF2W_NEWW',
    fetch_strategies: [
      {
        segment: 'customer',
        source: 'CUSTOMER',
        bind_parameters: { cif_id: '742e424c-9c59-4a7c-b313-a030d204f4dd' }
      }
    ]
  },
  NOT_FOUND_TEMPLATE: {
    template_code: 'NOT FOUND TEMPLATE',
    fetch_strategies: [
      {
        segment: 'customer',
        source: 'CUSTOMER',
        bind_parameters: { cif_id: '742e424c-9c59-4a7c-b313-a030d204f4dd' }
      }
    ]
  },
  UPPERCASE_NORMALIZATION_FETCH_STRATEGIES: {
    template_code: 'SAMPLE_AGREEMENT_NDF2W',
    fetch_strategies: [
      {
        segment: 'customer',
        source: 'customer',
        bind_parameters: { cif_id: '742e424c-9c59-4a7c-b313-a030d204f4dd' }
      }
    ]
  },
  WITHOUT_FETCH_STRATEGIES_ARRAY: { template_code: 'SAMPLE_AGREEMENT_NDF2W' },
};

/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { queryFieldsExemplars } from './queryFields.exemplars';

export const soqlQueryExemplars = {
  simpleQuery: {
    query: 'SELECT id, name FROM Contact',
    queryResult: {
      totalSize: 1,
      done: true,
      records: [
        {
          attributes: {
            type: 'Contact',
            url: '/services/data/v51.0/sobjects/Contact/003B000000DkDswIAF',
          },
          Id: '003B000000DkDswIAF',
          Name: 'Matteo Crippa',
        },
      ],
    },
    soqlQueryResult: {
      columns: queryFieldsExemplars.simpleQuery.columns,
      query: 'SELECT id, name FROM Contact',
      result: {
        totalSize: 1,
        done: true,
        records: [
          {
            attributes: {
              type: 'Contact',
              url: '/services/data/v51.0/sobjects/Contact/003B000000DkDswIAF',
            },
            Id: '003B000000DkDswIAF',
            Name: 'Matteo Crippa',
          },
        ],
      },
    },
  },
  subQuery: {
    query: 'SELECT Name, ( SELECT LastName FROM Contacts ) FROM Account',
    queryResult: {
      totalSize: 1,
      done: true,
      records: [
        {
          attributes: {
            type: 'Account',
            url: '/services/data/v51.0/sobjects/Account/001B0000002Gcp0IAC',
          },
          Name: 'Cisco Systems, Inc.',
          Contacts: null,
        },
      ],
    },
    soqlQueryResult: {
      query: 'SELECT Name, ( SELECT LastName FROM Contacts ) FROM Account',
      columns: queryFieldsExemplars.subquery.columns,
      result: {
        totalSize: 1,
        done: true,
        records: [
          {
            attributes: {
              type: 'Account',
              url: '/services/data/v51.0/sobjects/Account/001B0000002Gcp0IAC',
            },
            Name: 'Cisco Systems, Inc.',
            Contacts: null,
          },
        ],
      },
    },
  },
  queryMore: {
    query: 'SELECT id, name FROM Contact',
    queryResult: {
      totalSize: 2,
      done: false,
      nextRecordsUrl: '/services/data/v51.0/query/01gB000003KL1aaIAD-1',
      records: [
        {
          attributes: {
            type: 'Contact',
            url: '/services/data/v51.0/sobjects/Contact/00390000001TdgeAAC',
          },
          Id: '00390000001TdgeAAC',
          Name: 'Caroline Roth',
        },
      ],
    },
    queryMoreResult: {
      totalSize: 2,
      done: true,
      records: [
        {
          attributes: {
            type: 'Contact',
            url: '/services/data/v51.0/sobjects/Contact/003B0000001U8uaIAC',
          },
          Id: '003B0000001U8uaIAC',
          Name: 'Dalil Djidel',
        },
      ],
    },
    soqlQueryResult: {
      query: 'SELECT id, name FROM Contact',
      columns: queryFieldsExemplars.simpleQuery.columns,
      result: {
        totalSize: 2,
        done: true,
        records: [
          {
            attributes: {
              type: 'Contact',
              url: '/services/data/v51.0/sobjects/Contact/00390000001TdgeAAC',
            },
            Id: '00390000001TdgeAAC',
            Name: 'Caroline Roth',
          },
          {
            attributes: {
              type: 'Contact',
              url: '/services/data/v51.0/sobjects/Contact/003B0000001U8uaIAC',
            },
            Id: '003B0000001U8uaIAC',
            Name: 'Dalil Djidel',
          },
        ],
      },
    },
  },
  emptyQuery: {
    queryResult: {
      totalSize: 0,
      done: true,
      records: [],
    },
    soqlQueryResult: {
      query: "SELECT Name FROM Contact where name = 'some nonexistent name'",
      columns: [],
      result: {
        totalSize: 0,
        done: true,
        records: [],
      },
    },
  },
  queryWithNullFields: {
    soqlQueryResult: {
      query: 'SELECT Name, Avg(AnnualRevenue) FROM Account GROUP BY Name',
      columns: [
        {
          name: 'Name',
        },
        {
          name: 'avg(AnnualRevenue)',
        },
      ],
      result: {
        totalSize: 16,
        done: true,
        records: [
          {
            attributes: {
              type: 'AggregateResult',
            },
            Name: 'Sample Account for Entitlements',
            expr0: null,
          },
          {
            attributes: {
              type: 'AggregateResult',
            },
            Name: 'sForce',
            expr0: null,
          },
          {
            attributes: {
              type: 'AggregateResult',
            },
            Name: 'United Oil & Gas, Singapore',
            expr0: null,
          },
          {
            attributes: {
              type: 'AggregateResult',
            },
            Name: 'Edge Communications',
            expr0: 139000000,
          },
          {
            attributes: {
              type: 'AggregateResult',
            },
            Name: 'University of Arizona',
            expr0: null,
          },
          {
            attributes: {
              type: 'AggregateResult',
            },
            Name: 'United Oil & Gas Corp.',
            expr0: 5600000000,
          },
          {
            attributes: {
              type: 'AggregateResult',
            },
            Name: 'Pyramid Construction Inc.',
            expr0: 950000000,
          },
          {
            attributes: {
              type: 'AggregateResult',
            },
            Name: 'Grand Hotels & Resorts Ltd',
            expr0: 500000000,
          },
          {
            attributes: {
              type: 'AggregateResult',
            },
            Name: 'Dickenson plc',
            expr0: 50000000,
          },
          {
            attributes: {
              type: 'AggregateResult',
            },
            Name: 'baz',
            expr0: null,
          },
          {
            attributes: {
              type: 'AggregateResult',
            },
            Name: 'Burlington Textiles Corp of America',
            expr0: 350000000,
          },
          {
            attributes: {
              type: 'AggregateResult',
            },
            Name: 'zzzzz',
            expr0: 10,
          },
          {
            attributes: {
              type: 'AggregateResult',
            },
            Name: 'United Oil & Gas, UK',
            expr0: null,
          },
          {
            attributes: {
              type: 'AggregateResult',
            },
            Name: 'Express Logistics and Transport',
            expr0: 950000000,
          },
          {
            attributes: {
              type: 'AggregateResult',
            },
            Name: 'GenePoint',
            expr0: 30000000,
          },
          {
            attributes: {
              type: 'AggregateResult',
            },
            Name: 'foo',
            expr0: 100,
          },
        ],
      },
    },
  },
};

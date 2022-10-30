/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Field, FieldType } from '../../src/dataSoqlQueryTypes';

export const makeSubfield = (name: string, fields: Field[]): Field => ({ fields, name, fieldType: FieldType.subqueryField });

export const queryFieldsExemplars = {
  simpleQuery: {
    columnMetadata: [
      {
        aggregate: false,
        apexType: 'Id',
        booleanType: false,
        columnName: 'Id',
        custom: false,
        displayName: 'Id',
        foreignKeyName: null,
        insertable: false,
        joinColumns: [],
        numberType: false,
        textType: false,
        updatable: false,
      },
      {
        aggregate: false,
        apexType: 'String',
        booleanType: false,
        columnName: 'Name',
        custom: false,
        displayName: 'Name',
        foreignKeyName: null,
        insertable: false,
        joinColumns: [],
        numberType: false,
        textType: true,
        updatable: false,
      },
    ],
    columns: [
      { fieldType: FieldType.field, name: 'Id' },
      { fieldType: FieldType.field, name: 'Name' },
    ],
  },
  subquery: {
    columnMetadata: [
      {
        aggregate: false,
        apexType: 'String',
        booleanType: false,
        columnName: 'Name',
        custom: false,
        displayName: 'Name',
        foreignKeyName: null,
        insertable: false,
        joinColumns: [],
        numberType: false,
        textType: true,
        updatable: false,
      },
      {
        aggregate: true,
        apexType: null,
        booleanType: false,
        columnName: 'Contacts',
        custom: false,
        displayName: 'Contacts',
        foreignKeyName: null,
        insertable: false,
        joinColumns: [
          {
            aggregate: false,
            apexType: 'String',
            booleanType: false,
            columnName: 'LastName',
            custom: false,
            displayName: 'LastName',
            foreignKeyName: null,
            insertable: true,
            joinColumns: [],
            numberType: false,
            textType: true,
            updatable: true,
          },
        ],
        numberType: false,
        textType: false,
        updatable: false,
      },
    ],
    columns: [
      { fieldType: FieldType.field, name: 'Name' },
      makeSubfield('Contacts', [{ fieldType: FieldType.field, name: 'LastName' }]),
    ],
  },
  aggregateQuery: {
    columnMetadata: [
      {
        aggregate: false,
        apexType: 'Id',
        booleanType: false,
        columnName: 'CampaignId',
        custom: false,
        displayName: 'CampaignId',
        foreignKeyName: null,
        insertable: true,
        joinColumns: [],
        numberType: false,
        textType: false,
        updatable: true,
      },
      {
        aggregate: true,
        apexType: null,
        booleanType: false,
        columnName: 'expr0',
        custom: false,
        displayName: 'avg(Amount)',
        foreignKeyName: null,
        insertable: false,
        joinColumns: [],
        numberType: true,
        textType: false,
        updatable: false,
      },
    ],
    columns: [
      { fieldType: FieldType.field, name: 'CampaignId' },
      { fieldType: FieldType.functionField, name: 'avg(Amount)' },
    ],
  },
  queryWithJoin: {
    columnMetadata: [
      {
        aggregate: false,
        apexType: 'String',
        booleanType: false,
        columnName: 'Name',
        custom: false,
        displayName: 'Name',
        foreignKeyName: null,
        insertable: false,
        joinColumns: [],
        numberType: false,
        textType: true,
        updatable: false,
      },
      {
        aggregate: false,
        apexType: null,
        booleanType: false,
        columnName: 'Owner',
        custom: false,
        displayName: 'Owner',
        foreignKeyName: 'OwnerId',
        insertable: false,
        joinColumns: [
          {
            aggregate: false,
            apexType: 'String',
            booleanType: false,
            columnName: 'Name',
            custom: false,
            displayName: 'Name',
            foreignKeyName: null,
            insertable: false,
            joinColumns: [],
            numberType: false,
            textType: true,
            updatable: false,
          },
        ],
        numberType: false,
        textType: false,
        updatable: false,
      },
    ],
    columns: [
      { fieldType: FieldType.field, name: 'Name' },
      { fieldType: FieldType.field, name: 'Owner.Name' },
    ],
  },
};

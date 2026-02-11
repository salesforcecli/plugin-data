/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect, config } from 'chai';
import type { DescribeSObjectResult } from '@jsforce/jsforce-node';
import {
  RefFromIdByType,
  buildRefMap,
  flattenNestedRecords,
  flattenWithChildRelationships,
  maybeConvertIdToRef,
  removeChildren,
  replaceParentReferences,
} from '../../../../src/export.js';

config.truncateThreshold = 0;

const describeMetadata = new Map([
  [
    'Account',
    {
      name: 'Account',
      childRelationships: [
        { childSObject: 'Case', field: 'AccountId', relationshipName: 'Cases' },
        {
          childSObject: 'Contact',
          field: 'AccountId',
          relationshipName: 'Contacts',
        },
      ],
      fields: [
        { name: 'Name', referenceTo: [], type: 'string' },
        { name: 'Type', referenceTo: [], type: 'picklist' },
        { name: 'Industry', referenceTo: [], type: 'picklist' },
      ],
    } as unknown as DescribeSObjectResult,
  ],
  [
    'Case',
    {
      name: 'Case',
      childRelationships: [],
      fields: [
        { name: 'AccountId', referenceTo: ['Account'], type: 'reference' },
        { name: 'Status', referenceTo: [], type: 'picklist' },
        { name: 'Origin', referenceTo: [], type: 'picklist' },
        { name: 'Subject', referenceTo: [], type: 'string' },
      ],
    } as unknown as DescribeSObjectResult,
  ],
  [
    'Contact',
    {
      name: 'Contact',
      childRelationships: [],
      fields: [
        { name: 'AccountId', referenceTo: ['Account'], type: 'reference' },
        { name: 'LastName', referenceTo: [], type: 'string' },
        { name: 'FirstName', referenceTo: [], type: 'string' },
        { name: 'Phone', referenceTo: [], type: 'phone' },
        { name: 'Email', referenceTo: [], type: 'email' },
      ],
    } as unknown as DescribeSObjectResult,
  ],
]);

const testRecordList = {
  totalSize: 2,
  done: true,
  records: [
    {
      attributes: {
        type: 'Account',
        url: '/services/data/v39.0/sobjects/Account/001xx000003DHzvAAG',
      },
      Id: '001xx000003DHzvAAG',
      Name: 'BigDogs',
      Industry: 'Construction',
      Cases: {
        totalSize: 1,
        done: true,
        records: [
          {
            attributes: {
              type: 'Case',
              url: '/services/data/v39.0/sobjects/Case/500xx000000Yn2uAAC',
            },
            Status: 'New',
            Origin: 'Web',
            Subject: 'I never read the instructions',
            AccountId: '001xx000003DHzvAAG',
          },
        ],
      },
      Contacts: {
        totalSize: 1,
        done: true,
        records: [
          {
            attributes: {
              type: 'Contact',
              url: '/services/data/v39.0/sobjects/Contact/003xx000004TpUeAAK',
            },
            FirstName: 'John',
            LastName: 'Doe',
            Email: 'john@doe.gov',
            Phone: '123-456-7890',
          },
        ],
      },
    },
    {
      attributes: {
        type: 'Account',
        url: '/services/data/v39.0/sobjects/Account/001xx000003DHzvBAG',
      },
      Id: '001xx000003DHzvBAG',
      Name: 'HotDogs',
      Industry: 'Fine Dining',
      Cases: null,
      Contacts: null,
    },
  ],
};

describe('flatten', () => {
  it('single record', () => {
    const oneRecord = {
      attributes: {
        type: 'Account',
        url: '/services/data/v39.0/sobjects/Account/001xx000003DHzvAAG',
      },
      Id: '001xx000003DHzvAAG',
      Name: 'BigDogs',
      Industry: 'Construction',
    };
    const queryResult = {
      totalSize: 1,
      done: true,
      records: [oneRecord],
    };
    expect(queryResult.records.flatMap(flattenNestedRecords)).to.deep.equal([oneRecord]);
  });
  it('no records yield an empty array', () => {
    const queryResult = {
      totalSize: 0,
      done: true,
      records: [],
    };
    expect(queryResult.records.flatMap(flattenNestedRecords)).to.deep.equal([]);
  });
  it('with children', () => {
    expect(testRecordList.records.flatMap(flattenNestedRecords)).to.deep.equal([
      {
        attributes: {
          type: 'Account',
          url: '/services/data/v39.0/sobjects/Account/001xx000003DHzvAAG',
        },
        Id: '001xx000003DHzvAAG',
        Name: 'BigDogs',
        Industry: 'Construction',
        Cases: {
          totalSize: 1,
          done: true,
          records: [
            {
              attributes: {
                type: 'Case',
                url: '/services/data/v39.0/sobjects/Case/500xx000000Yn2uAAC',
              },
              Status: 'New',
              Origin: 'Web',
              Subject: 'I never read the instructions',
              AccountId: '001xx000003DHzvAAG',
            },
          ],
        },
        Contacts: {
          totalSize: 1,
          done: true,
          records: [
            {
              attributes: {
                type: 'Contact',
                url: '/services/data/v39.0/sobjects/Contact/003xx000004TpUeAAK',
              },
              FirstName: 'John',
              LastName: 'Doe',
              Email: 'john@doe.gov',
              Phone: '123-456-7890',
            },
          ],
        },
      },
      {
        attributes: {
          type: 'Case',
          url: '/services/data/v39.0/sobjects/Case/500xx000000Yn2uAAC',
        },
        Status: 'New',
        Origin: 'Web',
        Subject: 'I never read the instructions',
        AccountId: '001xx000003DHzvAAG',
      },
      {
        attributes: {
          type: 'Contact',
          url: '/services/data/v39.0/sobjects/Contact/003xx000004TpUeAAK',
        },
        FirstName: 'John',
        LastName: 'Doe',
        Email: 'john@doe.gov',
        Phone: '123-456-7890',
      },
      {
        attributes: {
          type: 'Account',
          url: '/services/data/v39.0/sobjects/Account/001xx000003DHzvBAG',
        },
        Id: '001xx000003DHzvBAG',
        Name: 'HotDogs',
        Industry: 'Fine Dining',
        Cases: null,
        Contacts: null,
      },
    ]);
  });
});

describe('flattenWithChildRelationships', () => {
  const fnWithContext = flattenWithChildRelationships(describeMetadata)(undefined);
  it('single record', () => {
    const oneRecord = {
      attributes: {
        type: 'Account',
        url: '/services/data/v39.0/sobjects/Account/001xx000003DHzvAAG',
      },
      Id: '001xx000003DHzvAAG',
      Name: 'BigDogs',
      Industry: 'Construction',
    };
    const queryResult = {
      totalSize: 1,
      done: true,
      records: [oneRecord],
    };
    expect(queryResult.records.flatMap(fnWithContext)).to.deep.equal([oneRecord]);
  });
  it('no records yield an empty array', () => {
    const queryResult = {
      totalSize: 0,
      done: true,
      records: [],
    };
    expect(queryResult.records.flatMap(fnWithContext)).to.deep.equal([]);
  });
  it('with children', () => {
    expect(testRecordList.records.flatMap(fnWithContext)).to.deep.equal([
      {
        attributes: {
          type: 'Account',
          url: '/services/data/v39.0/sobjects/Account/001xx000003DHzvAAG',
        },
        Id: '001xx000003DHzvAAG',
        Name: 'BigDogs',
        Industry: 'Construction',
        Cases: {
          totalSize: 1,
          done: true,
          records: [
            {
              attributes: {
                type: 'Case',
                url: '/services/data/v39.0/sobjects/Case/500xx000000Yn2uAAC',
              },
              Status: 'New',
              Origin: 'Web',
              Subject: 'I never read the instructions',
              AccountId: '001xx000003DHzvAAG',
            },
          ],
        },
        Contacts: {
          totalSize: 1,
          done: true,
          records: [
            {
              attributes: {
                type: 'Contact',
                url: '/services/data/v39.0/sobjects/Contact/003xx000004TpUeAAK',
              },
              FirstName: 'John',
              LastName: 'Doe',
              Email: 'john@doe.gov',
              Phone: '123-456-7890',
            },
          ],
        },
      },
      {
        attributes: {
          type: 'Case',
          url: '/services/data/v39.0/sobjects/Case/500xx000000Yn2uAAC',
        },
        Status: 'New',
        Origin: 'Web',
        Subject: 'I never read the instructions',
        AccountId: '001xx000003DHzvAAG',
      },
      {
        attributes: {
          type: 'Contact',
          url: '/services/data/v39.0/sobjects/Contact/003xx000004TpUeAAK',
        },
        FirstName: 'John',
        LastName: 'Doe',
        Email: 'john@doe.gov',
        Phone: '123-456-7890',
        // lookup is added to the child record because of the relationship
        AccountId: '001xx000003DHzvAAG',
      },
      {
        attributes: {
          type: 'Account',
          url: '/services/data/v39.0/sobjects/Account/001xx000003DHzvBAG',
        },
        Id: '001xx000003DHzvBAG',
        Name: 'HotDogs',
        Industry: 'Fine Dining',
        Cases: null,
        Contacts: null,
      },
    ]);
  });
});

describe('buildRefMap', () => {
  const record = {
    attributes: {
      type: 'Account',
      url: '/services/data/v39.0/sobjects/Account/001xx000003DHzvAAG',
    },
    Id: '001xx000003DHzvAAG',
    Name: 'BigDogs',
    Industry: 'Construction',
  };
  it('does not have object, sets correct id/ref#', () => {
    const refMap: RefFromIdByType = new Map();
    const result = buildRefMap(refMap)(record);
    expect(result.get('Account')).to.deep.equal(new Map([['001xx000003DHzvAAG', 'AccountRef1']]));
  });

  it('has object with an entry already present, so adds a new entry with correct id/ref#', () => {
    const refMap: RefFromIdByType = new Map([['Account', new Map([['001xx000004DHzvAAG', 'AccountRef1']])]]);
    const result = buildRefMap(refMap)(record);
    expect(result.get('Account')?.size).to.equal(2);
    expect(result.get('Account')?.get('001xx000004DHzvAAG')).to.equal('AccountRef1');
    expect(result.get('Account')?.get(record.Id)).to.equal('AccountRef2');
  });
});

describe('replaceParentReferences', () => {
  const caseRecord = {
    attributes: {
      type: 'Case',
      url: '/services/data/v39.0/sobjects/Case/500xx000000Yn2uAAC',
    },
    Status: 'New',
    Origin: 'Web',
    Subject: 'I never read the instructions',
    AccountId: '001xx000003DHzvAAG',
  };
  const refMap: RefFromIdByType = new Map([['Account', new Map([['001xx000003DHzvAAG', 'AccountRef1']])]]);
  const fnToTest = replaceParentReferences(describeMetadata)(refMap);

  it('replaces parent references with ref#', () => {
    const result = fnToTest(caseRecord);
    expect(result.AccountId).to.equal('@AccountRef1');
  });
  it('no changes when object is not in refMap', () => {
    const emptyMap = new Map<string, Map<string, string>>();
    expect(replaceParentReferences(describeMetadata)(emptyMap)(caseRecord)).to.deep.equal(caseRecord);
  });

  it('no changes when id is not in refMap for object', () => {
    const modifiedRecord = { ...caseRecord, AccountId: '001xx000003DHzvBAG' };
    expect(fnToTest(modifiedRecord)).to.deep.equal(modifiedRecord);
  });

  it('no changes when there is not parent Id field on the record', () => {
    const { AccountId, ...caseWithNoParent } = caseRecord;
    const result = fnToTest(caseWithNoParent);
    expect(result).to.deep.equal(caseWithNoParent);
  });
});

describe('maybeConvertIdToRef', () => {
  const refMap: RefFromIdByType = new Map([['Account', new Map([['001xx000004DHzvAAG', 'AccountRef1']])]]);
  const fnToTest = maybeConvertIdToRef(refMap);
  describe('has type', () => {
    it('converts id to ref#', () => {
      expect(fnToTest(['001xx000004DHzvAAG', 'Account'])).to.equal('@AccountRef1');
    });
    it('leaves other IDs along', () => {
      expect(fnToTest(['001xx000004DHzvBAG', 'Account'])).to.equal('001xx000004DHzvBAG');
    });
  });
  describe('no type', () => {
    it('finds id and converts to ref# (for polymorphic fields', () => {
      expect(fnToTest(['001xx000004DHzvAAG'])).to.equal('@AccountRef1');
    });
    it('leaves other IDs along', () => {
      expect(fnToTest(['001xx000004DHzvBAG'])).to.equal('001xx000004DHzvBAG');
    });
  });
});

describe('removeChildren', () => {
  it('removes 2 children of different types', () => {
    const record = testRecordList.records[0];
    expect(record).to.have.property('Cases');
    expect(record).to.have.property('Contacts');
    const result = removeChildren(record);
    expect(result).to.not.have.property('Cases');
    expect(result).to.not.have.property('Contacts');

    const { Cases, Contacts, ...originalForComparison } = record;
    expect(result).to.deep.equal(originalForComparison);
  });

  it('removes empty record arrays', () => {
    const record = { ...testRecordList.records[0], Bars: { records: [] } };
    expect(record).to.have.property('Bars');
    const result = removeChildren(record);
    expect(result).to.not.have.property('Bars');

    const { Bars, Cases, Contacts, ...originalForComparison } = record;
    expect(result).to.deep.equal(originalForComparison);
  });
});

/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { testSetup } from '@salesforce/core/lib/testSetup';
// import * as sinon from 'sinon';
// import * as jsforce from 'jsforce';
import { Connection } from '@salesforce/core';
import { stubInterface, StubbedType, stubMethod } from '@salesforce/ts-sinon';
import { SObject } from '../src/sobject';

const $$ = testSetup();

describe('SObject', () => {
  const sobjectId = '001S000001J0hHfIAJ';
  let connectionStub: StubbedType<Connection>;

  beforeEach(async () => {
    connectionStub = stubInterface<Connection>($$.SANDBOX, {
      tooling: {
        create: () => ({ id: sobjectId, success: true }),
        destroy: () => ({ id: sobjectId, success: true }),
        retrieve: () => ({ Id: sobjectId }),
        update: () => ({ id: sobjectId, success: true }),
        sobject: () => {
          return {
            find: () => ({ Id: sobjectId }),
          };
        },
      },
      sobject: () => {
        return {
          create: () => ({ id: sobjectId, success: true }),
          destroy: () => ({ id: sobjectId, success: true }),
          retrieve: () => ({ Id: sobjectId }),
          update: () => ({ id: sobjectId, success: true }),
          find: () => ({ Id: sobjectId }),
        };
      },
    });
    stubMethod($$.SANDBOX, Connection, 'create').returns(Promise.resolve(connectionStub));
  });

  describe('insert', () => {
    it('should create new sobject using soap api', async () => {
      const sobject = new SObject({
        connection: (connectionStub as unknown) as Connection,
        sObjectType: 'Account',
      });
      const result = await sobject.insert('name=Acme');
      expect(result).to.deep.equal({ id: sobjectId, success: true });
      expect(connectionStub.sobject.callCount).to.equal(1);
    });

    it('should create new sobject using tooling api', async () => {
      const sobject = new SObject({
        connection: (connectionStub as unknown) as Connection,
        sObjectType: 'Account',
        useToolingApi: true,
      });
      const result = await sobject.insert('name=Acme');
      expect(result).to.deep.equal({ id: sobjectId, success: true });
      expect(connectionStub.sobject.callCount).to.equal(0);
    });

    it('should only return a single new sobject', async () => {
      const sobject = new SObject({
        connection: (connectionStub as unknown) as Connection,
        sObjectType: 'Account',
      });
      const result = await sobject.insert('name=Acme');
      expect(result).to.deep.equal({ id: sobjectId, success: true });
      expect(typeof result).to.equal('object');
    });
  });

  describe('delete', () => {
    it('should delete sobject using soap api', async () => {
      const sobject = new SObject({
        connection: (connectionStub as unknown) as Connection,
        sObjectType: 'Account',
      });
      const result = await sobject.delete(sobjectId);
      expect(result).to.deep.equal({ id: sobjectId, success: true });
      expect(connectionStub.sobject.callCount).to.equal(1);
    });

    it('should delete new sobject using tooling api', async () => {
      const sobject = new SObject({
        connection: (connectionStub as unknown) as Connection,
        sObjectType: 'Account',
        useToolingApi: true,
      });
      const result = await sobject.delete(sobjectId);
      expect(result).to.deep.equal({ id: sobjectId, success: true });
      expect(connectionStub.sobject.callCount).to.equal(0);
    });

    it('should only return a single result', async () => {
      const sobject = new SObject({
        connection: (connectionStub as unknown) as Connection,
        sObjectType: 'Account',
      });
      const result = await sobject.delete(sobjectId);
      expect(result).to.deep.equal({ id: sobjectId, success: true });
      expect(typeof result).to.equal('object');
    });
  });

  describe('retrieve', () => {
    it('should retrieve sobject using soap api', async () => {
      const sobject = new SObject({
        connection: (connectionStub as unknown) as Connection,
        sObjectType: 'Account',
      });
      const result = await sobject.retrieve(sobjectId);
      expect(result).to.deep.equal({ Id: sobjectId });
      expect(connectionStub.sobject.callCount).to.equal(1);
    });

    it('should retrieve new sobject using tooling api', async () => {
      const sobject = new SObject({
        connection: (connectionStub as unknown) as Connection,
        sObjectType: 'Account',
        useToolingApi: true,
      });
      const result = await sobject.retrieve(sobjectId);
      expect(result).to.deep.equal({ Id: sobjectId });
      expect(connectionStub.sobject.callCount).to.equal(0);
    });

    it('should only return a single result', async () => {
      const sobject = new SObject({
        connection: (connectionStub as unknown) as Connection,
        sObjectType: 'Account',
      });
      const result = await sobject.retrieve(sobjectId);
      expect(result).to.deep.equal({ Id: sobjectId });
      expect(typeof result).to.equal('object');
    });
  });

  describe('update', () => {
    it('should update sobject using soap api', async () => {
      const sobject = new SObject({
        connection: (connectionStub as unknown) as Connection,
        sObjectType: 'Account',
      });
      const result = await sobject.update(sobjectId, 'name=acme');
      expect(result).to.deep.equal({ id: sobjectId, success: true });
      expect(connectionStub.sobject.callCount).to.equal(1);
    });

    it('should update new sobject using tooling api', async () => {
      const sobject = new SObject({
        connection: (connectionStub as unknown) as Connection,
        sObjectType: 'Account',
        useToolingApi: true,
      });
      const result = await sobject.update(sobjectId, 'name=acme');
      expect(result).to.deep.equal({ id: sobjectId, success: true });
      expect(connectionStub.sobject.callCount).to.equal(0);
    });

    it('should only return a single result', async () => {
      const sobject = new SObject({
        connection: (connectionStub as unknown) as Connection,
        sObjectType: 'Account',
      });
      const result = await sobject.update(sobjectId, 'name=acme');
      expect(result).to.deep.equal({ id: sobjectId, success: true });
      expect(typeof result).to.equal('object');
    });
  });

  describe('query', () => {
    it('should return sobject using soap api', async () => {
      const sobject = new SObject({
        connection: (connectionStub as unknown) as Connection,
        sObjectType: 'Account',
      });
      const result = await sobject.query('name=acme');
      expect(result).to.deep.equal({ Id: sobjectId });
      expect(connectionStub.sobject.callCount).to.equal(1);
    });

    it('should update new sobject using tooling api', async () => {
      const sobject = new SObject({
        connection: (connectionStub as unknown) as Connection,
        sObjectType: 'Account',
        useToolingApi: true,
      });
      const result = await sobject.query('name=acme');
      expect(result).to.deep.equal({ Id: sobjectId });
      expect(connectionStub.sobject.callCount).to.equal(0);
    });

    it('should only return a single result', async () => {
      const sobject = new SObject({
        connection: (connectionStub as unknown) as Connection,
        sObjectType: 'Account',
      });
      const result = await sobject.query('name=acme');
      expect(result).to.deep.equal({ Id: sobjectId });
      expect(typeof result).to.equal('object');
    });
  });
});

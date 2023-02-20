/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import * as path from 'path';
import * as fs from 'fs';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { Messages, Org } from '@salesforce/core';
import { ImportApi, ImportConfig } from '../../../../src/api/data/tree/importApi';

// Json files
const dataImportPlanSchema = require('../../../../schema/dataImportPlanSchema.json');
const accountsContactsTreeJSON = require('./test-files/accounts-contacts-tree.json');
const accountsContactsPlanJSON = require('./test-files/accounts-contacts-plan.json');

// Sample response data
// const sampleResponseData = [
//   { referenceId: 'SampleAccountRef', id: '001xx000003DKpJAAW' },
//   { referenceId: 'SampleAcct2Ref', id: '001xx000003DKpKAAW' },
//   { referenceId: 'PresidentSmithRef', id: '003xx000004TtqCAAS' },
//   { referenceId: 'VPEvansRef', id: '003xx000004TtqIAAS' }
// ];

const sampleSObjectTypes = {
  SampleAccountRef: 'Account',
  SampleAcct2Ref: 'Account',
  PresidentSmithRef: 'Contact',
  VPEvansRef: 'Contact',
};

// Sample command display data
// const sampleDisplayData = [
//   { refId: 'SampleAccountRef', type: 'Account', id: '001xx000003DKpJAAW' },
//   { refId: 'SampleAcct2Ref', type: 'Account', id: '001xx000003DKpKAAW' },
//   { refId: 'PresidentSmithRef', type: 'Contact', id: '003xx000004TtqCAAS' },
//   { refId: 'VPEvansRef', type: 'Contact', id: '003xx000004TtqIAAS' }
// ];

const jsonRefRegex = /[.]*["|'][A-Z0-9_]*["|'][ ]*:[ ]*["|']@([A-Z0-9_]*)["|'][.]*/gim;

describe('ImportApi', () => {
  const sandbox = sinon.createSandbox();
  Messages.importMessagesDirectory(__dirname);
  const messages = Messages.loadMessages('@salesforce/plugin-data', 'importApi');

  afterEach(() => {
    sandbox.restore();
  });

  describe('validate', () => {
    let context: any;
    let config: ImportConfig;

    beforeEach(() => {
      context = {
        schemaValidator: {
          validate: sandbox.stub(),
        },
      };
      config = {};
    });

    it('should throw an InvalidDataImport error when both --sobjecttreefiles and --plan ARE NOT set', async () => {
      try {
        // @ts-ignore private method `validate`
        const rv = await ImportApi.prototype.validate.call(context, config);

        // this should never execute but if it does it will cause the test to fail
        expect(rv).to.throw('InvalidDataImport');
      } catch (err) {
        const error = err as Error;
        expect(error.name).to.equal('InvalidDataImport');
        expect(error.message).to.equal(messages.getMessage('dataFileNotProvided'));
      }
    });

    it('should throw an InvalidDataImport error when both --sobjecttreefiles and --plan ARE set', async () => {
      config = {
        sobjectTreeFiles: ['test_file.json'],
        plan: 'test_plan.json',
      };
      try {
        // @ts-ignore
        const rv = await ImportApi.prototype.validate.call(context, config);

        // this should never execute but if it does it will cause the test to fail
        expect(rv).to.throw('InvalidDataImport');
      } catch (err) {
        const error = err as Error;
        expect(error.name).to.equal('InvalidDataImport');
        expect(error.message).to.equal(messages.getMessage('tooManyFiles'));
      }
    });

    it('should validate a plan', async () => {
      config = {
        plan: path.join(__dirname, 'test-files', 'accounts-contacts-plan.json'),
      };
      context.schemaValidator.validate.returns(Promise.resolve());
      // @ts-ignore
      await ImportApi.prototype.validate.call(context, config);
      expect(context.schemaValidator.validate.calledWith(accountsContactsPlanJSON)).to.equal(true);
    });

    it('should throw an InvalidDataImport error with invalid path to plan file', async () => {
      config = {
        plan: './test/unit/data/non-existant-plan.json',
      };
      // @ts-ignore
      const expectedFilePath = path.resolve(process.cwd(), config.plan);
      try {
        // @ts-ignore
        const rv = await ImportApi.prototype.validate.call(context, config);

        // this should never execute but if it does it will cause the test to fail
        expect(rv).to.throw('InvalidDataImport');
      } catch (err) {
        const error = err as Error;
        expect(error.name).to.equal('InvalidDataImport');
        expect(error.message).to.equal(messages.getMessage('dataFileNotFound', [expectedFilePath]));
      }
    });

    it('should return a promise resolved with config with data file as input', async () => {
      config = {
        sobjectTreeFiles: [path.join(__dirname, 'test-files', 'accounts-contacts-tree.json')],
      };
      // @ts-ignore
      const opts = await ImportApi.prototype.validate.call(context, config);
      expect(opts).to.eql(config);
    });

    it('should return a promise resolved with config with plan file as input', async () => {
      config = {
        plan: path.join(__dirname, 'test-files', 'accounts-contacts-plan.json'),
      };
      context.schemaValidator.validate.returns(Promise.resolve());
      // @ts-ignore
      const opts = await ImportApi.prototype.validate.call(context, config);
      expect(opts).to.eql(config);
    });
  });

  describe('import', () => {
    let config: ImportConfig;
    const refMap = new Map();
    const instanceUrl = 'what is it';
    const filepath = 'the_filepath';
    const contentType = 'json';
    const context: any = {
      importSObjectTreeFile: () => {},
      org: {
        getField: () => instanceUrl,
      },
      validate: sandbox.stub(),
    };

    beforeEach(() => {
      config = { contentType };
      sandbox.stub(context, 'importSObjectTreeFile').resolves({});
      sandbox.stub(path, 'resolve').callsFake(() => filepath);
      sandbox.stub(path, 'dirname').callsFake(() => filepath);
      context.validate.resolves(config);
    });

    it('should call importSObjectTreeFile once with correct args for single file import', async () => {
      config.sobjectTreeFiles = ['data_file1.json'];
      await ImportApi.prototype.import.call(context, config);
      expect(context.importSObjectTreeFile.calledOnce).to.be.true;
      const expectedArgs = { instanceUrl, refMap, filepath, contentType };
      expect(context.importSObjectTreeFile.firstCall.args[0]).to.deep.equal(expectedArgs);
    });

    it('should call importSObjectTreeFile twice with correct args when importing 2 files, comma delimited', async () => {
      config.sobjectTreeFiles = ['data_file1.json', 'data_file2.json'];
      await ImportApi.prototype.import.call(context, config);
      expect(context.importSObjectTreeFile.calledTwice).to.be.true;
      const expectedArgs = { instanceUrl, refMap, filepath, contentType };
      expect(context.importSObjectTreeFile.firstCall.args[0]).to.deep.equal(expectedArgs);
    });

    // says this.getPlanPromises is not a function...some weird test context?
    it.skip('should call importSObjectTreeFile for plan import', async () => {
      const saveRefs = true;
      const resolveRefs = true;
      config.plan = 'data_plan.json';
      context.importPlanConfig = [
        {
          sobject: 'Broker__c',
          saveRefs,
          files: ['brokers-data.json'],
        },
        {
          sobject: 'Property__c',
          resolveRefs,
          files: ['properties-data.json'],
        },
      ];
      await ImportApi.prototype.import.call(context, config);

      expect(context.importSObjectTreeFile.callCount).to.equal(2);
      const expectedArgs1 = {
        instanceUrl,
        saveRefs,
        resolveRefs: false,
        refMap,
        filepath,
        contentType,
      };
      const expectedArgs2 = {
        instanceUrl,
        saveRefs: false,
        resolveRefs,
        refMap,
        filepath,
        contentType,
      };
      expect(context.importSObjectTreeFile.firstCall.args[0]).to.deep.equal(expectedArgs1);
      expect(context.importSObjectTreeFile.secondCall.args[0]).to.deep.equal(expectedArgs2);
    });
  });

  describe('createSObjectTypeMap', () => {
    const contentStr = JSON.stringify(accountsContactsTreeJSON);
    let context: any;

    beforeEach(() => {
      context = {
        sobjectTypes: {},
      };
    });

    it('should set this.sobjectTypes using JSON data', () => {
      // @ts-ignore
      ImportApi.prototype.createSObjectTypeMap.call(context, contentStr, true);
      expect(context.sobjectTypes).to.eql(sampleSObjectTypes);
    });

    // This will need to be updated when XML importing is supported
    it('should NOT set this.sobjectTypes using non-JSON data', () => {
      // @ts-ignore
      ImportApi.prototype.createSObjectTypeMap.call(context, contentStr, false);
      expect(context.sobjectTypes).to.eql({});
    });
  });

  describe('getSObjectTreeFileMeta', () => {
    it('should return expected import file metadata for json file without specifying content-type', () => {
      const expectedMeta = {
        isJson: true,
        refRegex: jsonRefRegex,
        headers: {
          'content-type': 'application/json',
        },
      };
      const filepath = path.join(__dirname, 'test-files', 'contacts-only-2.json');
      const rv = ImportApi.prototype.getSObjectTreeFileMeta(filepath);
      expect(rv).to.eql(expectedMeta);
    });

    it('should return expected import file metadata for json file with specifying content-type', () => {
      const expectedMeta = {
        isJson: true,
        refRegex: jsonRefRegex,
        headers: {
          'content-type': 'application/json',
        },
      };
      const filepath = path.join(__dirname, 'test-files', 'contacts-only-2.sdx');
      const rv = ImportApi.prototype.getSObjectTreeFileMeta(filepath, 'json');
      expect(rv).to.eql(expectedMeta);
    });

    it('should throw an InvalidDataImport error with invalid path to data file', () => {
      const filepath = path.join(__dirname, 'test-files', 'invalid-data-file.json');
      try {
        const rv = ImportApi.prototype.getSObjectTreeFileMeta(filepath);
        // this should never execute but if it does it will cause the test to fail
        expect(rv).to.throw('InvalidDataImport');
      } catch (err) {
        const error = err as Error;
        expect(error.name).to.equal('InvalidDataImport');
        expect(error.message).to.equal(messages.getMessage('dataFileNotFound', [filepath]));
      }
    });

    it('should throw an InvalidDataImport error with unknown data file extention and no content-type', () => {
      const filepath = path.join(__dirname, 'test-files', 'contacts-only-2.sdx');
      try {
        const rv = ImportApi.prototype.getSObjectTreeFileMeta(filepath);
        // this should never execute but if it does it will cause the test to fail
        expect(rv).to.throw('InvalidDataImport');
      } catch (err) {
        const error = err as Error;
        expect(error.name).to.equal('InvalidDataImport');
        expect(error.message).to.equal(`Unable to determine content type for file: ${filepath}.`);
      }
    });

    it('should throw an InvalidDataImport error with unknown data file extension and unsupported content-type', () => {
      const filepath = path.join(__dirname, 'test-files', 'contacts-only-2.sdx');
      try {
        const rv = ImportApi.prototype.getSObjectTreeFileMeta(filepath, 'txt');
        // this should never execute but if it does it will cause the test to fail
        expect(rv).to.throw('InvalidDataImport');
      } catch (err) {
        const error = err as Error;
        expect(error.name).to.equal('InvalidDataImport');
        expect(error.message).to.equal('Content type: txt not supported.');
      }
    });
  });

  describe('parseSObjectTreeFile', () => {
    const context: any = {
      logger: {
        warn: () => {},
        debug: () => {},
      },
      createSObjectTypeMap: sinon.spy(),
    };
    let filepath: string;
    let isJson: boolean;
    let refRegex: RegExp;
    let resolveRefs: boolean;
    let refMap: any;

    beforeEach(() => {
      filepath = path.join(__dirname, 'test-files', 'accounts-contacts-tree.json');
      isJson = true;
      refRegex = jsonRefRegex;
      resolveRefs = false;
      refMap = new Map();
    });

    it('should call this.createSObjectTypeMap() with correct args', () =>
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      ImportApi.prototype.parseSObjectTreeFile
        .call(context, filepath, isJson, refRegex, resolveRefs, refMap)
        .then(() => {
          const actualArgs = context.createSObjectTypeMap.args[0];
          expect(JSON.parse(actualArgs[0] as string)).to.eql(accountsContactsTreeJSON);
          expect(actualArgs[1]).to.eql(isJson);
        }));

    it('should return a Promise resolved with the contentStr and sobject', () =>
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      ImportApi.prototype.parseSObjectTreeFile
        .call(context, filepath, isJson, refRegex, resolveRefs, refMap)
        .then((rv) => {
          expect(JSON.parse(rv.contentStr)).to.eql(accountsContactsTreeJSON);
          expect(rv.sobject).to.eql('account');
        }));

    it('should return an FlsError type error, or catch and wrap the error', () => {
      const SfError = messages.createError('FlsError', ['field__c', 'object__c']);
      // @ts-ignore
      sandbox.stub(ImportApi.prototype, 'parseSObjectTreeFile').throws(SfError);

      expect(() =>
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        ImportApi.prototype.parseSObjectTreeFile.call(context, filepath, isJson, refRegex, resolveRefs, refMap)
      ).to.throw(
        "We couldn't process your request because you don't have access to field__c on object__c. To learn more about field-level security, visit Tips and Hints for Page Layouts and Field-Level Security in our Developer Documentation."
      );
    });

    it('should resolve saved references', () => {
      resolveRefs = true;
      filepath = path.join(__dirname, 'test-files', 'contacts-only-1.json');
      refMap.set('sampleaccountref', 'test_account_id1');
      refMap.set('sampleacct2ref', 'test_account_id2');
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return ImportApi.prototype.parseSObjectTreeFile
        .call(context, filepath, isJson, refRegex, resolveRefs, refMap)
        .then((rv) => {
          const contentJson = JSON.parse(rv.contentStr);
          expect(contentJson.records[0].AccountId).to.equal(refMap.get('sampleaccountref'));
          expect(contentJson.records[1].AccountId).to.equal(refMap.get('sampleacct2ref'));
        });
    });

    it('should resolve saved references of custom objects', () => {
      const fileContents = `{
                "records": [{
                    "attributes": {
                        "type": "Property__c",
                        "referenceId": "Property__cRef1"
                    },
                    "Name": "Seaport District Retreat",
                    "Price__c": 450000,
                    "Broker__c": "@CustomObj__cRef1"
                },{
                    "attributes": {
                        "type": "Property__c",
                        "referenceId": "Property__cRef2"
                    },
                    "Name": "Brendom Docks",
                    "Price__c": 950000,
                    "Broker__c": "@CustomObj__cRef2"
                },{
                    "attributes": {
                        "type": "Property__c",
                        "referenceId": "Property__cRef20"
                    },
                    "Name": "Brendom Docks",
                    "Price__c": 950000,
                    "Broker__c": "@CustomObj__cRef20"
                }]
            }`;
      sandbox.stub(fs.promises, 'readFile').resolves(fileContents);
      resolveRefs = true;
      filepath = '';
      refMap.set('customobj__cref1', 'custom_id1');
      refMap.set('customobj__cref2', 'custom_id2');
      refMap.set('customobj__cref20', 'custom_id3');
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return ImportApi.prototype.parseSObjectTreeFile
        .call(context, filepath, isJson, refRegex, resolveRefs, refMap)
        .then((rv) => {
          const contentJson = JSON.parse(rv.contentStr);
          expect(contentJson.records[0].Broker__c).to.equal(refMap.get('customobj__cref1'));
          expect(contentJson.records[1].Broker__c).to.equal(refMap.get('customobj__cref2'));
          expect(contentJson.records[2].Broker__c).to.equal(refMap.get('customobj__cref20'));
        });
    });
  });

  describe('sendSObjectTreeRequest', () => {
    const requestStub = sinon.stub().resolves();
    const context = {
      sobjectUrlMap: new Map(),
      logger: {
        debug: () => {},
      },
      org: {
        getConnection: () => ({
          getApiVersion: () => '50.0',
          request: requestStub,
        }),
      },
    };

    const contentStr = 'test_content_str';
    const sobject = 'test_sobject';
    const headers = 'test_headers';

    afterEach(() => {
      requestStub.reset();
    });

    it('should call request() with correct args', () => {
      const sobjectTreeApiUrl = 'test_instance_url/services/data/v50.0/composite/tree/test_sobject';
      const expectedArgs = {
        method: 'POST',
        url: sobjectTreeApiUrl,
        body: contentStr,
        headers,
      };
      // @ts-ignore
      void ImportApi.prototype.sendSObjectTreeRequest.call(context, contentStr, sobject, 'test_instance_url', headers);
      expect(requestStub.args[0][0]).to.eql(expectedArgs);
    });

    it('should call request() with correct args using sobjectUrlMap', () => {
      const sobjectTreeApiUrl = 'test_sobject_tree_api_url';
      context.sobjectUrlMap.get = () => sobjectTreeApiUrl;
      const expectedArgs = {
        method: 'POST',
        url: sobjectTreeApiUrl,
        body: contentStr,
        headers,
      };
      // @ts-ignore
      void ImportApi.prototype.sendSObjectTreeRequest.call(context, contentStr, sobject, 'test_instance_url', headers);
      expect(requestStub.args[0][0]).to.eql(expectedArgs);
    });
  });

  describe('parseSObjectTreeResponse', () => {
    let context: any;
    let response: any;
    let filepath: string;
    let isJson: boolean;
    let saveRefs: boolean;
    let refMap: any;

    beforeEach(() => {
      context = {
        logger: {
          debug: () => {},
        },
        responseRefs: [],
      };
      response = { results: [] };
      filepath = 'test_file_path';
      isJson = true;
      saveRefs = false;
      refMap = new Map();
    });

    it('should return a Promise resolved with the response', () => {
      // @ts-ignore
      const rv: any = ImportApi.prototype.parseSObjectTreeResponse.call(
        context,
        response,
        filepath,
        isJson,
        saveRefs,
        refMap
      );
      expect(rv).to.eql(response);
    });

    it('should add the response results to the responseRefs array', () => {
      response.results = [
        { referenceId: '1000x', id: 1 },
        { referenceId: '2000x', id: 2 },
        { referenceId: '3000x', id: 3 },
      ];
      context.responseRefs.push({ referenceId: 9 });
      // @ts-ignore
      ImportApi.prototype.parseSObjectTreeResponse.call(context, response, filepath, isJson, saveRefs, refMap);
      expect(context.responseRefs).to.eql([{ referenceId: 9 }, ...response.results]);
    });

    it('should save refs to the refMap if args.saveRefs is true', () => {
      response.results = [
        { referenceId: '1000x', id: 1 },
        { referenceId: '2000x', id: 2 },
        { referenceId: '3000x', id: 3 },
      ];
      saveRefs = true;
      const expectedRefMap = new Map<string, number>();
      response.results.reduce(
        (map: Map<string, number>, res: any) => map.set(res.referenceId as string, res.id as number),
        expectedRefMap
      );
      // @ts-ignore
      ImportApi.prototype.parseSObjectTreeResponse.call(context, response, filepath, isJson, saveRefs, refMap);
      expect(refMap).to.eql(expectedRefMap);
    });
  });

  describe('importSObjectTreeFile', () => {
    const testResponse = 'test_response';
    const testMeta = {
      isJson: true,
      refRegex: 'test_ref_regex',
      headers: 'test_headers',
    };
    const testParseResults = {
      contentStr: 'test_content_str',
      sobject: 'test_sobject',
    };
    const context: any = {
      logger: {
        debug: () => {},
      },
    };

    const args = {
      instanceUrl: 'test_instance_url',
      saveRefs: 'test_save_refs',
      resolveRefs: 'test_resolve_refs',
      refMap: 'test_ref_map',
      filepath: 'test_file_path',
      contentType: 'test_content_type',
    };

    beforeEach(() => {
      context.getSObjectTreeFileMeta = sinon.stub().returns(testMeta);
      context.parseSObjectTreeFile = sinon.stub().resolves(testParseResults);
      context.sendSObjectTreeRequest = sinon.stub().resolves(testResponse);
      context.parseSObjectTreeResponse = sinon.stub();
    });

    it('should call getSObjectTreeFileMeta 1st with correct args', async () => {
      // @ts-ignore
      await ImportApi.prototype.importSObjectTreeFile.call(context, args);
      expect(context.getSObjectTreeFileMeta.calledBefore(context.parseSObjectTreeFile)).to.equal(true);
      expect(context.getSObjectTreeFileMeta.calledWith(args.filepath, args.contentType)).to.equal(true);
    });

    it('should call parseSObjectTreeFile 2nd with correct args', async () => {
      // @ts-ignore
      await ImportApi.prototype.importSObjectTreeFile.call(context, args);
      expect(context.parseSObjectTreeFile.calledAfter(context.getSObjectTreeFileMeta)).to.equal(true);
      expect(context.parseSObjectTreeFile.calledBefore(context.sendSObjectTreeRequest)).to.equal(true);
      expect(
        context.parseSObjectTreeFile.calledWith(
          args.filepath,
          testMeta.isJson,
          testMeta.refRegex,
          args.resolveRefs,
          args.refMap
        )
      ).to.equal(true);
    });

    it('should call sendSObjectTreeRequest 3rd with correct args', async () => {
      // @ts-ignore
      await ImportApi.prototype.importSObjectTreeFile.call(context, args);
      const { contentStr, sobject } = testParseResults;
      expect(context.sendSObjectTreeRequest.calledAfter(context.parseSObjectTreeFile)).to.equal(true);
      expect(context.sendSObjectTreeRequest.calledBefore(context.parseSObjectTreeResponse)).to.equal(true);
      expect(
        context.sendSObjectTreeRequest.calledWith(contentStr, sobject, args.instanceUrl, testMeta.headers)
      ).to.equal(true);
    });

    it('should call parseSObjectTreeResponse 4th with correct args', async () => {
      // @ts-ignore
      await ImportApi.prototype.importSObjectTreeFile.call(context, args);
      const { filepath, saveRefs, refMap } = args;
      expect(context.parseSObjectTreeResponse.calledAfter(context.sendSObjectTreeRequest)).to.be.true;
      expect(
        context.parseSObjectTreeResponse.calledWith(testResponse, filepath, testMeta.isJson, saveRefs, refMap)
      ).to.equal(true);
    });
  });

  describe('getSchema', () => {
    it('should return the schema', () => {
      const org = new Org({ aliasOrUsername: 'import@test.org' });
      const importApi = new ImportApi(org, 'sfdx', ':');
      expect(importApi.getSchema()).to.deep.equal(dataImportPlanSchema);
    });
  });
});

/**
 * Use these as the basis for integration tests.
 */
// describe('data:import', () => {
//   let force;
//   let org;

//   before(() => {
//     workspace = new TestWorkspace();
//     org = new Org();
//     force = org.force;

//     sandbox.stub(force, 'describeData').callsFake(() => Promise.resolve());

//     // copy data files to workspace
//     fse.copySync(path.join(dir, 'data'), path.join(workspace.getWorkspacePath(), 'data'));

//     // Some test require a scratch org config in the workspace
//     return workspace
//       .configureHubOrg()
//       .then(() => org.saveConfig(orgConfig))
//       .then(() => workspace.configureWorkspaceScratchOrg());
//   });

//   after(() => {
//     workspace.clean();
//   });

//   afterEach(() => {
//     sandbox.restore();
//   });

//   describe('DataTreeImportCommand run()', () => {
//     it('should output the plan schema when confighelp flag specified', async () => {
//       const context = {
//         flags: {
//           confighelp: true,
//           json: true
//         },
//         org: new Org()
//       };
//       const dataTreeImportCommand = new DataTreeImportCommand([], null);
//       set(dataTreeImportCommand, 'ux', { log: sandbox.spy() });
//       sandbox.stub(dataTreeImportCommand as any, 'resolveLegacyContext').callsFake(() => Promise.resolve(context));

//       const outputJson = await dataTreeImportCommand.run();
//       expect(outputJson).to.deep.equal(dataImportPlanSchema);
//     });
//   });

//   // Test importing a single data file
//   describe('#File', () => {
//     beforeEach(() => {
//       sandbox.stub(force, 'request').callsFake(() =>
//         Promise.resolve({
//           hasErrors: false,
//           results: sampleResponseData
//         })
//       );
//     });

//     it('API: Should insert Accounts and child Contacts', () => {
//       const dataImportCmd = new DataImportApi(org);
//       const config = {
//         json: true,
//         username,
//         sobjecttreefiles: './data/accounts-contacts-tree.json'
//       };

//       return dataImportCmd.execute(config).then(result => {
//         expect(result).to.eql(sampleDisplayData);
//       });
//     });
//   });

//   // test importing via plan
//   describe('#Plan', () => {
//     const contactsOnly1 = [
//       { referenceId: 'FrontDeskRef', id: '003xx000004TtqwAAC' },
//       { referenceId: 'ManagerRef', id: '003xx000004TtqxAAC' }
//     ];
//     const contactsOnly2 = [
//       { referenceId: 'JanitorRef', id: '003xx000004Ttr1AAC' },
//       { referenceId: 'DeveloperRef', id: '003xx000004Ttr2AAC' }
//     ];

//     const sampleDisplayContacts1 = [
//       { refId: 'FrontDeskRef', type: 'Contact', id: '003xx000004TtqwAAC' },
//       { refId: 'ManagerRef', type: 'Contact', id: '003xx000004TtqxAAC' }
//     ];

//     const sampleDisplayContacts2 = [
//       { refId: 'JanitorRef', type: 'Contact', id: '003xx000004Ttr1AAC' },
//       { refId: 'DeveloperRef', type: 'Contact', id: '003xx000004Ttr2AAC' }
//     ];

//     let requestStub;

//     beforeEach(() => {
//       requestStub = sandbox.stub(force, 'request');
//       requestStub.onCall(0).returns(Promise.resolve({ hasErrors: false, results: sampleResponseData }));
//       requestStub.onCall(1).returns(Promise.resolve({ hasErrors: false, results: contactsOnly1 }));
//       requestStub.onCall(2).returns(Promise.resolve({ hasErrors: false, results: contactsOnly2 }));
//     });

//     it('API: Should insert Accounts and child Contacts', () => {
//       const dataImportCmd = new DataImportApi(org);
//       const config = {
//         json: true,
//         username,
//         plan: './data/accounts-contacts-plan.json',
//         importPlanConfig: accountsContactsPlanJSON
//       };
//       const expected = [...sampleDisplayData, ...sampleDisplayContacts1, ...sampleDisplayContacts2];

//       return dataImportCmd.execute(config).then(result => {
//         expect(result).to.eql(expected);
//       });
//     });
//   });

//   describe('DataImportConfigHelpCommand', () => {
//     it('should return the schema', () => {
//       const dataImportConfigHelpCommand = new DataImportConfigHelpCommand();
//       return dataImportConfigHelpCommand.execute({ org }).then(result => {
//         expect(result).to.deep.equal(dataImportPlanSchema);
//       });
//     });
//   });
// });

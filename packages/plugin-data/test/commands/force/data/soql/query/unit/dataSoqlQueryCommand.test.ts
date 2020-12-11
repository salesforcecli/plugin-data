/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable no-shadow-restricted-names */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
// import { expect } from 'chai';
// import { Connection, QueryResult } from 'jsforce';
//
// import { AuthInfo, AuthInfoConfig, Logger, Org } from '@salesforce/core';
// import sinon = require('sinon');
// import { DataSoqlQueryExecutor } from '../../../../../../../src/dataSoqlQueryExecutor';
// import * as TestUtil from '../../../../../../testUtil';
// import { CsvReporter, HumanReporter } from '../../../../../../../lib/reporters';

chai.use(chaiAsPromised);

describe('Execute a SOQL statement', function (): void {
  // let sandbox: any;
  // beforeEach(() => {
  //   sandbox = sinon.createSandbox();
  // });
  // afterEach(() => {
  //   sandbox.restore();
  // });
  // describe('force:soql:query', function (): void {
  //   describe('Argument handling tests', function (): void {
  //     let toolingSpy: sinon.SinonSpy;
  //     let querySpy: sinon.SinonSpy;
  //     const fakeConnection = TestUtil.createBaseFakeConnection();
  //
  //     beforeEach(() => {
  //       toolingSpy = sandbox
  //         .stub(fakeConnection.tooling, 'query')
  //         .callsFake(async function (): Promise<QueryResult<unknown>> {
  //           return new Promise<QueryResult<unknown>>(function (resolve) {
  //             resolve({} as QueryResult<unknown>);
  //           });
  //         });
  //       querySpy = sandbox.stub(fakeConnection, 'query').callsFake(async function (): Promise<QueryResult<unknown>> {
  //         return new Promise<QueryResult<unknown>>(function (resolve) {
  //           resolve({} as QueryResult<unknown>);
  //         });
  //       });
  //       sandbox.stub(Org, 'create').callsFake(async function (): Promise<Org> {
  //         return new Promise<Org>(function (resolve) {
  //           resolve(new Org({}));
  //         });
  //       });
  //       sandbox.stub(Org.prototype, 'getConnection').callsFake(function (): Connection {
  //         return fakeConnection;
  //       });
  //       sandbox.stub(AuthInfo.prototype, 'loadAuthFromConfig').callsFake(async function (): Promise<AuthInfoConfig> {
  //         return new Promise<AuthInfoConfig>(function (resolve) {
  //           resolve({} as AuthInfoConfig);
  //         });
  //       });
  //     });
  //
  //     it('Should throw error on no flags', async function (): Promise<void> {
  //       const dataSoqlQueryExecutor = new DataSoqlQueryExecutor();
  //       expect(dataSoqlQueryExecutor.execute(this.getConnection(), this.flags.query)).to.be.rejectedWith(Error);
  //     });
  //
  //     it('Should query with the query api', async function (): Promise<void> {
  //       const dataSoqlQueryExecutor = new DataSoqlQueryExecutor();
  //       await dataSoqlQueryExecutor.execute(this.getConnection(), this.flags.query);
  //       sinon.assert.notCalled(toolingSpy);
  //       sinon.assert.calledOnce(querySpy);
  //     });
  //
  //     it('Should query with the tooling api', async function (): Promise<void> {
  //       const dataSoqlQueryExecutor = new DataSoqlQueryExecutor();
  //       await dataSoqlQueryExecutor.execute(this.getConnection(), this.flags.query);
  //       sinon.assert.calledOnce(toolingSpy);
  //       sinon.assert.notCalled(querySpy);
  //     });
  //
  //     it('Should throw error with only the username flag', async function (): Promise<void> {
  //       const dataSoqlQueryExecutor = new DataSoqlQueryExecutor();
  //       expect(dataSoqlQueryExecutor.execute(this.getConnection(), this.flags.query)).to.be.rejectedWith(Error);
  //     });
  //   });
  //   describe('Handle no records tests', function (): void {
  //     const fakeConnection: Connection = new Connection({});
  //     let querySpy: sinon.SinonSpy;
  //     let moreSpy: sinon.SinonSpy;
  //     let displayTableSpy: sinon.SinonSpy;
  //
  //     beforeEach(function (): void {
  //       sandbox.stub(Org, 'create').callsFake(async function (): Promise<Org> {
  //         return new Promise<Org>(function (resolve) {
  //           resolve(new Org({}));
  //         });
  //       });
  //       sandbox.stub(Org.prototype, 'getConnection').callsFake(function (): Connection {
  //         return fakeConnection;
  //       });
  //       sandbox.stub(AuthInfo.prototype, 'loadAuthFromConfig').callsFake(async function (): Promise<AuthInfoConfig> {
  //         return new Promise<AuthInfoConfig>(function (resolve) {
  //           resolve({} as AuthInfoConfig);
  //         });
  //       });
  //       sandbox.stub(fakeConnection, 'request').callsFake(() => Promise.resolve({ columnMetadata: [] }));
  //       querySpy = sandbox
  //         .stub(fakeConnection, 'query')
  //         .callsFake(async function (query: string): Promise<QueryResult<unknown>> {
  //           return Promise.resolve({
  //             done: true,
  //             totalSize: 0,
  //             records: [],
  //           });
  //         });
  //       moreSpy = sandbox.stub(fakeConnection, 'queryMore');
  //       displayTableSpy = sandbox.stub(HumanReporter.prototype, 'display').callsFake(function (): void {});
  //     });
  //
  //     it('Should fetch no results and return no results message', async function (): Promise<void> {
  //       const dataSoqlQueryExecutor = new DataSoqlQueryExecutor();
  //       await dataSoqlQueryExecutor.execute(this.getConnection(), this.flags.query);
  //       sinon.assert.calledOnce(querySpy);
  //       sinon.assert.notCalled(moreSpy);
  //       sinon.assert.notCalled(displayTableSpy);
  //     });
  //
  //     it('Should fetch no results with json flag and return no results message', async function (): Promise<void> {
  //       const dataSoqlQueryExecutor = new DataSoqlQueryExecutor();
  //       const result: QueryResult<unknown> = await dataSoqlQueryExecutor.execute(
  //         this.getConnection(),
  //         this.flags.query
  //       );
  //       sinon.assert.calledOnce(querySpy);
  //       sinon.assert.notCalled(moreSpy);
  //       chai.expect(result.done).is.equal(true);
  //       chai.expect(result.totalSize).is.equal(0);
  //     });
  //   });
  //
  //   describe('Handle single batch results tests', function (): void {
  //     const fakeConnection: Connection = new Connection({});
  //     let querySpy: sinon.SinonSpy;
  //     let moreSpy: sinon.SinonSpy;
  //     let displaySpy: sinon.SinonSpy;
  //     let fakeResult: QueryResult<unknown> = {
  //       done: true,
  //       totalSize: 1,
  //       records: [{}],
  //     };
  //
  //     beforeEach(function (): void {
  //       displaySpy = sandbox.stub(HumanReporter.prototype, 'display').callsFake(function (): void {});
  //       sandbox.stub(Logger.prototype, 'info').callsFake(function (): void {});
  //       sandbox.stub(Org, 'create').callsFake(async function (): Promise<Org> {
  //         return new Promise<Org>(function (resolve) {
  //           resolve(new Org({}));
  //         });
  //       });
  //       sandbox.stub(Org.prototype, 'getConnection').callsFake(function (): Connection {
  //         return fakeConnection;
  //       });
  //       sandbox.stub(AuthInfo.prototype, 'loadAuthFromConfig').callsFake(async function (): Promise<AuthInfoConfig> {
  //         return new Promise<AuthInfoConfig>(function (resolve) {
  //           resolve({} as AuthInfoConfig);
  //         });
  //       });
  //       sandbox.stub(fakeConnection, 'request').callsFake(() => Promise.resolve({ columnMetadata: [] }));
  //       moreSpy = sandbox.stub(fakeConnection, 'queryMore');
  //       querySpy = sandbox
  //         .stub(fakeConnection, 'query')
  //         .callsFake(async function (query: string): Promise<QueryResult<unknown>> {
  //           return Promise.resolve(fakeResult);
  //         });
  //     });
  //
  //     it('Should fetch batched results', async function (): Promise<void> {
  //       const dataSoqlQueryExecutor = new DataSoqlQueryExecutor();
  //       await dataSoqlQueryExecutor.execute(this.getConnection(), this.flags.query);
  //       sinon.assert.calledOnce(querySpy);
  //       sinon.assert.notCalled(moreSpy);
  //       sinon.assert.calledOnce(displaySpy);
  //     });
  //
  //     it('Should fetch batched results with json flag', async function (): Promise<void> {
  //       const dataSoqlQueryExecutor = new DataSoqlQueryExecutor();
  //       const context = {
  //         flags: { query: 'TEST QUERY', json: true },
  //         ux: {
  //           startSpinner: () => {},
  //           stopSpinner: () => {},
  //           table: () => {},
  //         },
  //       };
  //       dataSoqlQueryExecutor.validate(context);
  //       const result: QueryResult<unknown> = await dataSoqlQueryExecutor.execute(
  //         this.getConnection(),
  //         this.flags.query
  //       );
  //       sinon.assert.calledOnce(querySpy);
  //       sinon.assert.notCalled(moreSpy);
  //       chai.expect(result.done).is.equal(true);
  //       chai.expect(result.totalSize).is.equal(1);
  //     });
  //
  //     it('Should fetch with BigObjects invalid totalSize', async function (): Promise<void> {
  //       fakeResult = { done: true, totalSize: -1, records: [{}] };
  //       const dataSoqlQueryExecutor = new DataSoqlQueryExecutor();
  //       await dataSoqlQueryExecutor.execute(this.getConnection(), this.flags.query);
  //       sinon.assert.calledOnce(querySpy);
  //       sinon.assert.notCalled(moreSpy);
  //       sinon.assert.calledOnce(displaySpy);
  //     });
  //   });
  //
  //   describe('Handle batched results tests', function (): void {
  //     const fakeConnection: Connection = new Connection({});
  //     let getActiveConnectionStub: sinon.SinonSpy;
  //     let querySpy: sinon.SinonSpy;
  //     let moreStub: sinon.SinonStub;
  //     let displaySpy: sinon.SinonSpy;
  //
  //     beforeEach(function (): void {
  //       sandbox.stub(Logger.prototype, 'info').callsFake(function (): void {});
  //       sandbox.stub(Org, 'create').callsFake(async function (): Promise<Org> {
  //         return new Promise<Org>(function (resolve) {
  //           resolve(new Org({}));
  //         });
  //       });
  //       getActiveConnectionStub = sandbox.stub(Org.prototype, 'getConnection').callsFake(function (): Connection {
  //         return fakeConnection;
  //       });
  //       sandbox.stub(AuthInfo.prototype, 'loadAuthFromConfig').callsFake(async function (): Promise<AuthInfoConfig> {
  //         return new Promise<AuthInfoConfig>(function (resolve) {
  //           resolve({} as AuthInfoConfig);
  //         });
  //       });
  //       sandbox.stub(fakeConnection, 'request').callsFake(() => Promise.resolve({ columnMetadata: [] }));
  //       querySpy = sandbox
  //         .stub(fakeConnection, 'query')
  //         .callsFake(async function (query: string): Promise<QueryResult<unknown>> {
  //           return Promise.resolve({
  //             done: false,
  //             totalSize: 5000,
  //             records: [{}],
  //             nextRecordsUrl: 'url',
  //           });
  //         });
  //       moreStub = sandbox
  //         .stub(fakeConnection, 'queryMore')
  //         .onFirstCall()
  //         .returns({
  //           done: false,
  //           totalSize: 5000,
  //           records: [{}],
  //           nextRecordsUrl: 'url',
  //         })
  //         .onSecondCall()
  //         .returns({
  //           done: true,
  //           totalSize: 5000,
  //           records: [{}],
  //           nextRecordsUrl: 'url',
  //         });
  //       displaySpy = sandbox.stub(HumanReporter.prototype, 'display').callsFake(function (): void {});
  //     });
  //
  //     it('Should fetched batched results twice', async function (): Promise<void> {
  //       const dataSoqlQueryExecutor = new DataSoqlQueryExecutor();
  //       await dataSoqlQueryExecutor.execute(this.getConnection(), this.flags.query);
  //       sinon.assert.calledOnce(querySpy);
  //       sinon.assert.calledTwice(moreStub);
  //       sinon.assert.calledOnce(displaySpy);
  //     });
  //
  //     it('Should fetched batched results twice with json flag', async function (): Promise<void> {
  //       const dataSoqlQueryExecutor = new DataSoqlQueryExecutor();
  //       const context = {
  //         flags: { query: 'TEST QUERY', json: true },
  //         ux: {
  //           startSpinner: () => {},
  //           stopSpinner: () => {},
  //           table: () => {},
  //         },
  //       };
  //       dataSoqlQueryExecutor.validate(context);
  //       const result: QueryResult<unknown> = await dataSoqlQueryExecutor.execute(
  //         this.getConnection(),
  //         this.flags.query
  //       );
  //       sinon.assert.calledOnce(querySpy);
  //       sinon.assert.calledTwice(moreStub);
  //       sinon.assert.notCalled(displaySpy);
  //       chai.expect(result.done).is.equal(true);
  //       chai.expect(result.totalSize).is.equal(5000);
  //     });
  //
  //     it('Should fetched batched results twice with tooling', async function (): Promise<void> {
  //       getActiveConnectionStub.restore();
  //       sandbox.stub(Org.prototype, 'getConnection').callsFake(function (): Connection {
  //         return { tooling: fakeConnection } as any;
  //       });
  //       const dataSoqlQueryExecutor = new DataSoqlQueryExecutor();
  //       const context = {
  //         flags: { query: 'TEST QUERY', usetoolingapi: true },
  //         ux: {
  //           startSpinner: () => {},
  //           stopSpinner: () => {},
  //           table: () => {},
  //         },
  //       };
  //       dataSoqlQueryExecutor.validate(context);
  //       const result: QueryResult<unknown> = await dataSoqlQueryExecutor.execute(
  //         this.getConnection(),
  //         this.flags.query
  //       );
  //       sinon.assert.calledOnce(querySpy);
  //       sinon.assert.calledTwice(moreStub);
  //       sinon.assert.calledOnce(displaySpy);
  //       chai.expect(result.done).is.equal(true);
  //       chai.expect(result.totalSize).is.equal(5000);
  //     });
  //   });
  // });
  //
  // describe('CSV', function (): void {
  //   let reporter: any;
  //   let output: any;
  //
  //   beforeEach(function (): void {
  //     output = '';
  //   });
  //
  //   const createReporter = async (query: string, columnData: any) => {
  //     const conn = TestUtil.createBaseFakeConnection();
  //     sandbox.stub(conn, 'request').returns(Promise.resolve(columnData));
  //     reporter = new CsvReporter(conn, query);
  //     sandbox.stub(reporter, 'getBaseUrl').returns('');
  //     sandbox.stub(reporter, 'log').callsFake((data: any) => {
  //       // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  //       output += `${data}\n`;
  //     });
  //     await reporter.retrieveColumns();
  //   };
  //
  //   it('log single record with single property', async function (): Promise<void> {
  //     await createReporter('SELECT Name FROM TestObject', {
  //       columnMetadata: [
  //         {
  //           columnName: 'Name',
  //           displayName: 'Name',
  //           aggregate: false,
  //           joinColumns: [],
  //         },
  //       ],
  //     });
  //     reporter.emit('finished', [
  //       {
  //         Name: 'test',
  //       },
  //     ]);
  //     expect(output).to.equal('Name\ntest\n');
  //   });
  //
  //   it('log single record with multi property', async function (): Promise<void> {
  //     await createReporter('SELECT Name, Phone FROM TestObject', {
  //       columnMetadata: [
  //         {
  //           columnName: 'Name',
  //           displayName: 'Name',
  //           aggregate: false,
  //           joinColumns: [],
  //         },
  //         {
  //           columnName: 'Phone',
  //           displayName: 'Phone',
  //           aggregate: false,
  //           joinColumns: [],
  //         },
  //       ],
  //     });
  //     reporter.emit('finished', [
  //       {
  //         Name: 'test',
  //         Phone: '111-111-1111',
  //       },
  //     ]);
  //     expect(output).to.equal('Name,Phone\ntest,111-111-1111\n');
  //   });
  //
  //   it('log multi record with single property', async function (): Promise<void> {
  //     await createReporter('SELECT Name FROM TestObject', {
  //       columnMetadata: [
  //         {
  //           columnName: 'Name',
  //           displayName: 'Name',
  //           aggregate: false,
  //           joinColumns: [],
  //         },
  //       ],
  //     });
  //     reporter.emit('finished', [
  //       {
  //         Name: 'test1',
  //       },
  //       {
  //         Name: 'test2',
  //       },
  //     ]);
  //     expect(output).to.equal('Name\ntest1\ntest2\n');
  //   });
  //
  //   it('log multi record with multi property', async function (): Promise<void> {
  //     await createReporter('SELECT Name, Phone FROM TestObject', {
  //       columnMetadata: [
  //         {
  //           columnName: 'Name',
  //           displayName: 'Name',
  //           aggregate: false,
  //           joinColumns: [],
  //         },
  //         {
  //           columnName: 'Phone',
  //           displayName: 'Phone',
  //           aggregate: false,
  //           joinColumns: [],
  //         },
  //       ],
  //     });
  //     reporter.emit('finished', [
  //       {
  //         Name: 'test1',
  //         Phone: '111-111-1111',
  //       },
  //       {
  //         Name: 'test2',
  //         Phone: '222-222-2222',
  //       },
  //     ]);
  //     expect(output).to.equal('Name,Phone\ntest1,111-111-1111\ntest2,222-222-2222\n');
  //   });
  //
  //   it('log single record with child property', async function (): Promise<void> {
  //     await createReporter('SELECT Name, (SELECT Name FROM Contact) FROM TestObject', {
  //       columnMetadata: [
  //         {
  //           columnName: 'Name',
  //           displayName: 'Name',
  //           aggregate: false,
  //           joinColumns: [],
  //         },
  //         {
  //           columnName: 'Contact',
  //           displayName: 'Contact',
  //           aggregate: true,
  //           joinColumns: [
  //             {
  //               columnName: 'Name',
  //               displayName: 'Name',
  //               aggregate: false,
  //               joinColumns: [],
  //             },
  //           ],
  //         },
  //       ],
  //     });
  //     reporter.emit('finished', [
  //       {
  //         Name: 'test1',
  //         Contact: {
  //           totalSize: 1,
  //           records: [
  //             {
  //               Name: 'child1',
  //             },
  //           ],
  //         },
  //       },
  //     ]);
  //     expect(output).to.equal('Name,Contact.totalSize,Contact.records.0.Name\ntest1,1,child1\n');
  //   });
  //
  //   // Invalid. Quotes in the field names are not allowed
  //   // it('log header with delimiter', async function (): Promise<void> {
  //   //     createReporter('SELECT "Name,ed" FROM TestObject');
  //   //     reporter.emit('finished', [{
  //   //         'Name,ed': 'test'
  //   //     }]);
  //   //     expect(output).to.equal('"Name,ed"\ntest\n');
  //   // });
  //
  //   it('log value with delimiter', async function (): Promise<void> {
  //     await createReporter('SELECT Name FROM TestObject', {
  //       columnMetadata: [
  //         {
  //           columnName: 'Name',
  //           displayName: 'Name',
  //           aggregate: false,
  //           joinColumns: [],
  //         },
  //       ],
  //     });
  //     reporter.emit('finished', [
  //       {
  //         Name: 'test,ed',
  //       },
  //     ]);
  //     expect(output).to.equal('Name\n"test,ed"\n');
  //   });
  //
  //   it('log value with EOL', async function (): Promise<void> {
  //     const eol = require('os').EOL;
  //     const data: any = {};
  //     await createReporter('SELECT Name FROM TestObject', {
  //       columnMetadata: [
  //         {
  //           columnName: 'Name',
  //           displayName: 'Name',
  //           aggregate: false,
  //           joinColumns: [],
  //         },
  //       ],
  //     });
  //
  //     // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  //     data['Name'] = `testing a ${eol}`;
  //
  //     reporter.emit('finished', [data]);
  //     // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  //     expect(output).to.equal(`Name\n"testing a ${eol}"\n`);
  //   });
  //
  //   it('log aggregate value', async function (): Promise<void> {
  //     await createReporter('SELECT avg(Total) FROM TestObject', {
  //       columnMetadata: [
  //         {
  //           columnName: 'expr0',
  //           displayName: 'avg(Total)',
  //           aggregate: true,
  //           joinColumns: [],
  //         },
  //       ],
  //     });
  //     reporter.emit('finished', [
  //       {
  //         expr0: 1000,
  //       },
  //     ]);
  //     expect(output).to.equal('avg(Total)\n1000\n');
  //   });
  //
  //   it('log aggregate value with alias', async function (): Promise<void> {
  //     await createReporter('SELECT avg(Total) myalias FROM TestObject', {
  //       columnMetadata: [
  //         {
  //           columnName: 'myalias',
  //           displayName: 'avg(Total)',
  //           aggregate: true,
  //           joinColumns: [],
  //         },
  //       ],
  //     });
  //     reporter.emit('finished', [
  //       {
  //         myalias: 1000,
  //       },
  //     ]);
  //     expect(output).to.equal('myalias\n1000\n');
  //   });
  // });
  //
  // describe('Human', function (): void {
  //   let reporter: any;
  //   let headers: any;
  //   let data: any;
  //   let totalCount: any;
  //
  //   const createReporter = async (query: string, columnData: any) => {
  //     const conn = TestUtil.createBaseFakeConnection();
  //     sandbox.stub(conn, 'request').returns(Promise.resolve(columnData));
  //     reporter = new HumanReporter(conn, query);
  //     sandbox.stub(reporter, 'getBaseUrl').returns('');
  //     sandbox.stub(reporter, 'display').callsFake((_headers: any, _data: any, _totalCount: number) => {
  //       headers = _headers;
  //       data = _data;
  //       totalCount = _totalCount;
  //     });
  //     await reporter.retrieveColumns();
  //   };
  //
  //   it('log single record with single property', async function (): Promise<void> {
  //     await createReporter('SELECT Name FROM TestObject', {
  //       columnMetadata: [
  //         {
  //           columnName: 'Name',
  //           displayName: 'Name',
  //           aggregate: false,
  //           joinColumns: [],
  //         },
  //       ],
  //     });
  //     reporter.emit('finished', [
  //       {
  //         Name: 'test',
  //       },
  //     ]);
  //     expect(headers).to.deep.equal(['Name']);
  //     expect(data).to.deep.equal([{ Name: 'test' }]);
  //     expect(totalCount).to.deep.equal(1);
  //   });
  //
  //   it('log single record with single property lowercase name', async function (): Promise<void> {
  //     await createReporter('SELECT name FROM TestObject', {
  //       columnMetadata: [
  //         {
  //           columnName: 'Name',
  //           displayName: 'Name',
  //           aggregate: false,
  //           joinColumns: [],
  //         },
  //       ],
  //     });
  //     reporter.emit('finished', [
  //       {
  //         Name: 'test',
  //       },
  //     ]);
  //     expect(headers).to.deep.equal(['Name']);
  //     expect(data).to.deep.equal([{ Name: 'test' }]);
  //     expect(totalCount).to.deep.equal(1);
  //   });
  //
  //   it('log single record with child property', async function (): Promise<void> {
  //     await createReporter('SELECT Name, Account.Name FROM Contact', {
  //       columnMetadata: [
  //         {
  //           columnName: 'Name',
  //           displayName: 'Name',
  //           aggregate: false,
  //           joinColumns: [],
  //         },
  //         {
  //           columnName: 'Account',
  //           displayName: 'Account',
  //           aggregate: true,
  //           joinColumns: [
  //             {
  //               columnName: 'Name',
  //               displayName: 'Name',
  //               aggregate: false,
  //               joinColumns: [],
  //             },
  //           ],
  //         },
  //       ],
  //     });
  //     reporter.emit('finished', [
  //       {
  //         Name: 'test1',
  //         Account: {
  //           totalSize: 1,
  //           records: [
  //             {
  //               Name: 'child1',
  //             },
  //           ],
  //         },
  //       },
  //     ]);
  //     expect(headers).to.deep.equal(['Name', 'Account.Name']);
  //     expect(data[0]).to.deep.equal({ Name: 'test1' });
  //     expect(data[1]).to.deep.equal({ 'Account.Name': 'child1' });
  //     expect(totalCount).to.deep.equal(1);
  //   });
  //
  //   it('log single record with child property subquery', async function (): Promise<void> {
  //     await createReporter('SELECT Name, (SELECT Name FROM Contact) FROM TestObject', {
  //       columnMetadata: [
  //         {
  //           columnName: 'Name',
  //           displayName: 'Name',
  //           aggregate: false,
  //           joinColumns: [],
  //         },
  //         {
  //           columnName: 'Contact',
  //           displayName: 'Contact',
  //           aggregate: true,
  //           joinColumns: [
  //             {
  //               columnName: 'Name',
  //               displayName: 'Name',
  //               aggregate: false,
  //               joinColumns: [],
  //             },
  //           ],
  //         },
  //       ],
  //     });
  //     reporter.emit('finished', [
  //       {
  //         Name: 'test1',
  //         Contact: {
  //           totalSize: 1,
  //           records: [
  //             {
  //               Name: 'child1',
  //             },
  //           ],
  //         },
  //       },
  //     ]);
  //     expect(headers).to.deep.equal(['Name', 'Contact.Name']);
  //     expect(data[0]).to.deep.equal({ Name: 'test1' });
  //     expect(data[1]).to.deep.equal({ 'Contact.Name': 'child1' });
  //     expect(totalCount).to.deep.equal(1);
  //   });
  //
  //   it('log aggregate value', async function (): Promise<void> {
  //     await createReporter('SELECT avg(Total) FROM TestObject', {
  //       columnMetadata: [
  //         {
  //           columnName: 'expr0',
  //           displayName: 'avg(Total)',
  //           aggregate: true,
  //           joinColumns: [],
  //         },
  //       ],
  //     });
  //     reporter.emit('finished', [
  //       {
  //         expr0: 1000,
  //       },
  //     ]);
  //     expect(headers).to.deep.equal(['avg(Total)']);
  //     expect(data[0]).to.have.property('avg(Total)').and.equal(1000);
  //     expect(totalCount).to.deep.equal(1);
  //   });
  //
  //   it('log aggregate value with alias', async function (): Promise<void> {
  //     await createReporter('SELECT avg(Total) myalias FROM TestObject', {
  //       columnMetadata: [
  //         {
  //           columnName: 'myalias',
  //           displayName: 'avg(Total)',
  //           aggregate: true,
  //           joinColumns: [],
  //         },
  //       ],
  //     });
  //     reporter.emit('finished', [
  //       {
  //         myalias: 1000,
  //       },
  //     ]);
  //     expect(headers).to.deep.equal(['myalias']);
  //     expect(data[0]).to.have.property('myalias').and.equal(1000);
  //     expect(totalCount).to.deep.equal(1);
  //   });
  // });
});

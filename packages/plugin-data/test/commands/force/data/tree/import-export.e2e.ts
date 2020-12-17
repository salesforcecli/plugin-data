import fs = require('fs-extra');
import { exec, exec2JSON } from '@mshanemc/plugin-helpers';
import testutils = require('@mshanemc/plugin-helpers/dist/testutilsChai');
import { expect } from '@salesforce/command/lib/test';

const testProjectName = 'testProjectTreeImportExport';
const testFilesPath = '../test/api/data/tree/test-files';
const recordsInPlanTestFiles = 8;

describe('import/export tests', () => {
  before(async () => {
    await fs.remove(testProjectName);
    await exec(`sfdx force:project:create -n ${testProjectName}`);
    await testutils.orgCreate(testProjectName);
  });

  it('provides config help', async () => {
    const helpResult = await exec2JSON(
      `sfdx force:data:tree:import -p ${testFilesPath}/accounts-contacts-plan.json --json --confighelp`,
      { cwd: testProjectName }
    );
    expect(helpResult.status).to.equal(0);
  });

  describe('import/export roundtrip', () => {
    const prefix = 'sfdx_';

    // do one import first to seed the data for the export queries
    it('should import using plan file', async () => {
      const planResult = await exec2JSON(
        `sfdx force:data:tree:import -p ${testFilesPath}/accounts-contacts-plan.json --json`,
        {
          cwd: testProjectName,
        }
      );
      expect(planResult.status).to.equal(0);
      expect(planResult.result.length).to.equal(recordsInPlanTestFiles);
    });

    it('should export using tree file', async () => {
      const exportFolder = 'data-tree';
      const exportResult = await exec2JSON(
        `sfdx force:data:tree:export -q "select name, phone, website, numberOfEmployees, industry, (select lastname, title from Contacts) from Account" --outputdir ${exportFolder} --json`,
        {
          cwd: testProjectName,
        }
      );
      expect(exportResult.status).to.equal(0);
      expect(exportResult.result.records.length).to.equal(2);
      expect(fs.existsSync(`${testProjectName}/${exportFolder}/Account-Contact.json`));
    });

    it('should add prefixes to a tree file', async () => {
      const exportFolder = 'data-tree-prefix';
      const exportResult = await exec2JSON(
        `sfdx force:data:tree:export -q "select name, phone, website, numberOfEmployees, industry, (select lastname, title from Contacts) from Account" --outputdir ${exportFolder} --json --prefix ${prefix}`,
        {
          cwd: testProjectName,
        }
      );
      expect(exportResult.status).to.equal(0);
      expect(exportResult.result.records.length).to.equal(2);
      expect(fs.existsSync(`${testProjectName}/${exportFolder}/${prefix}Account-Contact.json`));
    });

    it('should export plan files', async () => {
      const exportFolder = 'data-plan';
      const exportResult = await exec2JSON(
        `sfdx force:data:tree:export -q "select name, phone, website, numberOfEmployees, industry, (select lastname, title from Contacts) from Account" --outputdir ${exportFolder} --json --plan`,
        {
          cwd: testProjectName,
        }
      );
      expect(exportResult.status).to.equal(0);
      expect(exportResult.result.length).to.equal(2);
      expect(fs.existsSync(`${testProjectName}/${exportFolder}/Account-Contact-plan.json`));
      expect(fs.existsSync(`${testProjectName}/${exportFolder}/${exportResult.result[0].files[0]}`));
      expect(fs.existsSync(`${testProjectName}/${exportFolder}/${exportResult.result[1].files[0]}`));
    });

    it('should add a prefix to exported file plans ', async () => {
      const exportFolder = 'data-plan-prefix';
      const exportResult = await exec2JSON(
        `sfdx force:data:tree:export -q "select name, phone, website, numberOfEmployees, industry, (select lastname, title from Contacts) from Account" --outputdir ${exportFolder} --json --plan --prefix ${prefix}`,
        {
          cwd: testProjectName,
        }
      );
      expect(exportResult.status).to.equal(0);
      expect(exportResult.result.length).to.equal(2);
      expect(fs.existsSync(`${testProjectName}/${exportFolder}/${prefix}Account-Contact-plan.json`));
      expect(fs.existsSync(`${testProjectName}/${exportFolder}/${prefix}${exportResult.result[0].files[0]}`));
      expect(fs.existsSync(`${testProjectName}/${exportFolder}/${prefix}${exportResult.result[1].files[0]}`));
    });

    it('should import a single tree file', async () => {
      const treeResultSingle = await exec2JSON(
        `sfdx force:data:tree:import -f ${testFilesPath}/accounts-only.json --json`,
        {
          cwd: testProjectName,
        }
      );
      expect(treeResultSingle.status).to.equal(0);
    });

    it('should import multiple tree files in an comma-separated array', async () => {
      const treeResultMulti = await exec2JSON(
        `sfdx force:data:tree:import -f ${testFilesPath}/contacts-only-2.json,${testFilesPath}/contacts-only-3.json --json`,
        {
          cwd: testProjectName,
        }
      );
      expect(treeResultMulti.status).to.equal(0);
    });
  });

  after(async () => {
    await testutils.orgDelete(testProjectName);
    await fs.remove(testProjectName);
  });
});

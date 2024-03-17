[![NPM](https://img.shields.io/npm/v/@salesforce/plugin-data.svg?label=@salesforce/plugin-data)](https://www.npmjs.com/package/@salesforce/plugin-data) [![Downloads/week](https://img.shields.io/npm/dw/@salesforce/plugin-data.svg)](https://npmjs.org/package/@salesforce/plugin-data) [![License](https://img.shields.io/badge/License-BSD%203--Clause-brightgreen.svg)](https://raw.githubusercontent.com/salesforcecli/plugin-data/main/LICENSE.txt)

# plugin-data

`data` commands for Salesforce CLI.

This plugin is bundled with the [Salesforce CLI](https://developer.salesforce.com/tools/sfdxcli). For more information
on the CLI, read
the [getting started guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_intro.htm)
.

We always recommend using the latest version of these commands bundled with the CLI, however, you can install a specific
version or tag if needed.

## Install

```bash
sf plugins:install data@x.y.z
```

## Issues

Please report any issues at https://github.com/forcedotcom/cli/issues

## Contributing

1. Please read our [Code of Conduct](CODE_OF_CONDUCT.md)
2. Create a new issue before starting your project so that we can keep track of what you are trying to add/fix. That
   way, we can also offer suggestions or let you know if there is already an effort in progress.
3. Fork this repository.
4. [Build the plugin locally](#build)
5. Create a _topic_ branch in your fork. Note, this step is recommended but technically not required if contributing
   using a fork.
6. Edit the code in your fork.
7. Write appropriate tests for your changes. Try to achieve at least 95% code coverage on any new code. No pull request
   will be accepted without unit tests.
8. Sign CLA (see [CLA](#cla) below).
9. Send us a pull request when you are done. We'll review your code, suggest any needed changes, and merge it in.

### CLA

External contributors will be required to sign a Contributor's License Agreement. You can do so by going
to https://cla.salesforce.com/sign-cla.

### Build

To build the plugin locally, make sure to have yarn installed and run the following commands:

```bash
# Clone the repository
git clone git@github.com:salesforcecli/plugin-data

# Install the dependencies and compile
yarn install
yarn build
```

To use your plugin, run using the local `./bin/dev` or `./bin/dev.cmd` file.

```bash
# Run using local run file.
./bin/dev force:data
```

There should be no differences when running via the Salesforce CLI or using the local run file. However, it can be
useful to link the plugin to do some additional testing or run your commands from anywhere on your machine.

```bash
# Link your plugin to the sf cli
sf plugins:link .
# To verify
sf plugins
```

# Commands

<!-- commands -->

- [`sf data create record`](#sf-data-create-record)
- [`sf data delete bulk`](#sf-data-delete-bulk)
- [`sf data delete record`](#sf-data-delete-record)
- [`sf data delete resume`](#sf-data-delete-resume)
- [`sf data export beta tree`](#sf-data-export-beta-tree)
- [`sf data export tree`](#sf-data-export-tree)
- [`sf data get record`](#sf-data-get-record)
- [`sf data import beta tree`](#sf-data-import-beta-tree)
- [`sf data import tree`](#sf-data-import-tree)
- [`sf data query`](#sf-data-query)
- [`sf data query resume`](#sf-data-query-resume)
- [`sf data resume`](#sf-data-resume)
- [`sf data update record`](#sf-data-update-record)
- [`sf data upsert bulk`](#sf-data-upsert-bulk)
- [`sf data upsert resume`](#sf-data-upsert-resume)
- [`sf force data bulk delete`](#sf-force-data-bulk-delete)
- [`sf force data bulk status`](#sf-force-data-bulk-status)
- [`sf force data bulk upsert`](#sf-force-data-bulk-upsert)

## `sf data create record`

Create and insert a record into a Salesforce or Tooling API object.

```
USAGE
  $ sf data create record -o <value> -s <value> -v <value> [--json] [--api-version <value>] [-t]

FLAGS
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -s, --sobject=<value>      (required) API name of the Salesforce or Tooling API object that you're inserting a record
                             into.
  -t, --use-tooling-api      Use Tooling API so you can insert a record in a Tooling API object.
  -v, --values=<value>       (required) Values for the flags in the form <fieldName>=<value>, separate multiple pairs
                             with spaces.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Create and insert a record into a Salesforce or Tooling API object.

  You must specify a value for all required fields of the object.

  When specifying fields, use the format <fieldName>=<value>. Enclose all field-value pairs in one set of double
  quotation marks, delimited by spaces. Enclose values that contain spaces in single quotes.

  This command inserts a record into Salesforce objects by default. Use the --use-tooling-api flag to insert into a
  Tooling API object.

ALIASES
  $ sf force data record create

EXAMPLES
  Insert a record into the Account object of your default org; only the required Name field has a value:

    $ sf data create record --sobject Account --values "Name=Acme"

  Insert an Account record with values for two fields, one value contains a space; the command uses the org with alias
  "my-scratch":

    $ sf data create record --sobject Account --values "Name='Universal Containers' Website=www.example.com" \
      --target-org my-scratch

  Insert a record into the Tooling API object TraceFlag:

    $ sf data create record --use-tooling-api --sobject TraceFlag --values "DebugLevelId=7dl170000008U36AAE \
      StartDate=2022-12-15T00:26:04.000+0000 ExpirationDate=2022-12-15T00:56:04.000+0000 LogType=CLASS_TRACING \
      TracedEntityId=01p17000000R6bLAAS"
```

_See code: [src/commands/data/create/record.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/data/create/record.ts)_

## `sf data delete bulk`

Bulk delete records from an org using a CSV file. Uses Bulk API 2.0.

```
USAGE
  $ sf data delete bulk -o <value> -f <value> -s <value> [--json] [--api-version <value>] [-w <value> | -a] [--verbose]

FLAGS
  -a, --async                Run the command asynchronously.
  -f, --file=<value>         (required) CSV file that contains the IDs of the records to update or delete.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -s, --sobject=<value>      (required) API name of the Salesforce object, either standard or custom, that you want to
                             update or delete records from.
  -w, --wait=<value>         [default: 0 minutes] Number of minutes to wait for the command to complete before
                             displaying the results.
      --api-version=<value>  Override the api version used for api requests made by this command
      --verbose              Print verbose output of failed records if result is available.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Bulk delete records from an org using a CSV file. Uses Bulk API 2.0.

  The CSV file must have only one column ("Id") and then the list of record IDs you want to delete, one ID per line.

  When you execute this command, it starts a job, displays the ID, and then immediately returns control of the terminal
  to you by default. If you prefer to wait, set the --wait flag to the number of minutes; if it times out, the command
  outputs the IDs. Use the job ID to check the status of the job with the "sf data delete resume" command.

EXAMPLES
  Bulk delete Account records from your default org using the list of IDs in the "files/delete.csv" file:

    $ sf data delete bulk --sobject Account --file files/delete.csv

  Bulk delete records from a custom object in an org with alias my-scratch and wait 5 minutes for the command to
  complete:

    $ sf data delete bulk --sobject MyObject__c --file files/delete.csv --wait 5 --target-org my-scratch
```

_See code: [src/commands/data/delete/bulk.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/data/delete/bulk.ts)_

## `sf data delete record`

Deletes a single record from a Salesforce or Tooling API object.

```
USAGE
  $ sf data delete record -o <value> -s <value> [--json] [--api-version <value>] [-i <value>] [-w <value>] [-t]

FLAGS
  -i, --record-id=<value>    ID of the record you’re deleting.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -s, --sobject=<value>      (required) API name of the Salesforce or Tooling API object that you're deleting a record
                             from.
  -t, --use-tooling-api      Use Tooling API so you can delete a record from a Tooling API object.
  -w, --where=<value>        List of <fieldName>=<value> pairs that identify the record you want to delete.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Deletes a single record from a Salesforce or Tooling API object.

  Specify the record you want to delete with either its ID or with a list of field-value pairs that identify the record.
  If your list of fields identifies more than one record, the delete fails; the error displays how many records were
  found.

  When specifying field-value pairs, use the format <fieldName>=<value>. Enclose all field-value pairs in one set of
  double quotation marks, delimited by spaces. Enclose values that contain spaces in single quotes.

  This command deletes a record from Salesforce objects by default. Use the --use-tooling-api flag to delete from a
  Tooling API object.

ALIASES
  $ sf force data record delete

EXAMPLES
  Delete a record from Account with the specified (truncated) ID:

    $ sf data delete record --sobject Account --record-id 00180XX

  Delete a record from Account whose name equals "Acme":

    $ sf data delete record --sobject Account --where "Name=Acme"

  Delete a record from Account identified with two field values, one that contains a space; the command uses the org
  with alias "my-scratch":

    $ sf data delete record --sobject Account --where "Name='Universal Containers' Phone='(123) 456-7890'" \
      --target-org myscratch

  Delete a record from the Tooling API object TraceFlag with the specified (truncated) ID:

    $ sf data delete record --use-tooling-api --sobject TraceFlag --record-id 7tf8c
```

_See code: [src/commands/data/delete/record.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/data/delete/record.ts)_

## `sf data delete resume`

Resume a bulk delete job that you previously started. Uses Bulk API 2.0.

```
USAGE
  $ sf data delete resume [--json] [-o <value>] [--use-most-recent | -i <value>] [--wait <value>] [--api-version
  <value>]

FLAGS
  -i, --job-id=<value>       ID of the job you want to resume.
  -o, --target-org=<value>   Org alias or username to use for the target org.
      --api-version=<value>  Override the api version used for api requests made by this command
      --use-most-recent      Use the ID of the most recently-run bulk job.
      --wait=<value>         [default: 0 minutes] Number of minutes to wait for the command to complete before
                             displaying the results.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Resume a bulk delete job that you previously started. Uses Bulk API 2.0.

  The command uses the job ID returned by the "sf data delete bulk" command or the most recently-run bulk delete job.

EXAMPLES
  Resume a bulk delete job from your default org using an ID:

    $ sf data delete resume --job-id 750xx000000005sAAA

  Resume the most recently run bulk delete job for an org with alias my-scratch:

    $ sf data delete resume --use-most-recent --target-org my-scratch
```

_See code: [src/commands/data/delete/resume.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/data/delete/resume.ts)_

## `sf data export beta tree`

Export data from an org into one or more JSON files.

```
USAGE
  $ sf data export beta tree -o <value> -q <value> [--json] [--api-version <value>] [-p] [-x <value>] [-d <value>]

FLAGS
  -d, --output-dir=<value>   Directory in which to generate the JSON files; default is current directory.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -p, --plan                 Generate multiple sObject tree files and a plan definition file for aggregated import.
  -q, --query=<value>        (required) SOQL query, or filepath of a file that contains the query, to retrieve records.
  -x, --prefix=<value>       Prefix of generated files.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Export data from an org into one or more JSON files.

  Specify a SOQL query, either directly at the command line or read from a file, to retrieve the data you want to
  export. The exported data is written to JSON files in sObject tree format, which is a collection of nested,
  parent-child records with a single root record. Use these JSON files to import data into an org with the "sf data
  import tree" command.

  If your SOQL query references multiple objects, the command generates a single JSON file by default. You can specify
  the --plan flag to generate separate JSON files for each object and a plan definition file that aggregates them. You
  then specify just this plan definition file when you import the data into an org.

  The SOQL query can return a maximum of 2,000 records. For more information, see the REST API Developer Guide.
  (https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobject_tree.htm).

EXAMPLES
  Export records retrieved with the specified SOQL query into a single JSON file in the current directory; the command
  uses your default org:

    $ sf data export beta tree --query "SELECT Id, Name, (SELECT Name, Address__c FROM Properties__r) FROM \
      Broker__c"

  Export data using a SOQL query in the "query.txt" file and generate JSON files for each object and a plan that
  aggregates them:

    $ sf data export beta tree --query query.txt --plan

  Prepend "export-demo" before each generated file and generate the files in the "export-out" directory; run the
  command on the org with alias "my-scratch":

    $ sf data export beta tree --query query.txt --plan --prefix export-demo --output-dir export-out --target-org \
      my-scratch
```

_See code: [src/commands/data/export/beta/tree.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/data/export/beta/tree.ts)_

## `sf data export tree`

Export data from an org into one or more JSON files.

```
USAGE
  $ sf data export tree -o <value> -q <value> [--json] [--api-version <value>] [-p] [-x <value>] [-d <value>]

FLAGS
  -d, --output-dir=<value>   Directory in which to generate the JSON files; default is current directory.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -p, --plan                 Generate multiple sObject tree files and a plan definition file for aggregated import.
  -q, --query=<value>        (required) SOQL query, or filepath of a file that contains the query, to retrieve records.
  -x, --prefix=<value>       Prefix of generated files.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Export data from an org into one or more JSON files.

  Specify a SOQL query, either directly at the command line or read from a file, to retrieve the data you want to
  export. The exported data is written to JSON files in sObject tree format, which is a collection of nested,
  parent-child records with a single root record. Use these JSON files to import data into an org with the "sf data
  import tree" command.

  If your SOQL query references multiple objects, the command generates a single JSON file by default. You can specify
  the --plan flag to generate separate JSON files for each object and a plan definition file that aggregates them. You
  then specify just this plan definition file when you import the data into an org.

  The SOQL query can return a maximum of 2,000 records. For more information, see the REST API Developer Guide.
  (https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobject_tree.htm).

ALIASES
  $ sf force data tree export

EXAMPLES
  Export records retrieved with the specified SOQL query into a single JSON file in the current directory; the command
  uses your default org:

    $ sf data export tree --query "SELECT Id, Name, (SELECT Name, Address__c FROM Properties__r) FROM Broker__c"

  Export data using a SOQL query in the "query.txt" file and generate JSON files for each object and a plan that
  aggregates them:

    $ sf data export tree --query query.txt --plan

  Prepend "export-demo" before each generated file and generate the files in the "export-out" directory; run the
  command on the org with alias "my-scratch":

    $ sf data export tree --query query.txt --plan --prefix export-demo --output-dir export-out --target-org \
      my-scratch
```

_See code: [src/commands/data/export/tree.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/data/export/tree.ts)_

## `sf data get record`

Retrieve and display a single record of a Salesforce or Tooling API object.

```
USAGE
  $ sf data get record -o <value> -s <value> [--json] [--api-version <value>] [-i <value>] [-w <value>] [-t]

FLAGS
  -i, --record-id=<value>    ID of the record you’re retrieving.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -s, --sobject=<value>      (required) API name of the Salesforce or Tooling API object that you're retrieving a record
                             from.
  -t, --use-tooling-api      Use Tooling API so you can retrieve a record from a Tooling API object.
  -w, --where=<value>        List of <fieldName>=<value> pairs that identify the record you want to display.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Retrieve and display a single record of a Salesforce or Tooling API object.

  Specify the record you want to retrieve with either its ID or with a list of field-value pairs that identify the
  record. If your list of fields identifies more than one record, the command fails; the error displays how many records
  were found.

  When specifying field-value pairs, use the format <fieldName>=<value>. Enclose all field-value pairs in one set of
  double quotation marks, delimited by spaces. Enclose values that contain spaces in single quotes.

  The command displays all the record's fields and their values, one field per terminal line. Fields with no values are
  displayed as "null".

  This command retrieves a record from Salesforce objects by default. Use the --use-tooling-api flag to retrieve from a
  Tooling API object.

ALIASES
  $ sf force data record get

EXAMPLES
  Retrieve and display a record from Account with the specified (truncated) ID:

    $ sf data get record --sobject Account --record-id 00180XX

  Retrieve a record from Account whose name equals "Acme":

    $ sf data get record --sobject Account --where "Name=Acme"

  Retrieve a record from Account identified with two field values, one that contains a space; the command uses the org
  with alias "my-scratch":

    $ sf data get record --sobject Account --where "Name='Universal Containers' Phone='(123) 456-7890'" --target-org \
      myscratch

  Retrieve a record from the Tooling API object TraceFlag with the specified (truncated) ID:

    $ sf data get record --use-tooling-api --sobject TraceFlag --record-id 7tf8c
```

_See code: [src/commands/data/get/record.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/data/get/record.ts)_

## `sf data import beta tree`

Import data from one or more JSON files into an org.

```
USAGE
  $ sf data import beta tree -o <value> [--json] [--api-version <value>] [-f <value>] [-p <value>]

FLAGS
  -f, --files=<value>...     Comma-separated and in-order JSON files that contain the records, in sObject tree format,
                             that you want to insert.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -p, --plan=<value>         Plan definition file to insert multiple data files.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Import data from one or more JSON files into an org.

  The JSON files that contain the data are in sObject tree format, which is a collection of nested, parent-child records
  with a single root record. Use the "sf data export tree" command to generate these JSON files.

  If you used the --plan flag when exporting the data to generate a plan definition file, use the --plan flag to
  reference the file when you import. If you're not using a plan, use the --files flag to list the files. If you specify
  multiple JSON files that depend on each other in a parent-child relationship, be sure you list them in the correct
  order.

EXAMPLES
  Import the records contained in two JSON files into the org with alias "my-scratch":

    $ sf data import beta tree --files Contact.json,Account.json --target-org my-scratch

  Import records using a plan definition file into your default org:

    $ sf data import beta tree --plan Account-Contact-plan.json
```

_See code: [src/commands/data/import/beta/tree.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/data/import/beta/tree.ts)_

## `sf data import tree`

Import data from one or more JSON files into an org.

```
USAGE
  $ sf data import tree -o <value> [--json] [--api-version <value>] [-f <value> | -p <value>]

FLAGS
  -f, --files=<value>...     Comma-separated and in-order JSON files that contain the records, in sObject tree format,
                             that you want to insert.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -p, --plan=<value>         Plan definition file to insert multiple data files.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Import data from one or more JSON files into an org.

  The JSON files that contain the data are in sObject tree format, which is a collection of nested, parent-child records
  with a single root record. Use the "sf data export tree" command to generate these JSON files.

  If you used the --plan flag when exporting the data to generate a plan definition file, use the --plan flag to
  reference the file when you import. If you're not using a plan, use the --files flag to list the files. If you specify
  multiple JSON files that depend on each other in a parent-child relationship, be sure you list them in the correct
  order.

  The sObject Tree API supports requests that contain up to 200 records. For more information, see the REST API
  Developer Guide.
  (https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobject_tree.htm)

ALIASES
  $ sf force data tree import

EXAMPLES
  Import the records contained in two JSON files into the org with alias "my-scratch":

    $ sf data import tree --files Contact.json,Account.json --target-org my-scratch

  Import records using a plan definition file into your default org:

    $ sf data import tree --plan Account-Contact-plan.json
```

_See code: [src/commands/data/import/tree.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/data/import/tree.ts)_

## `sf data query`

Execute a SOQL query.

```
USAGE
  $ sf data query -o <value> [--json] [--api-version <value>] [-q <value>] [-f <value>] [-w <value> [-b | -t]]
    [--async ] [--all-rows] [-r human|json|csv]

FLAGS
  -b, --bulk                    Use Bulk API 2.0 to run the query.
  -f, --file=<value>            File that contains the SOQL query.
  -o, --target-org=<value>      (required) Username or alias of the target org. Not required if the `target-org`
                                configuration variable is already set.
  -q, --query=<value>           SOQL query to execute.
  -r, --result-format=<option>  [default: human] Format to display the results; the --json flag overrides this flag.
                                <options: human|json|csv>
  -t, --use-tooling-api         Use Tooling API so you can run queries on Tooling API objects.
  -w, --wait=<value>            Time to wait for the command to finish, in minutes.
      --all-rows                Include deleted records. By default, deleted records are not returned.
      --api-version=<value>     Override the api version used for api requests made by this command
      --async                   Use Bulk API 2.0, but don't wait for the job to complete.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Execute a SOQL query.

  Specify the SOQL query at the command line with the --query flag or read the query from a file with the --file flag.

  If your query returns more than 10,000 records, specify the --bulk flag. The command then runs the query using Bulk
  API 2.0, which has higher limits than the default API used by the command.

  When using --bulk, the command waits 3 minutes by default for the query to complete. Use the --wait parameter to
  specify a different number of minutes to wait, or set --wait to 0 to immediately return control to the terminal. If
  you set --wait to 0, or you use the --async flag, or the command simply times out, the command displays an ID. Pass
  this ID to the the "data query resume" command using the --bulk-query-id flag to get the results; pass the ID to the
  "data resume" command to get the job status.

ALIASES
  $ sf force data soql query

EXAMPLES
  Specify a SOQL query at the command line; the command uses your default org:

    $ sf data query --query "SELECT Id, Name, Account.Name FROM Contact"

  Read the SOQL query from a file called "query.txt"; the command uses the org with alias "my-scratch":

    $ sf data query --file query.txt --target-org my-scratch

  Use Tooling API to run a query on the ApexTrigger Tooling API object:

    $ sf data query --query "SELECT Name FROM ApexTrigger" --use-tooling-api

  Use Bulk API 2.0 to run a query that returns many rows, and return control to the terminal immediately:

    $ sf data query --query "SELECT Id FROM Contact" --bulk --wait 0
```

_See code: [src/commands/data/query.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/data/query.ts)_

## `sf data query resume`

View the status of a bulk query.

```
USAGE
  $ sf data query resume [--json] [-o <value>] [--api-version <value>] [-r human|json|csv] [--use-most-recent | -i
    <value>]

FLAGS
  -i, --bulk-query-id=<value>   Job ID of the bulk query.
  -o, --target-org=<value>      Org alias or username to use for the target org.
  -r, --result-format=<option>  [default: human] Format to display the results; the --json flag overrides this flag.
                                <options: human|json|csv>
      --api-version=<value>     Override the api version used for api requests made by this command
      --use-most-recent         Use the most recent bulk query ID from cache.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  View the status of a bulk query.

  Run this command using the job ID returned from the "sf data query --bulk" command.

ALIASES
  $ sf force data soql bulk report

EXAMPLES
  View the status of a bulk query with the specified ID:

    $ sf data query resume --bulk-query-id 7500x000005BdFzXXX
```

_See code: [src/commands/data/query/resume.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/data/query/resume.ts)_

## `sf data resume`

View the status of a bulk data load job or batch.

```
USAGE
  $ sf data resume -o <value> -i <value> [--json] [--api-version <value>] [-b <value>]

FLAGS
  -b, --batch-id=<value>     ID of the batch whose status you want to view; you must also specify the job ID.
  -i, --job-id=<value>       (required) ID of the job whose status you want to view.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  View the status of a bulk data load job or batch.

  Run this command using the job ID or batch ID returned from the "sf data delete bulk" or "sf data upsert bulk"
  commands.

EXAMPLES
  View the status of a bulk load job:

    $ sf data resume --job-id 750xx000000005sAAA

  View the status of a bulk load job and a specific batches:

    $ sf data resume --job-id 750xx000000005sAAA --batch-id 751xx000000005nAAA
```

_See code: [src/commands/data/resume.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/data/resume.ts)_

## `sf data update record`

Updates a single record of a Salesforce or Tooling API object.

```
USAGE
  $ sf data update record -o <value> -s <value> -v <value> [--json] [--api-version <value>] [-i <value>] [-w <value>]
    [-t]

FLAGS
  -i, --record-id=<value>    ID of the record you’re updating.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -s, --sobject=<value>      (required) API name of the Salesforce or Tooling API object that contains the record you're
                             updating.
  -t, --use-tooling-api      Use Tooling API so you can update a record in a Tooling API object.
  -v, --values=<value>       (required) Fields that you're updating, in the format of <fieldName>=<value> pairs.
  -w, --where=<value>        List of <fieldName>=<value> pairs that identify the record you want to update.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Updates a single record of a Salesforce or Tooling API object.

  Specify the record you want to update with either its ID or with a list of field-value pairs that identify the record.
  If your list of fields identifies more than one record, the update fails; the error displays how many records were
  found.

  When using field-value pairs for both identifying the record and specifiyng the new field values, use the format
  <fieldName>=<value>. Enclose all field-value pairs in one set of double quotation marks, delimited by spaces. Enclose
  values that contain spaces in single quotes.

  This command updates a record in Salesforce objects by default. Use the --use-tooling-api flag to update a Tooling API
  object.

ALIASES
  $ sf force data record update

EXAMPLES
  Update the Name field of an Account record with the specified (truncated) ID:

    $ sf data update record --sobject Account --record-id 001D0 --values "Name=NewAcme"

  Update the Name field of an Account record whose current name is 'Old Acme':

    $ sf data update record --sobject Account --where "Name='Old Acme'" --values "Name='New Acme'"

  Update the Name and Website fields of an Account record with the specified (truncated) ID:

    $ sf data update record --sobject Account --record-id 001D0 --values "Name='Acme III' Website=www.example.com"

  Update the ExpirationDate field of a record of the Tooling API object TraceFlag using the specified (truncated) ID:

    $ sf data update record -t --sobject TraceFlag --record-id 7tf170000009cUBAAY --values \
      "ExpirationDate=2017-12-01T00:58:04.000+0000"
```

_See code: [src/commands/data/update/record.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/data/update/record.ts)_

## `sf data upsert bulk`

Bulk upsert records to an org from a CSV file. Uses Bulk API 2.0.

```
USAGE
  $ sf data upsert bulk -o <value> -f <value> -s <value> -i <value> [--json] [--api-version <value>] [-w <value> | -a]
    [--verbose]

FLAGS
  -a, --async                Run the command asynchronously.
  -f, --file=<value>         (required) CSV file that contains the IDs of the records to update or delete.
  -i, --external-id=<value>  (required) Name of the external ID field, or the Id field.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -s, --sobject=<value>      (required) API name of the Salesforce object, either standard or custom, that you want to
                             update or delete records from.
  -w, --wait=<value>         [default: 0 minutes] Number of minutes to wait for the command to complete before
                             displaying the results.
      --api-version=<value>  Override the api version used for api requests made by this command
      --verbose              Print verbose output of failed records if result is available.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Bulk upsert records to an org from a CSV file. Uses Bulk API 2.0.

  An upsert refers to inserting a record into a Salesforce object if the record doesn't already exist, or updating it if
  it does exist.

  When you execute this command, it starts a job, displays the ID, and then immediately returns control of the terminal
  to you by default. If you prefer to wait, set the --wait flag to the number of minutes; if it times out, the command
  outputs the IDs. Use the job and batch IDs to check the status of the job with the "sf data upsert resume" command.

  See "Prepare CSV Files" in the Bulk API Developer Guide for details on formatting your CSV file.
  (https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_prepare_csv.htm)

EXAMPLES
  Bulk upsert records to the Contact object in your default org:

    $ sf data upsert bulk --sobject Contact --file files/contacts.csv --external-id Id

  Bulk upsert records to a custom object in an org with alias my-scratch and wait 5 minutes for the command to
  complete:

    $ sf data upsert bulk --sobject MyObject__c --file files/file.csv --external-id MyField__c --wait 5 --target-org \
      my-scratch
```

_See code: [src/commands/data/upsert/bulk.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/data/upsert/bulk.ts)_

## `sf data upsert resume`

Resume a bulk upsert job that you previously started. Uses Bulk API 2.0.

```
USAGE
  $ sf data upsert resume [--json] [-o <value>] [--use-most-recent | -i <value>] [--wait <value>] [--api-version
  <value>]

FLAGS
  -i, --job-id=<value>       ID of the job you want to resume.
  -o, --target-org=<value>   Org alias or username to use for the target org.
      --api-version=<value>  Override the api version used for api requests made by this command
      --use-most-recent      Use the ID of the most recently-run bulk job.
      --wait=<value>         [default: 0 minutes] Number of minutes to wait for the command to complete before
                             displaying the results.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Resume a bulk upsert job that you previously started. Uses Bulk API 2.0.

  The command uses the job ID returned from the "sf data upsert bulk" command or the most recently-run bulk upsert job.

EXAMPLES
  Resume a bulk upsert job from your default org using an ID:

    $ sf data upsert resume --job-id 750xx000000005sAAA

  Resume the most recently run bulk upsert job for an org with alias my-scratch:

    $ sf data upsert resume --use-most-recent --target-org my-scratch
```

_See code: [src/commands/data/upsert/resume.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/data/upsert/resume.ts)_

## `sf force data bulk delete`

Bulk delete records from an org using a CSV file. Uses Bulk API 1.0.

```
USAGE
  $ sf force data bulk delete -o <value> -f <value> -s <value> [--json] [--api-version <value>] [-w <value>]

FLAGS
  -f, --file=<value>         (required) CSV file that contains the IDs of the records to delete.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -s, --sobject=<value>      (required) API name of the Salesforce object, either standard or custom, that you want to
                             delete records from.
  -w, --wait=<value>         [default: 0 minutes] Number of minutes to wait for the command to complete before
                             displaying the results.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Bulk delete records from an org using a CSV file. Uses Bulk API 1.0.

  The CSV file must have only one column ("Id") and then the list of record IDs you want to delete, one ID per line.

  When you execute this command, it starts a job and one or more batches, displays their IDs, and then immediately
  returns control of the terminal to you by default. If you prefer to wait, set the --wait flag to the number of
  minutes; if it times out, the command outputs the IDs. Use the job and batch IDs to check the status of the job with
  the "sf force data bulk status" command. A single job can contain many batches, depending on the length of the CSV
  file.

EXAMPLES
  Bulk delete Account records from your default org using the list of IDs in the "files/delete.csv" file:

    $ sf force data bulk delete --sobject Account --file files/delete.csv

  Bulk delete records from a custom object in an org with alias my-scratch and wait 5 minutes for the command to
  complete:

    $ sf force data bulk delete --sobject MyObject__c --file files/delete.csv --wait 5 --target-org my-scratch
```

_See code: [src/commands/force/data/bulk/delete.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/force/data/bulk/delete.ts)_

## `sf force data bulk status`

View the status of a bulk data load job or batch. Uses Bulk API 1.0.

```
USAGE
  $ sf force data bulk status -o <value> -i <value> [--json] [--api-version <value>] [-b <value>]

FLAGS
  -b, --batch-id=<value>     ID of the batch whose status you want to view; you must also specify the job ID.
  -i, --job-id=<value>       (required) ID of the job whose status you want to view.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  View the status of a bulk data load job or batch. Uses Bulk API 1.0.

  Run this command using the job ID or batch ID returned from the "sf force data bulk delete" or "sf force data bulk
  upsert" commands.

EXAMPLES
  View the status of a bulk load job in your default org:

    $ sf force data bulk status --job-id 750xx000000005sAAA

  View the status of a bulk load job and a specific batches in an org with alias my-scratch:

    $ sf force data bulk status --job-id 750xx000000005sAAA --batch-id 751xx000000005nAAA --target-org my-scratch
```

_See code: [src/commands/force/data/bulk/status.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/force/data/bulk/status.ts)_

## `sf force data bulk upsert`

Bulk upsert records to an org from a CSV file. Uses Bulk API 1.0.

```
USAGE
  $ sf force data bulk upsert -o <value> -i <value> -f <value> -s <value> [--json] [--api-version <value>] [-w <value>]
  [-r]

FLAGS
  -f, --file=<value>         (required) CSV file that contains the records to upsert.
  -i, --external-id=<value>  (required) Name of the external ID field, or the Id field.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -r, --serial               Run batches in serial mode.
  -s, --sobject=<value>      (required) API name of the Salesforce object, either standard or custom, that you want to
                             upsert records to.
  -w, --wait=<value>         [default: 0 minutes] Number of minutes to wait for the command to complete before
                             displaying the results.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Bulk upsert records to an org from a CSV file. Uses Bulk API 1.0.

  An upsert refers to inserting a record into a Salesforce object if the record doesn't already exist, or updating it if
  it does exist.

  When you execute this command, it starts a job and one or more batches, displays their IDs, and then immediately
  returns control of the terminal to you by default. If you prefer to wait, set the --wait flag to the number of
  minutes; if it times out, the command outputs the IDs. Use the job and batch IDs to check the status of the job with
  the "sf force data bulk status" command. A single job can contain many batches, depending on the length of the CSV
  file.

  See "Prepare CSV Files" in the Bulk API Developer Guide for details on formatting your CSV file.
  (https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm)

  By default, the job runs the batches in parallel, which we recommend. You can run jobs serially by specifying the
  --serial flag. But don't process data in serial mode unless you know this would otherwise result in lock timeouts and
  you can't reorganize your batches to avoid the locks.

EXAMPLES
  Bulk upsert records to the Contact object in your default org:

    $ sf --sobject Contact --file files/contacts.csv --external-id Id

  Bulk upsert records to a custom object in an org with alias my-scratch and wait 5 minutes for the command to
  complete:

    $ sf force data bulk upsert --sobject MyObject__c --file files/file.csv --external-id MyField__c --wait 5 \
      --target-org my-scratch
```

_See code: [src/commands/force/data/bulk/upsert.ts](https://github.com/salesforcecli/plugin-data/blob/3.1.10/src/commands/force/data/bulk/upsert.ts)_

<!-- commandsstop -->

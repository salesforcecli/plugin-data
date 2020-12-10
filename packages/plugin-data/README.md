# plugin-data

`data` commands for Salesforce CLI.

This plugin is bundled with the [Salesforce CLI](https://developer.salesforce.com/tools/sfdxcli). For more information on the CLI, read the [getting started guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_intro.htm).

We always recommend using the latest version of these commands bundled with the CLI, however, you can install a specific version or tag if needed.

## Install

```bash
sfdx plugins:install data@x.y.z
```

## Issues

Please report any issues at https://github.com/forcedotcom/cli/issues

## Contributing

1. Please read our [Code of Conduct](CODE_OF_CONDUCT.md)
2. Create a new issue before starting your project so that we can keep track of
   what you are trying to add/fix. That way, we can also offer suggestions or
   let you know if there is already an effort in progress.
3. Fork this repository.
4. [Build the plugin locally](#build)
5. Create a _topic_ branch in your fork. Note, this step is recommended but technically not required if contributing using a fork.
6. Edit the code in your fork.
7. Write appropriate tests for your changes. Try to achieve at least 95% code coverage on any new code. No pull request will be accepted without unit tests.
8. Sign CLA (see [CLA](#cla) below).
9. Send us a pull request when you are done. We'll review your code, suggest any needed changes, and merge it in.

### CLA

External contributors will be required to sign a Contributor's License
Agreement. You can do so by going to https://cla.salesforce.com/sign-cla.

### Build

To build the plugin locally, make sure to have yarn installed and run the following commands:

```bash
# Clone the repository
git clone git@github.com:salesforcecli/plugin-data

# Install the dependencies and compile
yarn install
yarn build
```

To use your plugin, run using the local `./bin/run` or `./bin/run.cmd` file.

```bash
# Run using local run file.
./bin/run force:data
```

There should be no differences when running via the Salesforce CLI or using the local run file. However, it can be useful to link the plugin to do some additional testing or run your commands from anywhere on your machine.

```bash
# Link your plugin to the sfdx cli
sfdx plugins:link .
# To verify
sfdx plugins
```

# Commands

<!-- commands -->

- [`sfdx force:data:record:create -s <string> -v <string> [-t] [--perflog] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-forcedatarecordcreate--s-string--v-string--t---perflog--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx force:data:record:delete -s <string> [-i <id>] [-w <string>] [-t] [--perflog] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-forcedatarecorddelete--s-string--i-id--w-string--t---perflog--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx force:data:record:get -s <string> [-i <id>] [-w <string>] [-t] [--perflog] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-forcedatarecordget--s-string--i-id--w-string--t---perflog--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx force:data:record:update -s <string> -v <string> [-i <id>] [-w <string>] [-t] [--perflog] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-forcedatarecordupdate--s-string--v-string--i-id--w-string--t---perflog--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx force:data:record:create -s <string> -v <string> [-t] [--perflog] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

creates and inserts a record

```
USAGE
  $ sfdx force:data:record:create -s <string> -v <string> [-t] [--perflog] [-u <string>] [--apiversion <string>]
  [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -s, --sobjecttype=sobjecttype                                                     (required) the type of the record
                                                                                    you’re creating

  -t, --usetoolingapi                                                               create the record with tooling api

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  -v, --values=values                                                               (required) the <fieldName>=<value>
                                                                                    pairs you’re creating

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --perflog                                                                         get API performance data

DESCRIPTION
  The format of a field-value pair is <fieldName>=<value>.
  Enclose all field-value pairs in one set of double quotation marks, delimited by spaces.
  Enclose values that contain spaces in single quotes.

  To get data on API performance metrics, specify both --perflog and --json.

EXAMPLES
  sfdx force:data:record:create -s Account -v "Name=Acme"
  sfdx force:data:record:create -s Account -v "Name='Universal Containers'"
  sfdx force:data:record:create -s Account -v "Name='Universal Containers' Website=www.example.com"
  sfdx force:data:record:create -t -s TraceFlag -v "DebugLevelId=7dl170000008U36AAE
  StartDate=2017-12-01T00:26:04.000+0000 ExpirationDate=2017-12-01T00:56:04.000+0000 LogType=CLASS_TRACING
  TracedEntityId=01p17000000R6bLAAS"
  sfdx force:data:record:create -s Account -v "Name=Acme" --perflog --json
```

_See code: [src/commands/force/data/record/create.ts](https://github.com/salesforcecli/data/blob/v0.2.0/src/commands/force/data/record/create.ts)_

## `sfdx force:data:record:delete -s <string> [-i <id>] [-w <string>] [-t] [--perflog] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

deletes a single record

```
USAGE
  $ sfdx force:data:record:delete -s <string> [-i <id>] [-w <string>] [-t] [--perflog] [-u <string>] [--apiversion
  <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -i, --sobjectid=sobjectid                                                         the ID of the record you’re deleting

  -s, --sobjecttype=sobjecttype                                                     (required) the type of the record
                                                                                    you’re deleting

  -t, --usetoolingapi                                                               delete the record with Tooling API

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  -w, --where=where                                                                 a list of <fieldName>=<value> pairs
                                                                                    to search for

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --perflog                                                                         get API performance data

DESCRIPTION
  Specify an sObject type and either an ID or a list of <fieldName>=<value> pairs.
  The format of a field-value pair is <fieldName>=<value>.
  Enclose all field-value pairs in one set of double quotation marks, delimited by spaces.
  Enclose values that contain spaces in single quotes.

  To get data on API performance metrics, specify both --perflog and --json.

EXAMPLES
  sfdx force:data:record:delete -s Account -i 001D000000Kv3dl
  sfdx force:data:record:delete -s Account -w "Name=Acme"
  sfdx force:data:record:delete -s Account -w "Name='Universal Containers'"
  sfdx force:data:record:delete -s Account -w "Name='Universal Containers' Phone='(123) 456-7890'"
  sfdx force:data:record:delete -t -s TraceFlag -i 7tf170000009cU6AAI --perflog --json
```

_See code: [src/commands/force/data/record/delete.ts](https://github.com/salesforcecli/data/blob/v0.2.0/src/commands/force/data/record/delete.ts)_

## `sfdx force:data:record:get -s <string> [-i <id>] [-w <string>] [-t] [--perflog] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

displays a single record

```
USAGE
  $ sfdx force:data:record:get -s <string> [-i <id>] [-w <string>] [-t] [--perflog] [-u <string>] [--apiversion
  <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -i, --sobjectid=sobjectid                                                         the ID of the record you’re
                                                                                    retrieving

  -s, --sobjecttype=sobjecttype                                                     (required) the type of the record
                                                                                    you’re retrieving

  -t, --usetoolingapi                                                               retrieve the record with Tooling API

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  -w, --where=where                                                                 a list of <fieldName>=<value> pairs
                                                                                    to search for

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --perflog                                                                         get API performance data

DESCRIPTION
  Specify an sObject type and either an ID or a list of <fieldName>=<value> pairs.
  The format of a field-value pair is <fieldName>=<value>.
  Enclose all field-value pairs in one set of double quotation marks, delimited by spaces.
  Enclose values that contain spaces in single quotes.

  To get data on API performance metrics, specify both --perflog and --json.

EXAMPLES
  sfdx force:data:record:get -s Account -i 001D000000Kv3dl
  sfdx force:data:record:get -s Account -w "Name=Acme"
  sfdx force:data:record:get -s Account -w "Name='Universal Containers'"
  sfdx force:data:record:get -s Account -w "Name='Universal Containers' Phone='(123) 456-7890'"
  sfdx force:data:record:get -t -s TraceFlag -i 7tf170000009cUBAAY --perflog --json
```

_See code: [src/commands/force/data/record/get.ts](https://github.com/salesforcecli/data/blob/v0.2.0/src/commands/force/data/record/get.ts)_

## `sfdx force:data:record:update -s <string> -v <string> [-i <id>] [-w <string>] [-t] [--perflog] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

updates a single record

```
USAGE
  $ sfdx force:data:record:update -s <string> -v <string> [-i <id>] [-w <string>] [-t] [--perflog] [-u <string>]
  [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -i, --sobjectid=sobjectid                                                         the ID of the record you’re updating

  -s, --sobjecttype=sobjecttype                                                     (required) the sObject type of the
                                                                                    record you’re updating

  -t, --usetoolingapi                                                               update the record with Tooling API

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  -v, --values=values                                                               (required) the <fieldName>=<value>
                                                                                    pairs you’re updating

  -w, --where=where                                                                 a list of <fieldName>=<value> pairs
                                                                                    to search for

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --perflog                                                                         get API performance data

DESCRIPTION
  The format of a field-value pair is <fieldName>=<value>.
  Enclose all field-value pairs in one set of double quotation marks, delimited by spaces.
  Enclose values that contain spaces in single quotes.

  To get data on API performance metrics, specify both --perflog and --json.

EXAMPLES
  sfdx force:data:record:update -s Account -i 001D000000Kv3dl -v "Name=NewAcme"
  sfdx force:data:record:update -s Account -w "Name='Old Acme'" -v "Name='New Acme'"
  sfdx force:data:record:update -s Account -i 001D000000Kv3dl -v "Name='Acme III' Website=www.example.com"
  sfdx force:data:record:update -t -s TraceFlag -i 7tf170000009cUBAAY -v "ExpirationDate=2017-12-01T00:58:04.000+0000"
  sfdx force:data:record:update -s Account -i 001D000000Kv3dl -v "Name=NewAcme" --perflog --json
```

_See code: [src/commands/force/data/record/update.ts](https://github.com/salesforcecli/data/blob/v0.2.0/src/commands/force/data/record/update.ts)_

<!-- commandsstop -->
